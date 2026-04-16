const fs = require('fs');
const path = 'src/app/dashboard/performance-sdr/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: No-show gerado - use reuniões/(reuniões+noShows) instead of avg per-SDR
const oldNoShow = `displayed.length > 0 ? (displayed.reduce((s: any, r: any) => s + (r.taxaNoShow || 0), 0) / displayed.length).toFixed(1) : '0'`;
const newNoShow = `(() => { const r = displayed.reduce((s: any, x: any) => s + (x.reunioes || 0), 0); const ns = displayed.reduce((s: any, x: any) => s + (x.noShowsNoPeriodo || 0), 0); const e = r + ns; return e > 0 ? ((ns / e) * 100).toFixed(1) : '0'; })()`;

// Fix 2: Comparecimento - use reuniões/(reuniões+noShows) 
const oldComp = `(() => { const totalAgend = displayed.reduce((s: any, r: any) => s + r.agendamentos, 0); const totalReun = displayed.reduce((s: any, r: any) => s + (r.reunioes || 0), 0); return totalAgend > 0 ? ((totalReun / totalAgend) * 100).toFixed(1) : '0'; })()`;
const newComp = `(() => { const r = displayed.reduce((s: any, x: any) => s + (x.reunioes || 0), 0); const ns = displayed.reduce((s: any, x: any) => s + (x.noShowsNoPeriodo || 0), 0); const e = r + ns; return e > 0 ? ((r / e) * 100).toFixed(1) : '0'; })()`;

// Fix 3: Ranking - filter to only show SDRs (agents with leads or agendamentos)
const oldRankMap = `displayed.map((row: any, i: number) => (`;
const newRankMap = `displayed.filter((row: any) => row.leadsGerados > 0 || row.agendamentos > 0).map((row: any, i: number) => (`;

let count = 0;
if (content.includes(oldNoShow)) { content = content.replace(oldNoShow, newNoShow); count++; console.log('Fixed No-show gerado'); }
else console.log('WARN: oldNoShow not found');

if (content.includes(oldComp)) { content = content.replace(oldComp, newComp); count++; console.log('Fixed Comparecimento'); }
else console.log('WARN: oldComp not found');

if (content.includes(oldRankMap)) { content = content.replace(oldRankMap, newRankMap); count++; console.log('Fixed Ranking filter'); }
else console.log('WARN: oldRankMap not found');

fs.writeFileSync(path, content, 'utf8');
console.log(`\nDone! ${count} fixes applied.`);
