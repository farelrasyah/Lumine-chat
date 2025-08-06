// Test file untuk memverifikasi perbaikan getDateRange
const today = new Date();

// Simulate formatDateLocal function
function formatDateLocal(year, month, day) {
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

// Simulate the fixed logic
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-based
const currentDate = today.getDate();

console.log('=== Fixed Logic Test ===');
console.log('Current date:', today.toISOString());
console.log('Current year:', currentYear);
console.log('Current month (0-based):', currentMonth);
console.log('Current date:', currentDate);

// Test thisMonth case
const monthHuman = currentMonth + 1; // Convert to 1-based month
const startOfMonth = formatDateLocal(currentYear, monthHuman, 1);
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
const endOfMonth = formatDateLocal(currentYear, monthHuman, daysInMonth);

console.log('\n--- Fixed ThisMonth Logic ---');
console.log('Month human (1-based):', monthHuman);
console.log('Days in month:', daysInMonth);
console.log('Start of month:', startOfMonth);
console.log('End of month:', endOfMonth);

// Test today case
const todayFormatted = formatDateLocal(currentYear, monthHuman, currentDate);
console.log('\n--- Fixed Today Logic ---');
console.log('Today formatted:', todayFormatted);

// Verify the date should include 2025-08-06
const testDate = '2025-08-06';
const isInRange = testDate >= startOfMonth && testDate <= endOfMonth;
console.log('\n--- Range Test ---');
console.log(`Test date ${testDate} is in range [${startOfMonth}, ${endOfMonth}]:`, isInRange);
