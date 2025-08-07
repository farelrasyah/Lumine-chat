// TEST: Message Processing Priority Order
console.log("🔄 TESTING MESSAGE PROCESSING PRIORITY ORDER");
console.log("=" .repeat(60));

// Mock functions from message-processor.service.ts
function isFinanceQueryRequest(prompt) {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  const informationQueryPatterns = [
    /^(berapa|total|jumlah|apa|daftar|riwayat|history|ringkasan|analisis)/,
    /pengeluaranku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
    /pengeluaran.*ku\s+(hari|minggu|bulan|tahun|kemarin|tadi|lalu)/,
    // ... other patterns
    /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/,
    /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/,
    /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/,
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

function isBudgetCommand(prompt) {
  const budgetKeywords = [
    'budget', 'anggaran', 'batas', 'limit',
    'set batas', 'buat budget', 'atur anggaran',
    'status budget', 'cek budget', 'budget saya',
    'saran budget', 'rekomendasi budget'
  ];

  const normalizedPrompt = prompt.toLowerCase();
  
  const budgetSetPatterns = [
    /set\s+batas\s+(bulanan|mingguan|harian)/,
    /budget\s+\w+\s+\d+/,
    /batas\s+pengeluaran/,
    /anggaran\s+\w+\s+\d+/
  ];
  
  if (budgetSetPatterns.some(pattern => pattern.test(normalizedPrompt))) {
    return true;
  }
  
  return budgetKeywords.some(keyword => normalizedPrompt.includes(keyword));
}

// Simulate message processing flow
function simulateMessageProcessing(prompt) {
  console.log(`\n📥 Processing: "${prompt}"`);
  
  // PRIORITAS 1: Finance Query
  if (isFinanceQueryRequest(prompt)) {
    console.log("  ✅ PRIORITAS 1: Detected as FINANCE QUERY");
    return "FINANCE_QUERY";
  }
  
  // PRIORITAS 2: Budget Command  
  if (isBudgetCommand(prompt)) {
    console.log("  ✅ PRIORITAS 2: Detected as BUDGET COMMAND");
    return "BUDGET_COMMAND";
  }
  
  // PRIORITAS 3: Transaction
  console.log("  ✅ PRIORITAS 3: Processing as TRANSACTION");
  return "TRANSACTION";
}

// Test cases that were problematic
const testCases = [
  {
    input: "budget makanan 500 ribu per bulan",
    expected: "BUDGET_COMMAND",
    description: "Budget command yang sebelumnya jadi transaction"
  },
  {
    input: "set batas bulanan 2 juta",
    expected: "BUDGET_COMMAND", 
    description: "Set budget command"
  },
  {
    input: "pengeluaranku dari tanggal 1 sampai tanggal 7",
    expected: "FINANCE_QUERY",
    description: "Date range query yang sebelumnya jadi transaction"
  },
  {
    input: "beli nasi padang 15 ribu",
    expected: "TRANSACTION",
    description: "Normal transaction - should still work"
  },
  {
    input: "total pengeluaran bulan ini",
    expected: "FINANCE_QUERY",
    description: "Finance information query"
  },
  {
    input: "anggaran transportasi 300 ribu mingguan", 
    expected: "BUDGET_COMMAND",
    description: "Weekly budget setting"
  }
];

console.log("\n🧪 RUNNING PRIORITY TESTS:");

let passed = 0;
let total = testCases.length;

testCases.forEach((testCase, index) => {
  const actual = simulateMessageProcessing(testCase.input);
  const isPass = actual === testCase.expected;
  
  if (isPass) passed++;
  
  console.log(`\n${index + 1}. ${isPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Input: "${testCase.input}"`);
  console.log(`   Expected: ${testCase.expected}`);
  console.log(`   Actual: ${actual}`);
  console.log(`   Description: ${testCase.description}`);
});

console.log("\n" + "=" .repeat(60));
console.log(`🎯 RESULTS: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);

if (passed === total) {
  console.log("\n🎉 ALL PRIORITY TESTS PASSED!");
  console.log("✅ Budget commands will be processed BEFORE transaction parsing");
  console.log("✅ Date range queries will be processed BEFORE transaction parsing");
  console.log("✅ Normal transactions will still work as expected");
} else {
  console.log(`\n❌ ${total - passed} tests failed. Priority order needs adjustment.`);
}

console.log("\n📋 PROCESSING ORDER:");
console.log("1. 🔍 Finance Query Detection (informational queries)");  
console.log("2. 💰 Budget Command Detection (budget/anggaran/batas)");
console.log("3. 📝 Transaction Processing (everything else)");
console.log("\nThis should fix the issue where budget commands were being saved as transactions!");
