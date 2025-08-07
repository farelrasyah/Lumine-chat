// TEST: Budget Command Detection and Parsing
const testCases = [
  // Budget setting commands - should be detected as BUDGET
  {
    input: "budget makanan 500 ribu per bulan",
    expected: "BUDGET",
    description: "Budget setting dengan kategori dan periode"
  },
  {
    input: "set batas bulanan 2 juta",
    expected: "BUDGET", 
    description: "Set batas pengeluaran total"
  },
  {
    input: "anggaran transportasi 200 ribu bulanan",
    expected: "BUDGET",
    description: "Set anggaran kategori transportasi"
  },
  {
    input: "batas pengeluaran mingguan 300 ribu",
    expected: "BUDGET",
    description: "Set batas mingguan"
  },
  
  // Query commands - should be detected as QUERY  
  {
    input: "pengeluaranku dari tanggal 1 sampai tanggal 7",
    expected: "QUERY",
    description: "Date range query yang sebelumnya bermasalah"
  },
  {
    input: "total pengeluaran bulan ini",
    expected: "QUERY", 
    description: "Query informasi pengeluaran"
  },
  
  // Transaction commands - should be detected as TRANSACTION
  {
    input: "beli nasi padang 15 ribu",
    expected: "TRANSACTION",
    description: "Pencatatan transaksi biasa"
  }
];

console.log("🧪 TESTING BUDGET VS QUERY VS TRANSACTION DETECTION");
console.log("=" .repeat(60));

// Mock the detection logic from message-processor.service.ts
function isBudgetCommand(prompt) {
  const budgetKeywords = [
    'budget', 'anggaran', 'batas', 'limit',
    'set batas', 'buat budget', 'atur anggaran',
    'status budget', 'cek budget', 'budget saya',
    'saran budget', 'rekomendasi budget'
  ];

  const normalizedPrompt = prompt.toLowerCase();
  
  // Prioritas tinggi: pattern yang jelas menunjukkan budget setting
  const budgetSetPatterns = [
    /set\s+batas\s+(bulanan|mingguan|harian)/,
    /budget\s+\w+\s+\d+/,
    /batas\s+pengeluaran/,
    /anggaran\s+\w+\s+\d+/
  ];
  
  // Check explicit budget patterns first
  if (budgetSetPatterns.some(pattern => pattern.test(normalizedPrompt))) {
    return true;
  }
  
  // Check budget keywords
  return budgetKeywords.some(keyword => normalizedPrompt.includes(keyword));
}

function isFinanceQueryRequest(prompt) {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  const informationQueryPatterns = [
    /^(berapa|total|jumlah|apa|daftar|riwayat|history|ringkasan|analisis)/,
    /pengeluaranku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
    /pengeluaran.*ku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
    /pengeluaranku\s+\d+\s+(hari|minggu|bulan|tahun)\s+lalu/,
    /pengeluaran.*ku\s+\d+\s+(hari|minggu|bulan|tahun)\s+lalu/,
    /^pengeluaran\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu|ini)/,
    /^pengeluaran\s+dari\s+/,
    /belanja\s+(apa|dimana|kapan)/,
    /beli\s+(apa|dimana|kapan)\s+(aja|saja)/,
    /(ada|punya)\s+data/,
    /cek\s+(pengeluaran|transaksi|saldo)/,
    /(bandingkan|banding|vs|versus)\s+(pengeluaran|belanja)/,
    /pengeluaran.*vs.*pengeluaran/,
    /(prediksi|proyeksi|estimasi|perkiraan)\s+(pengeluaran|belanja)/,
    /analisis\s+(keuangan|pengeluaran|belanja)/,
    /(tren|pola|pattern)\s+(pengeluaran|belanja)/,
    // FIXED DATE RANGE PATTERNS
    /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/,
    /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/,
    /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/,
    /selama\s+\d+\s+(hari|minggu|bulan)/
  ];

  const isInformationQuery = informationQueryPatterns.some(pattern => pattern.test(normalizedPrompt));

  const transactionPatterns = [
    /\b\d+\s*(ribu|rb|juta|jt|rupiah|rp)\b/,
    /rp\s*\d+/,
    /^(beli|buat|bayar)\s+\w+.*\d+/,
    /^(aku|saya)\s+(beli|bayar)/,
    /beli\s+(nasi|ayam|kopi|mie|pizza|burger|baju|sepatu|bensin|pulsa|token)/,
    /(di|ke)\s+\w+.*\d+/,
    /dari\s+(?!tanggal)\w+.*\d+/
  ];

  const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
  
  return isInformationQuery && !isTransaction;
}

