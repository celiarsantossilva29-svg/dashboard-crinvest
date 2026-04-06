const goto = require('./goto');
const fs = require('fs');

async function testGoToCDR() {
    console.log('Fetching Real Call History (CDR)...');
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await goto.getCallsHistory(today, today);
        console.log('CDR Sample:', JSON.stringify(result, null, 2).substring(0, 2000));
    } catch(err) {
        console.error('Error fetching CDR:', err.message);
    }
}

testGoToCDR();
