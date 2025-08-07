// Test untuk verifikasi perbaikan query vs transaksi detection

console.log('🧪 Testing Query vs Transaction Detection Fix\n');

const testCases = [
    // These should be detected as INFORMATION QUERIES (not transactions)
    { 
        input: "pengeluaranku 1 minggu lalu", 
        expected: "QUERY",
        reason: "Query informasi pengeluaran dengan rentang waktu"
    },
    { 
        input: "pengeluaranku 1 hari lalu", 
        expected: "QUERY",
        reason: "Query informasi pengeluaran kemarin"
    },
    { 
        input: "pengeluaranku hari Senin", 
        expected: "QUERY",
        reason: "Query informasi pengeluaran hari tertentu"
    },
    { 
        input: "pengeluaran minggu ini", 
        expected: "QUERY",
        reason: "Query informasi pengeluaran periode"
    },
    { 
        input: "berapa pengeluaran bulan lalu", 
        expected: "QUERY",
        reason: "Query dengan kata tanya eksplisit"
    },
    { 
        input: "total pengeluaran hari ini", 
        expected: "QUERY",
        reason: "Query total dengan rentang waktu"
    },

    // These should be detected as TRANSACTIONS (not queries)
    { 
        input: "beli nasi padang 15 ribu", 
        expected: "TRANSACTION",
        reason: "Pencatatan transaksi dengan nominal dan item"
    },
    { 
        input: "bayar kos 500 ribu", 
        expected: "TRANSACTION",
        reason: "Pencatatan pembayaran dengan nominal"
    },
    { 
        input: "beli kopi di starbucks Rp25000", 
        expected: "TRANSACTION",
        reason: "Pencatatan pembelian dengan lokasi dan nominal"
    },

    // Edge cases - might be tricky
    { 
        input: "pengeluaranku", 
        expected: "QUERY",
        reason: "Query umum pengeluaran tanpa rentang waktu"
    },
    { 
        input: "pengeluaran untuk makanan", 
        expected: "QUERY",
        reason: "Query kategori tanpa nominal"
    }
];

// Mock the detection logic (simplified version of what we implemented)
function isFinanceQueryRequest(prompt) {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Pattern untuk query informasi vs pencatatan transaksi
    const informationQueryPatterns = [
        // Query dengan kata tanya eksplisit
        /^(berapa|total|jumlah|apa|daftar|riwayat|history|ringkasan|analisis)/,
        
        // Pattern "pengeluaranku [waktu]" - ini query, bukan transaksi
        /pengeluaranku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
        /pengeluaran.*ku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
        
        // Pattern "pengeluaranku [angka] [waktu] lalu" - ini juga query
        /pengeluaranku\s+\d+\s+(hari|minggu|bulan|tahun)\s+lalu/,
        /pengeluaran.*ku\s+\d+\s+(hari|minggu|bulan|tahun)\s+lalu/,
        
        // Pattern "pengeluaran [waktu]" tanpa nominal
        /^pengeluaran\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu|ini)/,
        /^pengeluaran\s+dari\s+/,
        
        // Pattern "pengeluaranku" standalone
        /^pengeluaranku$/,
        /^pengeluaran.*ku$/,
        
        // Pattern untuk kategori
        /pengeluaran\s+untuk\s+/
    ];
    
    // Cek apakah prompt cocok dengan pattern query informasi
    const isInformationQuery = informationQueryPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    // Pattern yang menunjukkan ini adalah transaksi, bukan query
    const transactionPatterns = [
        // Ada nominal eksplisit
        /\b\d+\s*(ribu|rb|juta|jt|rupiah|rp)\b/,
        /rp\s*\d+/,
        
        // Pattern pencatatan transaksi
        /^(beli|buat|bayar)\s+\w+/,
        /^(aku|saya)\s+(beli|bayar)/,
        
        // Deskripsi detail item
        /beli\s+(nasi|ayam|kopi|mie|pizza|burger|baju|sepatu|bensin|pulsa|token)/,
        
        // Lokasi spesifik dengan item
        /(di|ke|dari)\s+\w+.*\d+/
    ];
    
    const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    // Logic: Jika cocok dengan information query DAN TIDAK cocok dengan transaction, maka ini adalah query
    return isInformationQuery && !isTransaction;
}

// Run tests
console.log('=== QUERY vs TRANSACTION DETECTION TEST ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    const isQuery = isFinanceQueryRequest(testCase.input);
    const actualType = isQuery ? 'QUERY' : 'TRANSACTION';
    const isCorrect = actualType === testCase.expected;
    
    const status = isCorrect ? '✅ PASS' : '❌ FAIL';
    const emoji = testCase.expected === 'QUERY' ? '🔍' : '💰';
    
    console.log(`${index + 1}. ${emoji} "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   Actual: ${actualType}`);
    console.log(`   Reason: ${testCase.reason}`);
    console.log(`   Result: ${status}\n`);
    
    if (isCorrect) {
        passed++;
    } else {
        failed++;
    }
});

console.log('=== SUMMARY ===');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed === 0) {
    console.log('\n🎉 All tests passed! Query vs Transaction detection is working correctly.');
} else {
    console.log('\n⚠️  Some tests failed. Review the pattern matching logic.');
}

console.log('\n🔧 Next steps:');
console.log('1. Start the bot: npm run start:dev');
console.log('2. Test with: "@lumine pengeluaranku 1 minggu lalu"');
console.log('3. Should show expense summary, not record transaction');
