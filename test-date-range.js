// Quick test to debug the date range issue
const today = new Date('2025-08-06'); // Simulate current date
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-based (0 = January, 7 = August)

console.log('Current date:', today.toISOString());
console.log('Current year:', currentYear);
console.log('Current month (0-based):', currentMonth);
console.log('Current month (human):', currentMonth + 1);

// Current logic (potentially problematic)
const startOfMonth = new Date(currentYear, currentMonth, 1);
const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

console.log('\n--- Current Logic ---');
console.log('startOfMonth:', startOfMonth.toISOString());
console.log('endOfMonth:', endOfMonth.toISOString());
console.log('startOfMonth formatted:', startOfMonth.toISOString().split('T')[0]);
console.log('endOfMonth formatted:', endOfMonth.toISOString().split('T')[0]);

// Better approach using local dates
console.log('\n--- Better Approach ---');
const startOfMonthLocal = new Date(currentYear, currentMonth, 1);
const endOfMonthLocal = new Date(currentYear, currentMonth + 1, 0);

// Format to local date string without timezone issues
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

console.log('startOfMonth local:', formatDateLocal(startOfMonthLocal));
console.log('endOfMonth local:', formatDateLocal(endOfMonthLocal));

// Test timezone differences
console.log('\n--- Timezone Tests ---');
console.log('Timezone offset (minutes):', today.getTimezoneOffset());
console.log('Local time string:', today.toLocaleString());
console.log('UTC time string:', today.toUTCString());
