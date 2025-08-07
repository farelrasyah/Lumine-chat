// DEBUG: Test Current Pattern Detection
const prompt = "pengeluaranku dari tanggal 1 sampai tanggal 7";
const normalizedPrompt = prompt.toLowerCase().trim();

console.log("🔍 DEBUGGING CURRENT PATTERN DETECTION");
console.log("Original prompt:", prompt);
console.log("Normalized prompt:", normalizedPrompt);
console.log("");

// Current informationQueryPatterns from the actual file
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
  
  // Pattern dengan rentang waktu spesifik  
  /dari\s+\d+.*sampai.*\d+/,
  /antara.*dan/,
  /selama\s+\d+\s+(hari|minggu|bulan)/
];

console.log("🔍 TESTING EACH PATTERN:");
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
  /(di|ke)\s+\w+.*\d+/,  // Removed 'dari' to avoid conflicting with date ranges
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
