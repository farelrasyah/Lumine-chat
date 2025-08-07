const { EnhancedDateService } = require('./src/finance/enhanced-date.service');

// Test the date parsing for "hari Senin"
async function testMondayParsing() {
    console.log('🧪 Testing Monday parsing fix...\n');
    
    const dateService = new (require('./src/finance/enhanced-date.service').EnhancedDateService)();
    
    // Test cases
    const testCases = [
        "pengeluaranku hari Senin",
        "pengeluaran hari senin",
        "hari senin",
        "hari Selasa",
        "pengeluaran hari Rabu"
    ];
    
    testCases.forEach(testCase => {
        console.log(`\n📝 Testing: "${testCase}"`);
        
        try {
            const timeContext = dateService.parseTimeExpression(testCase);
            console.log(`   TimeContext:`, timeContext);
            
            if (timeContext) {
                const dateRange = dateService.getDateRange(timeContext);
                console.log(`   DateRange:`, dateRange);
            } else {
                console.log(`   ❌ No time context detected`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error:`, error.message);
        }
    });
    
    console.log('\n✅ Test completed!');
}

// Run if this script is executed directly
if (require.main === module) {
    testMondayParsing().catch(console.error);
}

module.exports = { testMondayParsing };
