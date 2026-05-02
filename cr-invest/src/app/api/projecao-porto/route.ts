import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const NET_FACTOR = 1 - 0.084 - 0.069; // 0.847

function parseBRDate(str: string): Date | null {
  const parts = str.trim().split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function parseBRNum(str: string): number {
  return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

function firstCommissionDate(inicio: Date): Date {
  return addMonths(inicio, inicio.getUTCDate() <= 22 ? 1 : 2);
}

interface CommBase { commBase: number; nMeses: number; }

export interface ContratoDetalhe {
  nome: string;
  proposta: string;
  apolice: string;
  produto: string;
  premio: number;
  nMeses: number;
  parcelaNum: number;
  commMensal: number;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "contratos-porto.txt");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ totais: {}, detalhes: {} });
    }

    // Load real commission amounts — DB first (updatable via UI), fallback to file
    let commBase: Record<string, CommBase> = {};
    try {
      const dbRec = await prisma.appSetting.findUnique({ where: { key: "porto:comissoes-base" } });
      if (dbRec) {
        commBase = JSON.parse(dbRec.value);
      } else {
        const baseJsonPath = path.join(process.cwd(), "comissoes-base.json");
        if (fs.existsSync(baseJsonPath)) {
          commBase = JSON.parse(fs.readFileSync(baseJsonPath, "utf8"));
        }
      }
    } catch {
      const baseJsonPath = path.join(process.cwd(), "comissoes-base.json");
      if (fs.existsSync(baseJsonPath)) {
        commBase = JSON.parse(fs.readFileSync(baseJsonPath, "utf8"));
      }
    }

    const txt = fs.readFileSync(filePath, "utf8");
    const lines = txt.split("\n");
    const header = lines[0].split("\t").map(h => h.trim());

    const iCliente  = header.indexOf("CLIENTE");
    const iProposta = header.indexOf("PROPOSTA");
    const iApolice  = header.indexOf("APÓLICE");
    const iProduto  = header.indexOf("NOME ABREVIADO DO PRODUTO");
    const iInicio   = header.indexOf("INÍCIO DE VIGÊNCIA");
    const iParcelas = header.indexOf("QUANTIDADE DE PARCELAS");
    const iPremio   = header.indexOf("PRÊMIO");

    const now = new Date();
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const startKey = monthKey(windowStart);
    const endKey   = `${now.getUTCFullYear() + 1}-12`;

    const totais:   Record<string, number> = {};
    const detalhes: Record<string, ContratoDetalhe[]> = {};

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t").map(c => c.trim());
      if (cols.length < 5) continue;

      const nome        = cols[iCliente]  || "";
      const proposta    = cols[iProposta] || "";
      const apolice     = cols[iApolice]  || "";
      const produto     = cols[iProduto]  || "";
      const inicioD     = parseBRDate(cols[iInicio]);
      const parcelasRaw = parseBRNum(cols[iParcelas]);
      const premio      = parseBRNum(cols[iPremio]);

      if (!inicioD || !nome) continue;

      let nMeses: number;
      let commMensal: number;

      const realData = commBase[apolice];
      if (realData) {
        nMeses    = realData.nMeses;
        commMensal = realData.commBase;
      } else {
        if (!premio) continue;
        nMeses    = (parcelasRaw >= 1 && parcelasRaw <= 12) ? Math.round(parcelasRaw) : 12;
        commMensal = (premio * 0.04) / nMeses * NET_FACTOR;
      }

      const firstComm = firstCommissionDate(inicioD);

      for (let j = 0; j < nMeses; j++) {
        const dt  = addMonths(firstComm, j);
        const key = monthKey(dt);
        if (key < startKey || key > endKey) continue;

        totais[key] = (totais[key] || 0) + commMensal;
        if (!detalhes[key]) detalhes[key] = [];
        detalhes[key].push({ nome, proposta, apolice, produto, premio, nMeses, parcelaNum: j + 1, commMensal });
      }
    }

    for (const key of Object.keys(detalhes)) {
      detalhes[key].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    return NextResponse.json({ totais, detalhes });
  } catch (e) {
    console.error("projecao-porto:", e);
    return NextResponse.json({ totais: {}, detalhes: {} });
  }
}
