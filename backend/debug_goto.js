const gotoApi = require('./src/goto');
(async () => {
  try {
    const calls = await gotoApi.getCallsHistory('2026-03-22', '2026-03-26');
    const items = calls.items || [];
    console.log('Total GoTo calls:', items.length);
    const exts = {};
    items.forEach(c => {
      const caller = c.caller?.number || '?';
      const callee = c.callee?.number || '?';
      const key = caller + ' -> ' + callee;
      exts[key] = (exts[key] || 0) + 1;
    });
    Object.entries(exts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v + ' calls'));
  } catch(e) { console.error('Error:', e.message); }
})();
