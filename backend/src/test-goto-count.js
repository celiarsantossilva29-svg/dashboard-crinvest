const goto = require('./goto');
const fs = require('fs');

async function testGoToCDR() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await goto.getCallsHistory(today, today);
        const calls = result.items || [];
        console.log(`Total records in CDR: ${calls.length}`);

        const asCaller = calls.filter(c => c.caller?.number === '1000' || c.caller?.number === '1002');
        const asCallee = calls.filter(c => c.callee?.number === '1000' || c.callee?.number === '1002');

        console.log(`Found as Caller: ${asCaller.length}`);
        console.log(`Found as Callee: ${asCallee.length}`);

        // Unique calls check (OriginatorId matches real calls, legId are just segments)
        // Some systems use single originatorId for the whole call
        const uniqueOriginatorsCaller = new Set(asCaller.map(c => c.originatorId)).size;
        console.log(`Unique as Caller (originatorId): ${uniqueOriginatorsCaller}`);

        // What does the actual Jive Dashboard count for Célia today? 44.
    } catch(err) {
        console.error('Error fetching CDR:', err.message);
    }
}

testGoToCDR();
