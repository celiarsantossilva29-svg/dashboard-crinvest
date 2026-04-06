const goto = require('./goto');

async function testGoToMonth() {
    try {
        const result = await goto.getCallsHistory('2026-03-01', '2026-03-24');
        const calls = result.items || [];
        
        console.log(`Total RAW records for month: ${calls.length}`);
        
        const caueGoto = calls.filter(c => c.caller?.number === '1000' || c.caller?.number === '1002');
        console.log(`Raw Caller == 1000|1002: ${caueGoto.length}`);
        
        // Let's deduplicate by originatorId
        const map = new Map();
        caueGoto.forEach(c => {
            if (!map.has(c.originatorId)) {
                map.set(c.originatorId, c);
            } else {
                // If it exists, merge the duration if needed, or just take the longest leg
                if ((c.duration||0) > (map.get(c.originatorId).duration||0)) {
                    map.set(c.originatorId, c);
                }
            }
        });
        
        const uniqueCalls = Array.from(map.values());
        console.log(`Unique calls (originatorId): ${uniqueCalls.length}`);
        
        // Find how many have duration > 0
        const answered = uniqueCalls.filter(c => c.duration > 0 || c.answerTime != null);
        console.log(`Answered (duration > 0 or answerTime != null): ${answered.length}`);
        
        const dmc = uniqueCalls.filter(c => (c.duration || 0) > 45000);
        console.log(`DMC (>45s): ${dmc.length}`);
        
    } catch(e) {
        console.error(e.message);
    }
}
testGoToMonth();