function detectCommandType(prompt) {
  if (isBudgetCommand(prompt)) return "BUDGET";
  if (isFinanceQueryRequest(prompt)) return "QUERY";
  return "TRANSACTION";
}

// Test budget parsing
function parseBudgetCommand(prompt) {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  // Extract nominal
  let nominal = 0;
  const nominalPatterns = [
    /(\d+)\s*(juta|jt)/,
    /(\d+)\s*(ribu|rb|k)/,
    /(\d+)\s*(rp|rupiah)/,
    /(\d+)/
  ];
  
  for (const pattern of nominalPatterns) {
    const match = normalizedPrompt.match(pattern);
    if (match) {
      const number = parseInt(match[1]);
      if (match[2]?.includes('juta') || match[2]?.includes('jt')) {
        nominal = number * 1000000;
      } else if (match[2]?.includes('ribu') || match[2]?.includes('rb') || match[2]?.includes('k')) {
        nominal = number * 1000;
      } else {
        nominal = number;
      }
      break;
    }
  }
  
  // Extract periode
  let periode = 'bulanan';
  if (normalizedPrompt.includes('mingguan') || normalizedPrompt.includes('minggu')) {
    periode = 'mingguan';
  } else if (normalizedPrompt.includes('harian') || normalizedPrompt.includes('hari')) {
    periode = 'harian';
  }
  
  // Extract kategori
  let kategori = 'Umum';
  const kategoriPatterns = [
    { pattern: /(makanan|makan|food)/i, kategori: 'Makanan' },
    { pattern: /(transport|transportasi|bensin|ojek|grab|taxi)/i, kategori: 'Transportasi' },
    { pattern: /(belanja|shopping|baju|pakaian)/i, kategori: 'Belanja' },
    { pattern: /(hiburan|entertainment|nonton|bioskop|game)/i, kategori: 'Hiburan' }
  ];
  
  for (const { pattern, kategori: kat } of kategoriPatterns) {
    if (pattern.test(normalizedPrompt)) {
      kategori = kat;
      break;
    }
  }
  
  if (normalizedPrompt.includes('set batas') || normalizedPrompt.includes('batas pengeluaran')) {
    kategori = 'Total Pengeluaran';
  }
  
  return nominal > 0 ? { kategori, nominal, periode } : null;
}

// Run tests
testCases.forEach((testCase, index) => {
  const actual = detectCommandType(testCase.input);
  const isPass = actual === testCase.expected;
  
  console.log(`${index + 1}. ${isPass ? '✅' : '❌'} "${testCase.input}"`);
  console.log(`   Expected: ${testCase.expected}`);
  console.log(`   Actual: ${actual}`);
  console.log(`   Description: ${testCase.description}`);
  
  // For budget commands, also show parsing result
  if (actual === "BUDGET") {
    const parsed = parseBudgetCommand(testCase.input);
    if (parsed) {
      console.log(`   📊 Parsed: ${parsed.kategori} - Rp${parsed.nominal.toLocaleString('id-ID')} (${parsed.periode})`);
    }
  }
  
  console.log();
});

console.log("🎯 SUMMARY:");
const passed = testCases.filter((testCase, index) => detectCommandType(testCase.input) === testCase.expected).length;
const total = testCases.length;
console.log(`✅ Passed: ${passed}/${total} (${Math.round(passed/total*100)}%)`);

if (passed === total) {
  console.log("\n🎉 ALL TESTS PASSED! Budget detection is working correctly!");
} else {
  console.log(`\n❌ ${total - passed} tests failed. Need to fix detection logic.`);
}
