import { getNextPaymentDate, getDaysUntilPayment } from './utils/paymentUtils.js';
import { RecurringPayment, PaymentHistory } from './types.js';

// Define helper to format date nicely
const formatDate = (d: Date) => d.toISOString().split('T')[0];

console.log('========================================================================');
console.log('         BILLING CYCLES & NEXT DUE DATE CALCULATION TEST RUNNER         ');
console.log('========================================================================\n');

// Set a fixed baseDate for deterministic testing: July 3rd, 2026 (Friday)
// Friday is JS dayOfWeek = 5
const baseDate = new Date('2026-07-03T12:00:00Z'); 
console.log(`Base Date for Testing: ${formatDate(baseDate)} (Friday)\n`);

const testPayments: RecurringPayment[] = [
  {
    id: 'monthly-emi',
    name: 'Home Loan EMI',
    amount: 1200,
    currency: 'AUD',
    dayOfMonth: 5, // Billed on 5th of month
    category: 'EMI',
    active: true,
    billingCycle: 'monthly',
    reminderDaysBefore: 3
  },
  {
    id: 'two-monthly-gas',
    name: 'Gas Bill',
    amount: 145,
    currency: 'AUD',
    dayOfMonth: 15, // Billed on 15th
    category: 'Utilities',
    active: true,
    billingCycle: '2-months',
    reminderDaysBefore: 5
  },
  {
    id: 'three-monthly-gym',
    name: 'Gym Membership',
    amount: 210,
    currency: 'AUD',
    dayOfMonth: 1, // Billed on 1st
    category: 'Lifestyle',
    active: true,
    billingCycle: '3-months',
    reminderDaysBefore: 2
  },
  {
    id: 'weekly-tuition',
    name: 'Tuition Fees',
    amount: 90,
    currency: 'AUD',
    dayOfMonth: 1, // Monday (dayOfMonth 1 maps to Monday)
    category: 'Education',
    active: true,
    billingCycle: 'weekly',
    reminderDaysBefore: 1
  },
  {
    id: 'adhoc-sports',
    name: 'Sports Tournament Registration',
    amount: 75,
    currency: 'AUD',
    dayOfMonth: 12,
    category: 'Other',
    active: true,
    billingCycle: 'once',
    reminderDaysBefore: 1
  }
];

// Mock Payment History
const history: PaymentHistory[] = [
  // 1. Gas Bill (2-months) was last paid on May 15, 2026. Next should be July 15, 2026.
  {
    id: 'h1',
    paymentId: 'two-monthly-gas',
    paymentName: 'Gas Bill',
    amount: 145,
    currency: 'AUD',
    paidDate: '2026-05-15',
    familyGroupId: 'fg1',
    userId: 'u1'
  },
  // 2. Gym (3-months) was last paid on April 1, 2026. Next should be July 1, 2026 (which is in past wrt July 3rd, so it should roll over to Oct 1st, 2026!)
  {
    id: 'h2',
    paymentId: 'three-monthly-gym',
    paymentName: 'Gym Membership',
    amount: 210,
    currency: 'AUD',
    paidDate: '2026-04-01',
    familyGroupId: 'fg1',
    userId: 'u1'
  },
  // 3. Weekly Tuition was last paid on June 29, 2026 (Monday). Next should be July 6, 2026 (Monday).
  {
    id: 'h3',
    paymentId: 'weekly-tuition',
    paymentName: 'Tuition Fees',
    amount: 90,
    currency: 'AUD',
    paidDate: '2026-06-29',
    familyGroupId: 'fg1',
    userId: 'u1'
  },
  // 4. Adhoc Sports was already paid on June 12, 2026. Since it is 'once' cycle, next should be 2100-12-31 (inactive / far future).
  {
    id: 'h4',
    paymentId: 'adhoc-sports',
    paymentName: 'Sports Tournament Registration',
    amount: 75,
    currency: 'AUD',
    paidDate: '2026-06-12',
    familyGroupId: 'fg1',
    userId: 'u1'
  }
];

let failed = false;

