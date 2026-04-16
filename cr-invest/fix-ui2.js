const fs = require('fs');
const path = 'src/app/dashboard/performance-sdr/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix remaining old no-show formula (2nd section)
const oldNoShow2 = `displayed.length > 0 ? (displayed.reduce((s: any, r: any) => s + (r.taxaNoShow || 0), 0) / displayed.length).toFixed(1) : '0'`;
const newNoShow2 = `(() => { const r = displayed.reduce((s: any, x: any) => s + (x.reunioes || 0), 0); const ns = displayed.reduce((s: any, x: any) => s + (x.noShowsNoPeriodo || 0), 0); const e = r + ns; return e > 0 ? ((ns / e) * 100).toFixed(1) : '0'; })()`;

let count = 0;
while (content.includes(oldNoShow2)) {
  content = content.replace(oldNoShow2, newNoShow2);
  count++;
}
console.log(`Fixed ${count} remaining No-show formulas`);

// Fix 2nd comparecimento
const oldComp2 = `(() => { const totalAgend = displayed.reduce((s: any, r: any) => s + r.agendamentos, 0); const totalReun = displayed.reduce((s: any, r: any) => s + (r.reunioes || 0), 0); return totalAgend > 0 ? ((totalReun / totalAgend) * 100).toFixed(1) : '0'; })()`;
const newComp2 = `(() => { const r = displayed.reduce((s: any, x: any) => s + (x.reunioes || 0), 0); const ns = displayed.reduce((s: any, x: any) => s + (x.noShowsNoPeriodo || 0), 0); const e = r + ns; return e > 0 ? ((r / e) * 100).toFixed(1) : '0'; })()`;

let count2 = 0;
while (content.includes(oldComp2)) {
  content = content.replace(oldComp2, newComp2);
  count2++;
}
console.log(`Fixed ${count2} remaining Comparecimento formulas`);

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
