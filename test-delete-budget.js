// TEST: Budget Delete Feature
console.log("🗑️ TESTING BUDGET DELETE FUNCTIONALITY");
console.log("=" .repeat(60));

// Mock functions from message-processor.service.ts
function isBudgetCommand(prompt) {
  const budgetKeywords = [
    'budget', 'anggaran', 'batas', 'limit',
    'set batas', 'buat budget', 'atur anggaran',
    'status budget', 'cek budget', 'budget saya',
    'saran budget', 'rekomendasi budget',
    // DELETE BUDGET KEYWORDS
    'hapus anggaran', 'hapus budget', 'hapus batas',
    'batalkan anggaran', 'batalkan budget', 'batalkan batas',
    'delete budget', 'remove budget', 'clear budget'
  ];

  const normalizedPrompt = prompt.toLowerCase();
  
  const budgetSetPatterns = [
    /set\s+batas\s+(bulanan|mingguan|harian)/,
    /budget\s+\w+\s+\d+/,
    /batas\s+pengeluaran/,
    /anggaran\s+\w+\s+\d+/
  ];
  
  // DELETE BUDGET PATTERNS
  const budgetDeletePatterns = [
    /hapus\s+(anggaran|budget|batas)/,
    /batalkan\s+(anggaran|budget|batas)/,
    /(delete|remove|clear)\s+budget/
  ];
  
  if (budgetSetPatterns.some(pattern => pattern.test(normalizedPrompt))) {
    return true;
  }
  
  if (budgetDeletePatterns.some(pattern => pattern.test(normalizedPrompt))) {
    return true;
  }
  
  return budgetKeywords.some(keyword => normalizedPrompt.includes(keyword));
}

function isBudgetDeleteCommand(normalizedPrompt) {
  const deleteBudgetPatterns = [
    /hapus\s+(anggaran|budget|batas)/,
    /batalkan\s+(anggaran|budget|batas)/,
    /(delete|remove|clear)\s+budget/,
    /hapus.*budget/,
    /hapus.*anggaran/,
    /hapus.*batas/
  ];
  
  return deleteBudgetPatterns.some(pattern => pattern.test(normalizedPrompt));
}

