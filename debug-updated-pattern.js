// DEBUG: Test UPDATED Pattern Detection
const prompt = "pengeluaranku dari tanggal 1 sampai tanggal 7";
const normalizedPrompt = prompt.toLowerCase().trim();

console.log("🔍 DEBUGGING UPDATED PATTERN DETECTION");
console.log("Original prompt:", prompt);
console.log("Normalized prompt:", normalizedPrompt);
console.log("");

// UPDATED informationQueryPatterns with proper date range detection
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
  
  // Pattern informational lainnya  
  /belanja\s+(apa|dimana|kapan)/,
  /beli\s+(apa|dimana|kapan)\s+(aja|saja)/,
  /(ada|punya)\s+data/,
  /cek\s+(pengeluaran|transaksi|saldo)/,
  
  // Pattern perbandingan
  /(bandingkan|banding|vs|versus)\s+(pengeluaran|belanja)/,
  /pengeluaran.*vs.*pengeluaran/,
  
  // Pattern prediksi & analisis
  /(prediksi|proyeksi|estimasi|perkiraan)\s+(pengeluaran|belanja)/,
  /analisis\s+(keuangan|pengeluaran|belanja)/,
  /(tren|pola|pattern)\s+(pengeluaran|belanja)/,
  
  // Pattern dengan rentang waktu spesifik - DATE RANGES - UPDATED!
  /dari\s+(tanggal\s+)?\d+\s+(sampai|hingga)\s+(tanggal\s+)?\d+/,
  /antara\s+(tanggal\s+)?\d+\s+(dan|sampai|hingga)\s+(tanggal\s+)?\d+/,
  /(pengeluaran|pengeluaranku)\s+dari\s+(tanggal\s+)?\d+/,
  /selama\s+\d+\s+(hari|minggu|bulan)/
];

console.log("🔍 TESTING EACH UPDATED PATTERN:");
informationQueryPatterns.forEach((pattern, index) => {
  const match = pattern.test(normalizedPrompt);
  console.log(`${index + 1}. ${pattern} → ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
});

const isInformationQuery = informationQueryPatterns.some(pattern => pattern.test(normalizedPrompt));
console.log("\n📊 INFORMATION QUERY RESULT:", isInformationQuery);

// Test transaction patterns too
const transactionPatterns = [
  // Ada nominal eksplisit
  /\b\d+\s*(ribu|rb|juta|jt|rupiah|rp)\b/,
  /rp\s*\d+/,
  
  // Pattern pencatatan transaksi
  /^(beli|buat|bayar)\s+\w+.*\d+/,
  /^(aku|saya)\s+(beli|bayar)/,
  
  // Deskripsi detail item
  /beli\s+(nasi|ayam|kopi|mie|pizza|burger|baju|sepatu|bensin|pulsa|token)/,
  
  // Lokasi spesifik dengan item (EXCLUDE date ranges)
  /(di|ke)\s+\w+.*\d+/,  
  /dari\s+(?!tanggal)\w+.*\d+/  // Only match 'dari' if NOT followed by 'tanggal'
];

console.log("\n🔍 TESTING TRANSACTION PATTERNS:");
transactionPatterns.forEach((pattern, index) => {
  const match = pattern.test(normalizedPrompt);
  console.log(`${index + 1}. ${pattern} → ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
});

const isTransaction = transactionPatterns.some(pattern => pattern.test(normalizedPrompt));
console.log("\n📊 TRANSACTION RESULT:", isTransaction);

const result = isInformationQuery && !isTransaction;
console.log("\n🎯 FINAL RESULT:", result);
console.log("Should be TRUE for date range query!");

// Test additional cases
console.log("\n🧪 TESTING OTHER CASES:");
const testCases = [
  "pengeluaran dari tanggal 5 sampai tanggal 10",
  "dari tanggal 1 hingga tanggal 15", 
  "antara tanggal 20 dan tanggal 25",
  "pengeluaranku dari tanggal 1"
];

testCases.forEach(testCase => {
  const normalized = testCase.toLowerCase().trim();
  const isInfoQuery = informationQueryPatterns.some(pattern => pattern.test(normalized));
  const isTrans = transactionPatterns.some(pattern => pattern.test(normalized));
  const finalResult = isInfoQuery && !isTrans;
  console.log(`"${testCase}" → ${finalResult ? '✅ QUERY' : '❌ TRANSACTION'}`);
});
