// TEST: Budget Alert System
console.log("🚨 TESTING BUDGET ALERT SYSTEM");
console.log("=" .repeat(60));

// Mock budget alert logic from message-processor.service.ts
function mockCheckBudgetAlert(pengirim, kategori, transactionAmount, mockData) {
  const { budgetLimit, previousSpent } = mockData;
  
  if (!budgetLimit) {
    return null; // No budget set
  }

  const totalSpent = previousSpent + transactionAmount;
  const currentPercentage = Math.round((totalSpent / budgetLimit) * 100);
  const remainingBudget = budgetLimit - totalSpent;
  
  console.log(`  📊 Budget Analysis:`);
  console.log(`     Previous Spent: Rp${previousSpent.toLocaleString('id-ID')}`);
  console.log(`     New Transaction: Rp${transactionAmount.toLocaleString('id-ID')}`);
  console.log(`     Total Spent: Rp${totalSpent.toLocaleString('id-ID')}`);
  console.log(`     Budget Limit: Rp${budgetLimit.toLocaleString('id-ID')}`);
  console.log(`     Percentage Used: ${currentPercentage}%`);
  console.log(`     Remaining: Rp${remainingBudget.toLocaleString('id-ID')}`);
  
  if (totalSpent > budgetLimit) {
    // 🚨 Budget exceeded
    const overAmount = totalSpent - budgetLimit;
    return `🚨 **PERINGATAN ANGGARAN!**\n\nKamu telah **melebihi** anggaran ${kategori} bulan ini!\n💸 **Total Pengeluaran:** Rp${totalSpent.toLocaleString('id-ID')}\n💰 **Anggaran:** Rp${budgetLimit.toLocaleString('id-ID')}\n📊 **Kelebihan:** Rp${overAmount.toLocaleString('id-ID')} (${currentPercentage}%)\n\n⚠️ *Pertimbangkan untuk lebih hemat di kategori ini!*`;
    
  } else if (currentPercentage >= 80) {
    // ⚠️ Warning: approaching limit (80%+)
    return `⚠️ **PERINGATAN ANGGARAN!**\n\nAnggaran ${kategori} kamu hampir habis!\n💸 **Total Pengeluaran:** Rp${totalSpent.toLocaleString('id-ID')}\n💰 **Anggaran:** Rp${budgetLimit.toLocaleString('id-ID')}\n📊 **Sisa:** Rp${remainingBudget.toLocaleString('id-ID')} (${100-currentPercentage}%)\n\n💡 *Sisanya cukup untuk ${Math.floor(remainingBudget / (totalSpent / 30))} hari lagi.*`;
    
  } else if (currentPercentage >= 50) {
    // 💡 Info: halfway point (50%+)
    return `💡 **INFO ANGGARAN**\n\nKamu sudah menggunakan ${currentPercentage}% anggaran ${kategori} bulan ini.\n💸 **Terpakai:** Rp${totalSpent.toLocaleString('id-ID')}\n💰 **Anggaran:** Rp${budgetLimit.toLocaleString('id-ID')}\n📊 **Sisa:** Rp${remainingBudget.toLocaleString('id-ID')}\n\n✅ *Masih dalam batas aman.*`;
  }
  
  // No alert needed if under 50%
  return null;
}

// Test cases for different budget scenarios
const testCases = [
  {
    scenario: "No Budget Set",
    pengirim: "farelrasyah | RPL A",
    kategori: "Makanan", 
    transactionAmount: 25000,
    mockData: { budgetLimit: null, previousSpent: 0 },
    expectedAlert: null,
    description: "User belum set budget untuk kategori ini"
  },
  {
    scenario: "Under 50% Usage - No Alert",
    pengirim: "farelrasyah | RPL A", 
    kategori: "Makanan",
    transactionAmount: 50000,
    mockData: { budgetLimit: 500000, previousSpent: 150000 },
    expectedAlert: null,
    description: "Total 200k dari 500k budget (40%) - masih aman"
  },
  {
    scenario: "50-79% Usage - Info Alert",
    pengirim: "farelrasyah | RPL A",
    kategori: "Makanan", 
    transactionAmount: 50000,
    mockData: { budgetLimit: 500000, previousSpent: 250000 },
    expectedAlert: "INFO",
    description: "Total 300k dari 500k budget (60%) - info"
  },
  {
    scenario: "80-99% Usage - Warning Alert", 
    pengirim: "farelrasyah | RPL A",
    kategori: "Makanan",
    transactionAmount: 50000,
    mockData: { budgetLimit: 500000, previousSpent: 370000 },
    expectedAlert: "WARNING",
    description: "Total 420k dari 500k budget (84%) - peringatan"
  },
  {
    scenario: "Over 100% Usage - Exceeded Alert",
    pengirim: "farelrasyah | RPL A",
    kategori: "Makanan",
    transactionAmount: 100000,
    mockData: { budgetLimit: 500000, previousSpent: 450000 },
    expectedAlert: "EXCEEDED", 
    description: "Total 550k dari 500k budget (110%) - melebihi"
  },
  {
    scenario: "Transportation Budget Test",
    pengirim: "farelrasyah | RPL A",
    kategori: "Transportasi",
    transactionAmount: 25000,
    mockData: { budgetLimit: 200000, previousSpent: 160000 },
    expectedAlert: "WARNING",
    description: "Total 185k dari 200k budget (92.5%) - hampir habis"
  }
];

console.log("\n🧪 RUNNING BUDGET ALERT TESTS:");

let passed = 0;
let total = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. 🔍 Testing: ${testCase.scenario}`);
  console.log(`   Transaction: Rp${testCase.transactionAmount.toLocaleString('id-ID')} for ${testCase.kategori}`);
  
  const alert = mockCheckBudgetAlert(
    testCase.pengirim,
    testCase.kategori, 
    testCase.transactionAmount,
    testCase.mockData
  );
  
  let alertType = null;
  if (alert === null) {
    alertType = null;
  } else if (alert.includes('🚨')) {
    alertType = "EXCEEDED";
  } else if (alert.includes('⚠️')) {
    alertType = "WARNING";
  } else if (alert.includes('💡')) {
    alertType = "INFO";
  }
  
  const isPass = alertType === testCase.expectedAlert;
  passed += isPass ? 1 : 0;
  
  console.log(`   Expected: ${testCase.expectedAlert || 'No Alert'}`);
  console.log(`   Actual: ${alertType || 'No Alert'}`);
  console.log(`   Result: ${isPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Description: ${testCase.description}`);
  
  if (alert) {
    console.log(`   📱 Alert Message Preview:`);
    console.log(`${alert.split('\n').map(line => `        ${line}`).join('\n')}`);
  }
});

console.log("\n" + "=" .repeat(60));
console.log(`🎯 RESULTS: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);

if (passed === total) {
  console.log("\n🎉 ALL BUDGET ALERT TESTS PASSED!");
  console.log("✅ Budget alerts will trigger at appropriate thresholds");
  console.log("✅ Messages are user-friendly and informative");  
  console.log("✅ Different alert levels working correctly");
} else {
  console.log(`\n❌ ${total - passed} tests failed. Budget alert logic needs adjustment.`);
}

console.log("\n📋 ALERT THRESHOLDS:");
console.log("• 0-49%: 😊 No alert (safe zone)");
console.log("• 50-79%: 💡 Info alert (awareness)");  
console.log("• 80-99%: ⚠️ Warning alert (caution)");
console.log("• 100%+: 🚨 Exceeded alert (over budget)");
