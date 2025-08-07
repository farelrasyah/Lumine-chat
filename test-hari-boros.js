const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module').AppModule;

async function testHariPalingBorosQueries() {
    console.log('🚀 Testing "Hari Paling Boros" Query Detection...\n');

    try {
        const app = await NestFactory.create(AppModule, { logger: false });
        const messageProcessor = app.get('MessageProcessorService');

        const testQueries = [
            "hari paling boros bulan ini",
            "kapan aku paling boros?", 
            "hari paling mahal minggu lalu",
            "tanggal berapa paling boros",
            "hari yang paling boros",
            "terboros hari apa",
            "hari termahal",
            "hari dengan pengeluaran paling besar"
        ];

        let passCount = 0;
        
        for (const query of testQueries) {
            console.log(`Testing: "${query}"`);
            
            // Test if it's detected as finance query
            const isFinanceQuery = messageProcessor.isFinanceQueryRequest(query);
            
            if (isFinanceQuery) {
                console.log(`✅ Detected as finance query: YES`);
                passCount++;
                
                // Try to get advanced query result
                try {
                    const result = await messageProcessor.handleMessage(query, '123456789');
                    console.log(`📊 Response preview: ${result.substring(0, 100)}...`);
                } catch (error) {
                    console.log(`⚠️  Processing error: ${error.message}`);
                }
            } else {
                console.log(`❌ Detected as finance query: NO`);
            }
            
            console.log('---');
        }

        console.log(`\n📊 Summary: ${passCount}/${testQueries.length} queries detected correctly`);
        
        if (passCount === testQueries.length) {
            console.log('🎉 All "Hari Paling Boros" queries detected successfully!');
        } else {
            console.log('❌ Some queries not detected. Check pattern matching.');
        }

        await app.close();
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testHariPalingBorosQueries();
