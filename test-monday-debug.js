/**
 * Test script untuk debug masalah parsing "hari Senin"
 * Menggunakan approach sederhana tanpa import TypeScript
 */

// Mock dayjs functionality
function mockDayjs() {
  const now = new Date('2025-08-07'); // Hari ini adalah Kamis, 7 Agustus 2025
  
  console.log('=== TEST PARSING "HARI SENIN" ===');
  console.log(`Tanggal sekarang: ${now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log(`Hari dalam angka: ${now.getDay()} (0=Minggu, 1=Senin, 2=Selasa, dst)`);
  
  // Hari Senin dalam minggu ini adalah 4 Agustus 2025
  const mondayThisWeek = new Date('2025-08-04');
  console.log(`\nHari Senin minggu ini: ${mondayThisWeek.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log(`Target date untuk query: ${mondayThisWeek.getFullYear()}-${String(mondayThisWeek.getMonth() + 1).padStart(2, '0')}-${String(mondayThisWeek.getDate()).padStart(2, '0')}`);
  
  return {
    targetDate: `${mondayThisWeek.getFullYear()}-${String(mondayThisWeek.getMonth() + 1).padStart(2, '0')}-${String(mondayThisWeek.getDate()).padStart(2, '0')}`,
    expectedResult: "Tidak ada transaksi yang tercatat pada hari Senin (04 Agustus 2025)"
  };
}

// Test regex pattern matching
function testPatternMatching() {
  console.log('\n=== TEST PATTERN MATCHING ===');
  
  const testQuery = "pengeluaranku hari senin";
  console.log(`Query: "${testQuery}"`);
  
  // Test enhanced patterns
  const enhancedPatterns = [
    /pengeluaranku/,
    /pengeluaran.*ku/,
    /ku.*pengeluaran/,
    /pengeluaran.*hari/,
    /hari.*pengeluaran/,
  ];
  
  console.log('\nTesting enhanced patterns:');
  enhancedPatterns.forEach((pattern, index) => {
    const match = pattern.test(testQuery);
    console.log(`Pattern ${index + 1}: ${pattern} -> ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
  });
  
  // Test day parsing
  const dayMatch = testQuery.match(/hari\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu|ahad)/);
  console.log(`\nDay extraction: ${dayMatch ? `✅ Found "${dayMatch[1]}"` : '❌ No day found'}`);
  
  return dayMatch ? dayMatch[1] : null;
}

// Test date calculation
function testDateCalculation() {
  console.log('\n=== TEST DATE CALCULATION ===');
  
  const today = new Date('2025-08-07'); // Kamis
  const todayDayOfWeek = today.getDay(); // 4 (Kamis)
  const targetDayOfWeek = 1; // Senin
  
  console.log(`Today is day ${todayDayOfWeek} (${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][todayDayOfWeek]})`);
  console.log(`Target is day ${targetDayOfWeek} (Senin)`);
  
  // Calculate days back to Monday
  let daysBack = (todayDayOfWeek - targetDayOfWeek + 7) % 7;
  if (daysBack === 0) daysBack = 7; // If same day, go to last week's occurrence
  
  console.log(`Days back to Monday: ${daysBack}`);
  
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() - daysBack);
  
  const mondayFormatted = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;
  
  console.log(`Calculated Monday date: ${mondayFormatted}`);
  console.log(`Monday formatted: ${mondayDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  
  return mondayFormatted;
}

// Mock database query simulation
function simulateDatabaseQuery(pengirim, startDate, endDate) {
  console.log('\n=== SIMULATE DATABASE QUERY ===');
  console.log(`Query: SELECT * FROM transactions WHERE pengirim='${pengirim}' AND tanggal BETWEEN '${startDate}' AND '${endDate}'`);
  
  // Simulate no transactions on Monday
  const mockTransactions = [
    { tanggal: '2025-08-05', kategori: 'Makanan', nominal: 15000, deskripsi: 'Nasi Padang' }, // Selasa
    { tanggal: '2025-08-06', kategori: 'Belanja', nominal: 130000, deskripsi: 'Belanja bulanan' }, // Rabu
    { tanggal: '2025-08-07', kategori: 'Lainnya', nominal: 19000, deskripsi: 'Parkir' }, // Kamis (hari ini)
  ];
  
  // Filter transactions for the specific date
  const filteredTransactions = mockTransactions.filter(t => t.tanggal >= startDate && t.tanggal <= endDate);
  
  console.log(`Found ${filteredTransactions.length} transactions for ${startDate}:`);
  filteredTransactions.forEach(t => {
    console.log(`  - ${t.tanggal}: ${t.deskripsi} (${t.kategori}) - Rp ${t.nominal.toLocaleString('id-ID')}`);
  });
  
  return filteredTransactions;
}

// Main test function
function runTest() {
  console.log('🔧 DEBUGGING: Query "pengeluaranku hari Senin"\n');
  
  // Step 1: Mock current situation
  const mockResult = mockDayjs();
  
  // Step 2: Test pattern matching
  const extractedDay = testPatternMatching();
  
  // Step 3: Test date calculation
  const calculatedDate = testDateCalculation();
  
  // Step 4: Simulate database query
  const transactions = simulateDatabaseQuery('user123', calculatedDate, calculatedDate);
  
  // Step 5: Expected result
  console.log('\n=== EXPECTED RESULT ===');
  if (transactions.length === 0) {
    console.log('✅ CORRECT: Should return "Tidak ada transaksi yang tercatat pada hari Senin (04 Agustus 2025)"');
  } else {
    console.log('❌ ERROR: Found transactions when there should be none');
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Query: "pengeluaranku hari senin"`);
  console.log(`Pattern matching: ${extractedDay ? '✅' : '❌'}`);
  console.log(`Date parsing: ${calculatedDate === mockResult.targetDate ? '✅' : '❌'}`);
  console.log(`Database query: ${transactions.length === 0 ? '✅' : '❌'}`);
  console.log(`Expected behavior: ${transactions.length === 0 ? '✅ CORRECT' : '❌ INCORRECT'}`);
  
  console.log('\n🎯 DIAGNOSIS:');
  if (extractedDay && calculatedDate === mockResult.targetDate && transactions.length === 0) {
    console.log('✅ All components working correctly');
    console.log('📋 The issue might be in the advanced parser not detecting this pattern');
    console.log('📋 Or in the response service not handling empty results properly');
  } else {
    if (!extractedDay) console.log('❌ Pattern matching failed - need to update regex');
    if (calculatedDate !== mockResult.targetDate) console.log('❌ Date calculation failed - fix algorithm');
    if (transactions.length > 0) console.log('❌ Mock data contaminated - clean test data');
  }
}

// Run the test
runTest();
