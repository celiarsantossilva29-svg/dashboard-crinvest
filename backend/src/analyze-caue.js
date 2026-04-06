const goto = require('./goto');

async function analyze() {
    try {
        const result = await goto.getCallsHistory('2026-03-01', '2026-03-24');
        const items = result.items || [];
        
        const caueItems = items.filter(c => c.caller?.number === '1000' || c.caller?.number === '1002');
        
        // Group by day
        const daily = {};
        caueItems.forEach(c => {
            const day = c.startTime.split('T')[0];
            if (!daily[day]) daily[day] = { raw: 0, unique: new Set(), answered: 0, dmc: 0 };
            daily[day].raw++;
            daily[day].unique.add(c.originatorId);
            if (c.duration > 0) daily[day].answered++;
            if (c.duration > 45000) daily[day].dmc++;
        });

        console.log('Cauê GoTo Daily Stats (Extensions 1000/1002):');
        Object.keys(daily).sort().forEach(day => {
            console.log(`${day}: Raw:${daily[day].raw} | Unique:${daily[day].unique.size} | Ans:${daily[day].answered} | DMC:${daily[day].dmc}`);
        });

    } catch(e) { console.error(e.message); }
}
analyze();
