import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const NET = 1 - 0.084 - 0.069;
const DB_KEY = "porto:comissoes-base";
const DB_KEY_PAG = "porto:pag-data";

interface CommEntry { commBase: number; nMeses: number; }
type CommBase = Record<string, CommEntry>;
type PagEntry = [string, string, number]; // [mes, apolice, valor]

function parseBRNum(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function parseBRDate(s: string): Date | null {
  const p = s.trim().split("/").map(Number);
  if (p.length !== 3) return null;
  return new Date(Date.UTC(p[2], p[1] - 1, p[0]));
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Parse a Porto monthly report pasted as text.
// Each row: [valor] [apolice] [cpf/cnpj] [nome...]
// Valor can be "R$ 1.757,02" or "1.757,02"; apólice is 7–10 digit number.
function parsePortoTSV(text: string): { apolice: string; valor: number; nome: string }[] {
  const results: { apolice: string; valor: number; nome: string }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const tokens = line.split(/\t/).map(t => t.trim()).filter(Boolean);
    if (tokens.length < 2) continue;

    // Find valor token (contains comma or starts with R$)
    let valor = 0;
    let apolice = "";
    const nome: string[] = [];

    for (const tok of tokens) {
      const clean = tok.replace(/^R\$\s*/i, "").trim();
      if (!valor && /^\d{1,3}(\.\d{3})*(,\d{2})?$/.test(clean)) {
        valor = parseBRNum(clean);
        continue;
      }
      if (!apolice && /^\d{7,10}$/.test(tok.replace(/\s/g, ""))) {
        apolice = tok.replace(/\s/g, "");
        continue;
      }
      // CPF/CNPJ — skip
      if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(tok) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(tok)) {
        continue;
      }
      if (apolice) nome.push(tok);
    }

    if (valor > 0 && apolice) {
      results.push({ apolice, valor, nome: nome.join(" ") });
    }
  }
  return results;
}

function recalcCommBase(pag: PagEntry[], prêmioMap: Record<string, number>): CommBase {
  const byAp: Record<string, Record<string, number[]>> = {};
  for (const [mes, ap, comm] of pag) {
    const k = ap.replace(/^0+/, "");
    if (!byAp[k]) byAp[k] = {};
    if (!byAp[k][mes]) byAp[k][mes] = [];
    byAp[k][mes].push(comm);
  }

  const out: CommBase = {};
  for (const [ap, meses] of Object.entries(byAp)) {
    const normais: number[] = [];
    const todos: number[] = [];
    for (const vals of Object.values(meses)) {
      const seen = new Set<number>();
      const uniq = vals.map(v => Math.round(v * 100) / 100).filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
      todos.push(...vals);
      if (uniq.length === 1) normais.push(uniq[0]);
    }
    normais.sort((a, b) => a - b);
    const commBase = normais.length > 0 ? normais[Math.floor(normais.length / 2)] : Math.min(...todos);

    let nMeses = 10;
    const premio = prêmioMap[ap];
    if (premio && premio > 0 && commBase > 0) {
      const commBruta = commBase / NET;
      const calc = Math.round((premio * 0.04) / commBruta);
      if (calc >= 1 && calc <= 60) nMeses = calc;
    }

    out[ap] = { commBase, nMeses };
  }
  return out;
}

async function loadPremioMap(): Promise<Record<string, number>> {
  const filePath = path.join(process.cwd(), "contratos-porto.txt");
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const hdr = lines[0].split("\t").map(h => h.trim());
  const iAp = hdr.indexOf("APÓLICE");
  const iPremio = hdr.indexOf("PRÊMIO");
  const map: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t").map(c => c.trim());
    if (cols.length < 5) continue;
    const ap = (cols[iAp] || "").replace(/^0+/, "");
    const premio = parseBRNum(cols[iPremio] || "");
    if (ap && premio) map[ap] = premio;
  }
  return map;
}

export async function POST(req: Request) {
  try {
    const { mes, linhas } = await req.json() as { mes: string; linhas: string };
    if (!mes || !linhas) {
      return NextResponse.json({ error: "mes e linhas são obrigatórios" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: "mes deve ser YYYY-MM" }, { status: 400 });
    }

    const parsed = parsePortoTSV(linhas);
    if (!parsed.length) {
      return NextResponse.json({ error: "Nenhuma linha reconhecida. Verifique o formato." }, { status: 400 });
    }

    // Load current PAG history from DB
    const pagRec = await prisma.appSetting.findUnique({ where: { key: DB_KEY_PAG } });
    const pag: PagEntry[] = pagRec ? JSON.parse(pagRec.value) : [];

    // Remove any existing entries for this month (idempotent re-upload)
    const pagSemMes = pag.filter(([m]) => m !== mes);

    // Add new month entries
    for (const { apolice, valor } of parsed) {
      pagSemMes.push([mes, apolice.replace(/^0+/, ""), valor]);
    }

    // Recalculate commBase
    const premioMap = await loadPremioMap();
    const newCommBase = recalcCommBase(pagSemMes, premioMap);

    // Load existing commBase to detect new vs updated
    const cbRec = await prisma.appSetting.findUnique({ where: { key: DB_KEY } });
    const oldCommBase: CommBase = cbRec ? JSON.parse(cbRec.value) : {};
    const novas = parsed.filter(r => !oldCommBase[r.apolice.replace(/^0+/, "")]).length;

    // Save both to DB
    await prisma.appSetting.upsert({
      where: { key: DB_KEY_PAG },
      create: { key: DB_KEY_PAG, value: JSON.stringify(pagSemMes) },
      update: { value: JSON.stringify(pagSemMes) },
    });
    await prisma.appSetting.upsert({
      where: { key: DB_KEY },
      create: { key: DB_KEY, value: JSON.stringify(newCommBase) },
      update: { value: JSON.stringify(newCommBase) },
    });

    // Mark individual installments as PAGO for each confirmed apólice in this month
    const [year, month] = mes.split("-").map(Number);
    const mesFrom = new Date(Date.UTC(year, month - 1, 1));
    const mesTo = new Date(Date.UTC(year, month, 1));
    const today = new Date();
    let parcelasMarcadas = 0;

    for (const { apolice } of parsed) {
      // Find sale(s) with this apólice in notes
      const sales = await prisma.sale.findMany({
        where: { notes: { contains: apolice } },
        select: { id: true },
      });
      if (!sales.length) continue;

      const saleIds = sales.map(s => s.id);
      const r = await prisma.installment.updateMany({
        where: {
          saleId: { in: saleIds },
          dataVencimento: { gte: mesFrom, lt: mesTo },
          status: { notIn: ["PAGO", "CANCELADO"] },
        },
        data: { status: "PAGO", pago: true, dataPagamento: today },
      });
      parcelasMarcadas += r.count;
    }

    return NextResponse.json({
      processadas: parsed.length,
      novas,
      atualizadas: parsed.length - novas,
      parcelasMarcadas,
      preview: parsed.slice(0, 5),
    });
  } catch (e) {
    console.error("porto/confirmar-mes:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Preview — parse without saving
export async function PUT(req: Request) {
  try {
    const { linhas } = await req.json() as { linhas: string };
    const parsed = parsePortoTSV(linhas || "");

    const cbRec = await prisma.appSetting.findUnique({ where: { key: DB_KEY } });
    const oldCommBase: CommBase = cbRec ? JSON.parse(cbRec.value) : {};

    const rows = parsed.map(r => ({
      ...r,
      nova: !oldCommBase[r.apolice.replace(/^0+/, "")],
    }));

    return NextResponse.json({ rows, total: rows.length, novas: rows.filter(r => r.nova).length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
