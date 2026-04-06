const tcPlus = require('./src/threecplus');
const gotoApi = require('./src/goto');

async function test() {
    const qStart = '2026-03-01';
    const qEnd = '2026-03-26';
    
    console.log('Testing range:', qStart, 'to', qEnd);
    
    try {
        const stats3c = await tcPlus.getCallStatistics(qStart, qEnd);
        console.log('3C Plus stats count:', stats3c.data ? stats3c.data.length : 0);
        if (stats3c.data) console.log('3C Agents found:', stats3c.data.map(a => a.agent_name));

        const statsGoto = await gotoApi.getCallsHistory(qStart, qEnd);
        console.log('GoTo calls found:', statsGoto.items ? statsGoto.items.length : 0);
        
        const caueCalls = (statsGoto.items || []).filter(c => 
            c.caller?.number === '1000' || c.caller?.number === '1002' ||
            c.callee?.number === '1000' || c.callee?.number === '1002'
        );
        console.log('Cauê GoTo calls:', caueCalls.length);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
