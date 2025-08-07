// Test untuk verifikasi perbaikan date range detection

console.log('🧪 Testing Date Range Query Detection Fix\n');

// Mock the detection logic with updated patterns
function isFinanceQueryRequest(prompt) {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Pattern untuk query informasi vs pencatatan transaksi
    const informationQueryPatterns = [
        // Query dengan kata tanya eksplisit
        /^(berapa|total|jumlah|apa|daftar|riwayat|history|ringkasan|analisis)/,
        
        // Pattern "pengeluaranku [waktu]" - ini query, bukan transaksi
        /pengeluaranku\s+(\d+\s+)?(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
        /pengeluaran.*ku\s+(\d+\s+)?(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
        
        // Pattern "pengeluaran [waktu]" tanpa nominal
        /^pengeluaran\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu|ini)/,
        /^pengeluaran\s+dari\s+/,
        
        // Pattern untuk rentang tanggal - FIXED PATTERNS
        /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/,
        /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/,
        /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/,
        
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
        
        // Lokasi spesifik dengan item (EXCLUDE date ranges)
        /(di|ke)\s+\w+.*\d+/,  // Removed 'dari' to avoid conflicting with date ranges
        /dari\s+(?!tanggal)\w+.*\d+/  // Only match 'dari' if NOT followed by 'tanggal'
    ];
    
    const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
    
    // Debug logging
    console.log(`   Debug for "${prompt}":`, { isInformationQuery, isTransaction });
    
    // Logic: Jika cocok dengan information query DAN TIDAK cocok dengan transaction, maka ini adalah query
    return isInformationQuery && !isTransaction;
}

// Mock enhanced date parsing untuk range tanggal
function parseTimeExpression(text) {
    const normalizedText = text.toLowerCase().trim();
    
    // Range tanggal dalam bulan ini: dari tanggal X sampai tanggal Y
    const dateRangeMatch = normalizedText.match(/dari\s+(tanggal\s+)?(\d+)\s+(sampai|hingga)\s+(tanggal\s+)?(\d+)/);
    if (dateRangeMatch) {
        const startDay = parseInt(dateRangeMatch[2]);
        const endDay = parseInt(dateRangeMatch[5]);
        // Assume current month is August 2025
        const currentMonth = 8;
        const currentYear = 2025;

        return {
            type: 'range',
            rangeStart: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`,
            rangeEnd: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`
        };
    }

    // Range tanggal dengan format "antara...dan"
    const betweenRangeMatch = normalizedText.match(/antara\s+(tanggal\s+)?(\d+)\s+(dan|sampai|hingga)\s+(tanggal\s+)?(\d+)/);
    if (betweenRangeMatch) {
        const startDay = parseInt(betweenRangeMatch[2]);
        const endDay = parseInt(betweenRangeMatch[5]);
        // Assume current month is August 2025
        const currentMonth = 8;
        const currentYear = 2025;

        return {
            type: 'range',
            rangeStart: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`,
            rangeEnd: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`
        };
    }
    
    return null;
}

const testCases = [
    // Problematic cases that should be QUERIES (not transactions)
    { 
        input: "pengeluaranku dari tanggal 1 sampai tanggal 7", 
        expected: "QUERY",
        reason: "Query rentang tanggal dalam bulan ini"
    },
    { 
        input: "pengeluaran dari tanggal 5 sampai tanggal 10", 
        expected: "QUERY",
        reason: "Query rentang tanggal dengan format berbeda"
    },
    { 
        input: "dari tanggal 1 hingga tanggal 15", 
        expected: "QUERY",
        reason: "Query rentang dengan kata 'hingga'"
    },
    { 
        input: "antara tanggal 20 dan tanggal 25", 
        expected: "QUERY",
        reason: "Query rentang dengan format 'antara...dan'"
    },
    
    // Should still work as before
    { 
        input: "pengeluaranku 1 minggu lalu", 
        expected: "QUERY",
        reason: "Query informasi pengeluaran dengan rentang waktu"
    },
    { 
        input: "pengeluaranku hari Senin", 
        expected: "QUERY",
        reason: "Query informasi pengeluaran hari tertentu"
    },
    
    // Should still be transactions
    { 
        input: "beli nasi padang 15 ribu", 
        expected: "TRANSACTION",
        reason: "Pencatatan transaksi dengan nominal dan item"
    },
    { 
        input: "bayar dari tanggal 1 sampai tanggal 7 sebesar 50 ribu", 
        expected: "TRANSACTION",
        reason: "Ada nominal eksplisit, ini transaksi meskipun ada rentang tanggal"
    }
];

// Run tests
console.log('=== DATE RANGE QUERY DETECTION TEST ===\n');

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
    console.log(`   Result: ${status}`);
    
    // Test date parsing for queries
    if (testCase.expected === 'QUERY' && testCase.input.includes('tanggal')) {
        const timeContext = parseTimeExpression(testCase.input);
        if (timeContext && timeContext.type === 'range') {
            console.log(`   📅 Parsed Range: ${timeContext.rangeStart} to ${timeContext.rangeEnd}`);
        } else {
            console.log(`   ⚠️  Date parsing failed`);
        }
    }
    
    console.log();
    
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
    console.log('\n🎉 All tests passed! Date range query detection is working correctly.');
    console.log('\n📅 Expected behavior for "pengeluaranku dari tanggal 1 sampai tanggal 7":');
    console.log('   → Should be detected as QUERY');
    console.log('   → Should parse date range: 2025-08-01 to 2025-08-07');
    console.log('   → Should return expense summary, not create transaction');
} else {
    console.log('\n⚠️  Some tests failed. Review the pattern matching logic.');
}

console.log('\n🔧 Next steps:');
console.log('1. Start the bot: npm run start:dev');
console.log('2. Test with: "@lumine pengeluaranku dari tanggal 1 sampai tanggal 7"');
console.log('3. Should show expense summary for Aug 1-7, not create transaction');
