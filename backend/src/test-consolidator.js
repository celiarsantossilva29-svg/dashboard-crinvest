const consolidator = require('./consolidator');

async function testConsolidation() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const results = await consolidator.getConsolidatedData(today, today);
        
        console.log(`Consolidated ${results.length} leads for today.`);
        
        if (results.length > 0) {
            // Find a lead with some activity
            const active = results.find(l => l.activity.total_calls_goto > 0 || l.activity.total_calls_3c > 0);
            if (active) {
                console.log('Sample Active Lead:', JSON.stringify(active, null, 2));
            } else {
                console.log('No active leads found in this sample, showing first:', JSON.stringify(results[0], null, 2));
            }
        }
    } catch(e) {
        console.error('Consolidation Error:', e.message);
    }
}

testConsolidation();
