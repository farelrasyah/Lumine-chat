// Debug pattern matching untuk "dari tanggal X sampai tanggal Y"

const testStrings = [
    "pengeluaranku dari tanggal 1 sampai tanggal 7",
    "pengeluaran dari tanggal 5 sampai tanggal 10", 
    "dari tanggal 1 hingga tanggal 15"
];

const patterns = [
    { name: "Pattern 1: /(pengeluaran|pengeluaranku)\\s+dari\\s+(tanggal\\s+)?\\d+/", regex: /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/ },
    { name: "Pattern 2: /dari\\s+(tanggal\\s+)?\\d+\\s+(sampai|hingga)\\s+(tanggal\\s+)?\\d+/", regex: /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/ },
    { name: "Pattern 3: /antara\\s+(tanggal\\s+)?\\d+\\s+(dan|sampai|hingga)\\s+(tanggal\\s+)?\\d+/", regex: /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/ }
];

console.log('🔍 DEBUGGING PATTERN MATCHING\n');

testStrings.forEach((testString, index) => {
    console.log(`${index + 1}. Testing: "${testString}"`);
    
    patterns.forEach(pattern => {
        const match = pattern.regex.test(testString);
        console.log(`   ${pattern.name}: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
        if (match) {
            const groups = testString.match(pattern.regex);
            console.log(`      Captured groups:`, groups);
        }
    });
    
    console.log();
});

// Test the full logic
function debugIsFinanceQuery(prompt) {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    const informationQueryPatterns = [
        /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/,
        /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/,
        /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/
    ];
    
    const transactionPatterns = [
        /\b\d+\s*(ribu|rb|juta|jt|rupiah|rp)\b/,
        /rp\s*\d+/,
        /^(beli|buat|bayar)\s+\w+/
    ];
    
    console.log(`\nDebugging: "${prompt}"`);
    
    informationQueryPatterns.forEach((pattern, i) => {
        const match = pattern.test(normalizedPrompt);
        console.log(`   Info Pattern ${i+1}: ${match ? '✅' : '❌'}`);
    });
    
    transactionPatterns.forEach((pattern, i) => {
        const match = pattern.test(normalizedPrompt);
        console.log(`   Transaction Pattern ${i+1}: ${match ? '✅' : '❌'}`);
    });
    
    const isInformationQuery = informationQueryPatterns.some(pattern => pattern.test(normalizedPrompt));
    const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    console.log(`   → isInformationQuery: ${isInformationQuery}`);
    console.log(`   → isTransaction: ${isTransaction}`);
    console.log(`   → Result: ${isInformationQuery && !isTransaction ? 'QUERY' : 'TRANSACTION'}`);
    
    return isInformationQuery && !isTransaction;
}

console.log('\n=== FULL LOGIC TEST ===');
testStrings.forEach(testString => {
    debugIsFinanceQuery(testString);
    console.log();
});
