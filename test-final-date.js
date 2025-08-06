// Test untuk memverifikasi perbaikan final
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1; // Convert to 1-based (1 = January, 8 = August)
const currentDate = today.getDate();

function formatDateLocal(year, month, day) {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
}

console.log('=== Final Fixed Logic Test ===');
console.log(`Current date: ${today.toISOString()}`);
console.log(`Current year: ${currentYear}`);
console.log(`Current month (1-based): ${currentMonth}`);
console.log(`Current date: ${currentDate}`);

// Test thisMonth logic (perbaikan final)
console.log('\n--- Fixed ThisMonth Logic (Final) ---');
const startOfMonth = formatDateLocal(currentYear, currentMonth, 1);
const daysInMonth = new Date(currentYear, currentMonth, 0).getDate(); // 0-based month for Date constructor
const endOfMonth = formatDateLocal(currentYear, currentMonth, daysInMonth);

console.log(`Start of month: ${startOfMonth}`);
console.log(`End of month: ${endOfMonth}`);
console.log(`Days in month: ${daysInMonth}`);

// Test today logic
console.log('\n--- Fixed Today Logic ---');
const todayFormatted = formatDateLocal(currentYear, currentMonth, currentDate);
console.log(`Today formatted: ${todayFormatted}`);

// Test range
console.log('\n--- Range Test ---');
const testDate = '2025-08-06';
const isInRange = testDate >= startOfMonth && testDate <= endOfMonth;
console.log(`Test date ${testDate} is in range [${startOfMonth}, ${endOfMonth}]: ${isInRange}`);

// Test SQL query format
console.log('\n--- SQL Query Test ---');
console.log(`SELECT * FROM transactions`);
console.log(`WHERE pengirim = 'farelrasyah | RPL A'`);
console.log(`  AND tanggal BETWEEN '${startOfMonth}' AND '${endOfMonth}';`);
