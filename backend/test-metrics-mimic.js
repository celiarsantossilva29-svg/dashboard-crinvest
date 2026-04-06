const tcPlus = require('./src/threecplus');
const gotoApi = require('./src/goto');

async function test() {
    const qStart = '2026-03-22';
    const qEnd = '2026-04-22';
    
    console.log('Testing range:', qStart, 'to', qEnd);
    
    try {
        const [statsEunice, statsGoto] = await Promise.all([
            tcPlus.getCallStatistics(qStart, qEnd, tcPlus.ACTIVE_AGENTS['Eunice Dias']).catch(e => ({ data: [] })),
            gotoApi.getCallsHistory(qStart, qEnd).catch(e => ({ items: [] }))
        ]);

        const activityCalls = {
            totalCalls: 0,
            sdr: { calls: 0, talkTime: 0, source: 'GoTo' },
            closer: { calls: 0, talkTime: 0, source: '3C Plus' }
        };

        const euniceDaily = statsEunice.data || [];
        console.log('Eunice daily items:', euniceDaily.length);
        euniceDaily.forEach((day, i) => {
            console.log(`Day ${i} (${day.date}): answered=${day.answered}`);
            activityCalls.closer.calls += parseInt(day.answered || 0);
        });

        console.log('Final activityCalls.closer:', activityCalls.closer);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