function parseBudgetDeleteCommand(prompt) {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  // Check if user wants to delete all budgets
  if (normalizedPrompt.includes('bulan ini') || normalizedPrompt.includes('semua') || normalizedPrompt.includes('all')) {
    return { deleteAll: true };
  }
  
  // Extract kategori
  let kategori;
  const kategoriPatterns = [
    { pattern: /(makanan|makan|food)/i, kategori: 'Makanan' },
    { pattern: /(transport|transportasi|bensin|ojek|grab|taxi)/i, kategori: 'Transportasi' },
    { pattern: /(belanja|shopping|baju|pakaian)/i, kategori: 'Belanja' },
    { pattern: /(hiburan|entertainment|nonton|bioskop|game)/i, kategori: 'Hiburan' },
    { pattern: /(kesehatan|obat|dokter|rumah\s*sakit)/i, kategori: 'Kesehatan' },
    { pattern: /(pendidikan|sekolah|kuliah|kursus|buku)/i, kategori: 'Pendidikan' },
    { pattern: /(tagihan|listrik|air|internet|pulsa)/i, kategori: 'Tagihan' }
  ];
  
  for (const { pattern, kategori: kat } of kategoriPatterns) {
    if (pattern.test(normalizedPrompt)) {
      kategori = kat;
      break;
    }
  }
  
  // Special case for "batas pengeluaran"
  if (normalizedPrompt.includes('batas pengeluaran') && !kategori) {
    kategori = 'Total Pengeluaran';
  }
  
  if (!kategori) {
    // Try to extract any word after delete keywords
    const extractPattern = /(?:hapus|batalkan|delete|remove)\s+(?:anggaran|budget|batas)\s+(\w+)/;
    const match = normalizedPrompt.match(extractPattern);
    if (match) {
      kategori = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
  }
  
  return kategori ? { kategori, deleteAll: false } : null;
}

function detectCommandType(prompt) {
  const normalizedPrompt = prompt.toLowerCase();
  
  if (!isBudgetCommand(prompt)) return "NOT_BUDGET";
  
  if (isBudgetDeleteCommand(normalizedPrompt)) return "DELETE_BUDGET";
  
  // Check if it's a set command
  if (normalizedPrompt.includes('set') || /\d+/.test(normalizedPrompt)) return "SET_BUDGET";
  
  if (normalizedPrompt.includes('status') || normalizedPrompt.includes('cek')) return "STATUS_BUDGET";
  
  return "OTHER_BUDGET";
}

// Test cases
const testCases = [
  // DELETE BUDGET COMMANDS
  {
    input: "hapus anggaran makanan",
    expectedType: "DELETE_BUDGET",
    expectedParsing: { kategori: "Makanan", deleteAll: false },
    description: "Delete specific category budget"
  },
  {
    input: "hapus budget transportasi",
    expectedType: "DELETE_BUDGET", 
    expectedParsing: { kategori: "Transportasi", deleteAll: false },
    description: "Delete transportation budget"
  },
  {
    input: "batalkan batas pengeluaran makanan",
    expectedType: "DELETE_BUDGET",
    expectedParsing: { kategori: "Makanan", deleteAll: false },
    description: "Cancel food expense limit"
  },
  {
    input: "hapus budget bulan ini",
    expectedType: "DELETE_BUDGET",
    expectedParsing: { deleteAll: true },
    description: "Delete all budgets for current month"
  },
  {
    input: "hapus semua anggaran",
    expectedType: "DELETE_BUDGET",
    expectedParsing: { deleteAll: true },
    description: "Delete all budgets"
  },
  {
    input: "delete budget hiburan",
    expectedType: "DELETE_BUDGET",
    expectedParsing: { kategori: "Hiburan", deleteAll: false },
    description: "English delete command"
  },
  
  // NON-DELETE COMMANDS (should not be detected as delete)
  {
    input: "budget makanan 500 ribu per bulan",
    expectedType: "SET_BUDGET",
    expectedParsing: null,
    description: "Set budget command - should NOT be delete"
  },
  {
    input: "status budget",
    expectedType: "STATUS_BUDGET", 
    expectedParsing: null,
    description: "Status budget command"
  },
  {
    input: "beli nasi padang 15 ribu",
    expectedType: "NOT_BUDGET",
    expectedParsing: null,
    description: "Transaction command - not budget related"
  }
];

console.log("\n🧪 RUNNING DELETE BUDGET TESTS:");

let passed = 0;
let total = testCases.length;

testCases.forEach((testCase, index) => {
  const actualType = detectCommandType(testCase.input);
  const isTypeCorrect = actualType === testCase.expectedType;
  
  let isParsCorrect = true;
  let actualParsing = null;
  
  if (actualType === "DELETE_BUDGET") {
    actualParsing = parseBudgetDeleteCommand(testCase.input);
    if (testCase.expectedParsing) {
      isParsCorrect = JSON.stringify(actualParsing) === JSON.stringify(testCase.expectedParsing);
    } else {
      isParsCorrect = actualParsing === null;
    }
  }
  
  const isPass = isTypeCorrect && isParsCorrect;
  passed += isPass ? 1 : 0;
  
  console.log(`\n${index + 1}. ${isPass ? '✅ PASS' : '❌ FAIL'} "${testCase.input}"`);
  console.log(`   Expected Type: ${testCase.expectedType}`);
  console.log(`   Actual Type: ${actualType}`);
  
  if (actualType === "DELETE_BUDGET") {
    console.log(`   Expected Parsing: ${JSON.stringify(testCase.expectedParsing)}`);
    console.log(`   Actual Parsing: ${JSON.stringify(actualParsing)}`);
  }
  
  console.log(`   Description: ${testCase.description}`);
  console.log(`   Type Match: ${isTypeCorrect ? '✅' : '❌'} | Parse Match: ${isParsCorrect ? '✅' : '❌'}`);
});

console.log("\n" + "=" .repeat(60));
console.log(`🎯 RESULTS: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);

if (passed === total) {
  console.log("\n🎉 ALL DELETE BUDGET TESTS PASSED!");
  console.log("✅ Delete budget commands are detected correctly");
  console.log("✅ Category parsing works for delete commands");
  console.log("✅ 'Delete all' functionality detected properly");
  console.log("✅ Non-delete commands are not interfered");
} else {
  console.log(`\n❌ ${total - passed} tests failed. Delete budget logic needs adjustment.`);
}

console.log("\n📋 SUPPORTED DELETE FORMATS:");
console.log("• 🗑️ hapus anggaran [kategori]");
console.log("• 🗑️ hapus budget [kategori]"); 
console.log("• 🗑️ batalkan batas [kategori]");
console.log("• 🗑️ hapus budget bulan ini (delete all)");
console.log("• 🗑️ delete budget [kategori] (English)");
