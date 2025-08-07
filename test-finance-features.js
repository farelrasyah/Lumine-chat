const { AdvancedFinanceParserService } = require('./src/finance/advanced-finance-parser.service');
const { EnhancedDateService } = require('./src/finance/enhanced-date.service');
const { FinanceAnalysisService } = require('./src/finance/finance-analysis.service');

// Quick test script untuk fitur finance baru
async function testFinanceFeatures() {
    console.log('🧪 Testing Enhanced Finance Features...\n');

    const dateService = new EnhancedDateService();
    const analysisService = new FinanceAnalysisService(dateService);
    const parserService = new AdvancedFinanceParserService(dateService);

    // Test 1: Date parsing
    console.log('📅 Testing Date Parsing:');
    const testQueries = [
        'pengeluaran hari Senin',
        'total belanja bulan lalu', 
        'pengeluaran dari 3 Juni sampai 17 Juli 2025',
        'pengeluaran bulan Januari 2025',
        'total tahun ini',
        'pengeluaran 2 minggu lalu'
    ];

    testQueries.forEach(query => {
        const timeContext = dateService.parseTimeExpression(query);
        if (timeContext) {
            const dateRange = dateService.getDateRange(timeContext);
            console.log(`✅ "${query}" → ${dateRange.startDate} to ${dateRange.endDate} (${dateRange.description})`);
        } else {
            console.log(`❌ "${query}" → No time context found`);
        }
    });

    console.log('\n🤖 Testing Advanced Query Parsing:');
    
    // Test 2: Advanced query parsing
    const advancedQueries = [
        'bandingkan pengeluaran bulan ini dengan bulan lalu',
        'prediksi pengeluaran akhir bulan',
        'set batas bulanan 2 juta',
        'target hemat 500 ribu untuk October',
        'analisis pola pengeluaran ku',
        'tips hemat berdasarkan data ku',
        'aku beli kopi di mana aja bulan ini?',
        'challenge 7 hari tanpa belanja',
        'simulasi kalau hemat 100 ribu per hari'
    ];

    advancedQueries.forEach(query => {
        const parsed = parserService.parseAdvancedQuery(query, 'test_user');
        if (parsed) {
            console.log(`✅ "${query}" → Intent: ${parsed.intent}`);
            if (parsed.budgetAmount) console.log(`   Budget: ${parsed.budgetAmount}`);
            if (parsed.goalAmount) console.log(`   Goal: ${parsed.goalAmount}`);
            if (parsed.searchKeyword) console.log(`   Search: ${parsed.searchKeyword}`);
        } else {
            console.log(`❌ "${query}" → No advanced intent found`);
        }
    });

    console.log('\n✨ Finance features test completed!');
    console.log('\nTo test with real data:');
    console.log('1. npm run start:dev');
    console.log('2. Send WhatsApp message: @lumine pengeluaran bulan ini');
    console.log('3. Try: @lumine set batas bulanan 1 juta');
    console.log('4. Try: @lumine analisis keuangan');
}

// Run tests
testFinanceFeatures().catch(console.error);

module.exports = { testFinanceFeatures };