// --- TEST CASE 1: Monthly EMI ---
console.log('--- Test Case 1: Monthly EMI ---');
const emi = testPayments[0];
const emiNext = getNextPaymentDate(emi, baseDate, history);
const emiDays = getDaysUntilPayment(emi, baseDate, history);
console.log(`Payment: ${emi.name} (${emi.billingCycle})`);
console.log(`Expected Next Date: 2026-07-05 (Since July 3rd is before July 5th)`);
console.log(`Calculated Next Date: ${formatDate(emiNext)}`);
console.log(`Days Until Due: ${emiDays} days`);
if (formatDate(emiNext) === '2026-07-05' && emiDays === 2) {
  console.log('✅ TEST PASSED\n');
} else {
  console.log('❌ TEST FAILED\n');
  failed = true;
}

// --- TEST CASE 2: Two Monthly Gas Bill ---
console.log('--- Test Case 2: Two Monthly Gas Bill ---');
const gas = testPayments[1];
const gasNext = getNextPaymentDate(gas, baseDate, history);
const gasDays = getDaysUntilPayment(gas, baseDate, history);
console.log(`Payment: ${gas.name} (${gas.billingCycle})`);
console.log(`Last paid on: 2026-05-15`);
console.log(`Expected Next Date: 2026-07-15 (Exactly 2 months after last paid date)`);
console.log(`Calculated Next Date: ${formatDate(gasNext)}`);
console.log(`Days Until Due: ${gasDays} days`);
if (formatDate(gasNext) === '2026-07-15' && gasDays === 12) {
  console.log('✅ TEST PASSED\n');
} else {
  console.log('❌ TEST FAILED\n');
  failed = true;
}

// --- TEST CASE 3: Three Monthly Gym Roll-over ---
console.log('--- Test Case 3: Three Monthly Gym Roll-over ---');
const gym = testPayments[2];
const gymNext = getNextPaymentDate(gym, baseDate, history);
const gymDays = getDaysUntilPayment(gym, baseDate, history);
console.log(`Payment: ${gym.name} (${gym.billingCycle})`);
console.log(`Last paid on: 2026-04-01`);
console.log(`Expected Next Date: 2026-10-01 (July 1st has passed July 3rd base date, so rolls over 3 more months to Oct 1st)`);
console.log(`Calculated Next Date: ${formatDate(gymNext)}`);
console.log(`Days Until Due: ${gymDays} days`);
if (formatDate(gymNext) === '2026-10-01') {
  console.log('✅ TEST PASSED\n');
} else {
  console.log('❌ TEST FAILED\n');
  failed = true;
}

// --- TEST CASE 4: Weekly Tuition Fees ---
console.log('--- Test Case 4: Weekly Tuition Fees ---');
const tuition = testPayments[3];
const tuitionNext = getNextPaymentDate(tuition, baseDate, history);
const tuitionDays = getDaysUntilPayment(tuition, baseDate, history);
console.log(`Payment: ${tuition.name} (${tuition.billingCycle})`);
console.log(`Last paid on: 2026-06-29 (Monday)`);
console.log(`Expected Next Date: 2026-07-06 (Exactly 7 days after last paid date)`);
console.log(`Calculated Next Date: ${formatDate(tuitionNext)}`);
console.log(`Days Until Due: ${tuitionDays} days`);
if (formatDate(tuitionNext) === '2026-07-06' && tuitionDays === 3) {
  console.log('✅ TEST PASSED\n');
} else {
  console.log('❌ TEST FAILED\n');
  failed = true;
}

// --- TEST CASE 5: Adhoc One-off Sports Tournament ---
console.log('--- Test Case 5: Adhoc / One-off Sports Tournament ---');
const sports = testPayments[4];
const sportsNext = getNextPaymentDate(sports, baseDate, history);
console.log(`Payment: ${sports.name} (${sports.billingCycle})`);
console.log(`Last paid on: 2026-06-12`);
console.log(`Expected Next Date: 2100-12-31 (Far future placeholder to denote it is completed and should not show up)`);
console.log(`Calculated Next Date: ${formatDate(sportsNext)}`);
if (formatDate(sportsNext) === '2100-12-31') {
  console.log('✅ TEST PASSED\n');
} else {
  console.log('❌ TEST FAILED\n');
  failed = true;
}

console.log('========================================================================');
if (failed) {
  console.log('               🚨 SOME TESTS FAILED! PLEASE REVIEW LOGS.               ');
  process.exit(1);
} else {
  console.log('               🎉 ALL TESTS PASSED SUCCESSFULLY!                       ');
  process.exit(0);
}
console.log('========================================================================');
