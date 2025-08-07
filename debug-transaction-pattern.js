// Debug specific transaction patterns yang bermasalah

const testCases = [
    "pengeluaranku dari tanggal 1 sampai tanggal 7",
    "pengeluaran dari tanggal 5 sampai tanggal 10", 
    "dari tanggal 1 hingga tanggal 15",
    "dari warung makan 25 ribu", // This SHOULD be transaction
    "dari toko abc 10 ribu" // This SHOULD be transaction
];

const problematicPatterns = [
    { name: "/(di|ke)\\s+\\w+.*\\d+/", regex: /(di|ke)\s+\w+.*\d+/ },
    { name: "/dari\\s+\\w+(?!\\s+tanggal).*\\d+/", regex: /dari\s+\w+(?!\s+tanggal).*\d+/ },
    { name: "/dari\\s+(\\w+)(?!\\s*tanggal).*\\d+/", regex: /dari\s+(\w+)(?!\s*tanggal).*\d+/ }
];

console.log('🔍 DEBUGGING PROBLEMATIC TRANSACTION PATTERNS\n');

testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. Testing: "${testCase}"`);
    
    problematicPatterns.forEach(pattern => {
        const match = pattern.regex.test(testCase);
        console.log(`   ${pattern.name}: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
        if (match) {
            const groups = testCase.match(pattern.regex);
            console.log(`      Captured groups:`, groups);
        }
    });
    
    console.log();
});

// Test improved pattern
const improvedPattern = /dari\s+(?!tanggal)\w+.*\d+/;
console.log('=== TESTING IMPROVED PATTERN: /dari\\s+(?!tanggal)\\w+.*\\d+/ ===\n');

testCases.forEach((testCase, index) => {
    const match = improvedPattern.test(testCase);
    const shouldMatch = testCase.includes('warung') || testCase.includes('toko');
    const isCorrect = match === shouldMatch;
    
    console.log(`${index + 1}. "${testCase}"`);
    console.log(`   Should Match: ${shouldMatch} | Actual: ${match} | ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
    
    if (match) {
        const groups = testCase.match(improvedPattern);
        console.log(`   Captured:`, groups[0]);
    }
    console.log();
});
