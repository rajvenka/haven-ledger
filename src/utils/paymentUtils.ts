import { RecurringPayment, PaymentHistory, CountryConfig, ScheduledInstance } from '../types';

// Default conversion rate: 1 AUD = 55 INR
export const DEFAULT_CONVERSION_RATE = 55.0;

export const INITIAL_COUNTRIES: CountryConfig[] = [
  {
    id: 'AU',
    name: 'Australia',
    currency: 'AUD',
    symbol: '$',
    flag: '🇦🇺',
    rateToAUD: 1.0,
  },
  {
    id: 'IN',
    name: 'India',
    currency: 'INR',
    symbol: '₹',
    flag: '🇮🇳',
    rateToAUD: 55.0,
  },
  {
    id: 'US',
    name: 'United States',
    currency: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    rateToAUD: 0.67,
  },
  {
    id: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    symbol: '£',
    flag: '🇬🇧',
    rateToAUD: 0.52,
  },
  {
    id: 'EU',
    name: 'Europe',
    currency: 'EUR',
    symbol: '€',
    flag: '🇪🇺',
    rateToAUD: 0.62,
  }
];

/**
 * Calculates the next calendar date for a recurring payment given its day of the month and billing cycle.
 */
export function getNextPaymentDate(
  paymentOrDayOfMonth: number | RecurringPayment,
  baseDate: Date = new Date(),
  history: PaymentHistory[] = []
): Date {
  if (typeof paymentOrDayOfMonth === 'number') {
    const dayOfMonth = paymentOrDayOfMonth;
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth(); // 0-indexed
    const today = baseDate.getDate();

    // Handle month boundary (e.g., dayOfMonth is 31, but month has 30 days)
    const lastDayOfCurrentMonth = new Date(year, month + 1, 0).getDate();
    const currentMonthTargetDay = Math.min(dayOfMonth, lastDayOfCurrentMonth);

    // Clear times to make date-only comparisons
    const todayStart = new Date(year, month, today);
    const candidateDate = new Date(year, month, currentMonthTargetDay);

    if (candidateDate >= todayStart) {
      return candidateDate;
    }

    // If candidate is in the past, it falls in the next month
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const lastDayOfNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
    const nextMonthTargetDay = Math.min(dayOfMonth, lastDayOfNextMonth);
    
    return new Date(nextMonthYear, nextMonth, nextMonthTargetDay);
  }

  const payment = paymentOrDayOfMonth;
  const dayOfMonth = payment.dayOfMonth;
  const cycle = payment.billingCycle || 'monthly';

  // Handle 'once' cycle
  if (cycle === 'once') {
    const hasBeenPaid = history.some(h => h.paymentId === payment.id);
    if (hasBeenPaid) {
      // Return a date far in the future so it doesn't show as due
      return new Date(2100, 11, 31);
    }
    if (payment.startDate) {
      return parseLocalDate(payment.startDate);
    }
    return getNextPaymentDate(dayOfMonth, baseDate);
  }

  // Handle 'monthly' cycle
  if (cycle === 'monthly') {
    const paymentHistory = history.filter(h => h.paymentId === payment.id);
    
    // Check if the user has paid in the current month of the baseDate
    const currentMonthStr = `${baseDate.getFullYear()}-${(baseDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const paidThisMonth = paymentHistory.some(h => h.paidDate.startsWith(currentMonthStr));

    if (paidThisMonth) {
      // It has been paid this month! The next due date is next month.
      const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
      const lastDayOfNextMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
      nextMonthDate.setDate(Math.min(dayOfMonth, lastDayOfNextMonth));
      return nextMonthDate;
    } else {
      // It has NOT been paid this month! The next due date is in the current month (which may be in the past, indicating overdue).
      const currentMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const lastDayOfCurrentMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate();
      currentMonthDate.setDate(Math.min(dayOfMonth, lastDayOfCurrentMonth));
      
      // If there is a startDate, make sure we don't return a date before startDate
      if (payment.startDate) {
        const start = parseLocalDate(payment.startDate);
        if (currentMonthDate < start) {
          return start;
        }
      }
      return currentMonthDate;
    }
  }

  // Handle 'weekly' cycle
  if (cycle === 'weekly') {
    if (payment.startDate) {
      const paymentHistory = history.filter(h => h.paymentId === payment.id);
      if (paymentHistory.length === 0) {
        const start = parseLocalDate(payment.startDate);
        const nextDueDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const todayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        while (nextDueDate < todayStart) {
          nextDueDate.setDate(nextDueDate.getDate() + 7);
        }
        return nextDueDate;
      }

      const sortedHistory = [...paymentHistory].sort((a, b) => {
        const dateA = a.paidDate || '';
        const dateB = b.paidDate || '';
        return dateB.localeCompare(dateA);
      });
      const latestPayment = sortedHistory[0];
      const latestDate = parseLocalDate(latestPayment.paidDate);

      const nextDueDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() + 7);
      const todayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      while (nextDueDate < todayStart) {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      }
      return nextDueDate;
    } else {
      const targetDayOfWeek = (dayOfMonth - 1) % 7; // 0 = Mon, 1 = Tue, ..., 6 = Sun
      const jsTargetDayOfWeek = targetDayOfWeek === 6 ? 0 : targetDayOfWeek + 1; // JS 0 = Sun, 1 = Mon, ..., 6 = Sat

      const paymentHistory = history.filter(h => h.paymentId === payment.id);
      if (paymentHistory.length === 0) {
        const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        const currentDay = nextDate.getDay();
        let daysToAdd = (jsTargetDayOfWeek - currentDay + 7) % 7;
        nextDate.setDate(nextDate.getDate() + daysToAdd);
        return nextDate;
      }

      const sortedHistory = [...paymentHistory].sort((a, b) => {
        const dateA = a.paidDate || '';
        const dateB = b.paidDate || '';
        return dateB.localeCompare(dateA);
      });
      const latestPayment = sortedHistory[0];
      const latestDate = parseLocalDate(latestPayment.paidDate);

      const nextDueDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() + 7);
      const todayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      while (nextDueDate < todayStart) {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      }
      return nextDueDate;
    }
  }

  // Handle multi-month billing cycles: 2-months, 3-months, 4-months, 6-months, yearly
  const paymentHistory = history.filter(h => h.paymentId === payment.id);
  
  // Parse interval in months
  let monthsToAdd = 1;
  if (cycle === '2-months') monthsToAdd = 2;
  else if (cycle === '3-months') monthsToAdd = 3;
  else if (cycle === '4-months') monthsToAdd = 4;
  else if (cycle === '6-months') monthsToAdd = 6;
  else if (cycle === 'yearly') monthsToAdd = 12;

  if (paymentHistory.length === 0) {
    if (payment.startDate) {
      const start = parseLocalDate(payment.startDate);
      const nextDueDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const todayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      while (nextDueDate < todayStart) {
        nextDueDate.setMonth(nextDueDate.getMonth() + monthsToAdd);
      }
      return nextDueDate;
    }
    // Fall back to upcoming date in current or next month
    return getNextPaymentDate(dayOfMonth, baseDate);
  }

  // Sort history to find the latest payment date
  const sortedHistory = [...paymentHistory].sort((a, b) => {
    const dateA = a.paidDate || '';
    const dateB = b.paidDate || '';
    return dateB.localeCompare(dateA);
  });
  const latestPayment = sortedHistory[0];
  const latestDate = parseLocalDate(latestPayment.paidDate); // YYYY-MM-DD

  // Compute base next due date
  const nextDueDate = new Date(latestDate.getFullYear(), latestDate.getMonth() + monthsToAdd, 1);
  const lastDayOfTargetMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
  nextDueDate.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  // Forward nextDueDate if it falls behind baseDate
  const todayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  while (nextDueDate < todayStart) {
    nextDueDate.setMonth(nextDueDate.getMonth() + monthsToAdd);
    const currTargetMonth = nextDueDate.getMonth();
    const currLastDay = new Date(nextDueDate.getFullYear(), currTargetMonth + 1, 0).getDate();
    nextDueDate.setDate(Math.min(dayOfMonth, currLastDay));
  }

  return nextDueDate;
}

/**
 * Checks if a payment has already been paid for the current active billing cycle period.
 */
export function isPaymentPaidForCurrentPeriod(
  payment: RecurringPayment,
  history: PaymentHistory[],
  baseDate: Date = new Date()
): boolean {
  const paymentHistory = history.filter(h => h.paymentId === payment.id);
  const cycle = payment.billingCycle || 'monthly';
  
  if (cycle === 'monthly') {
    const currentMonthStr = `${baseDate.getFullYear()}-${(baseDate.getMonth() + 1).toString().padStart(2, '0')}`;
    return paymentHistory.some(h => h.paidDate.startsWith(currentMonthStr));
  }
  
  if (cycle === 'weekly') {
    // Paid in the last 7 days
    const oneWeekAgo = new Date(baseDate);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return paymentHistory.some(h => parseLocalDate(h.paidDate) >= oneWeekAgo);
  }
  
  if (cycle === 'once') {
    return paymentHistory.length > 0;
  }
  
  // For multi-month (2-months, 3-months, 4-months, 6-months, yearly)
  const currentMonthStr = `${baseDate.getFullYear()}-${(baseDate.getMonth() + 1).toString().padStart(2, '0')}`;
  return paymentHistory.some(h => h.paidDate.startsWith(currentMonthStr));
}

/**
 * Returns how many days are left until the next occurrence.
 */
export function getDaysUntilPayment(
  paymentOrDayOfMonth: number | RecurringPayment,
  baseDate: Date = new Date(),
  history: PaymentHistory[] = []
): number {
  const todayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const nextDate = getNextPaymentDate(paymentOrDayOfMonth, baseDate, history);
  const diffTime = nextDate.getTime() - todayStart.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format date nicely like "July 15, 2026" or "Tomorrow" or "Today" or "in 3 days"
 */
export function formatDaysRemaining(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === 7) return 'In 1 week';
  if (days < 7) return `In ${days} days`;
  return `In ${days} days`;
}

export function formatDatePretty(date: Date | string | number | null | undefined): string {
  const d = date instanceof Date ? date : new Date(date as any);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Convert amounts between any supported country currencies dynamically
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rateOrCountries: number | CountryConfig[] = DEFAULT_CONVERSION_RATE
): number {
  if (from === to) return amount;

  if (Array.isArray(rateOrCountries)) {
    const resolvedCountries = rateOrCountries.length > 0 ? rateOrCountries : INITIAL_COUNTRIES;
    const fromCountry = resolvedCountries.find(c => String(c.currency || '').toUpperCase() === String(from || '').toUpperCase());
    const toCountry = resolvedCountries.find(c => String(c.currency || '').toUpperCase() === String(to || '').toUpperCase());
    if (!fromCountry || !toCountry) return amount;
    
    // Convert to base currency (AUD) first: amount / fromCountry.rateToAUD
    const amountInAUD = amount / fromCountry.rateToAUD;
    // Convert from base currency to target currency: amountInAUD * toCountry.rateToAUD
    return amountInAUD * toCountry.rateToAUD;
  }

  const rate = typeof rateOrCountries === 'number' ? rateOrCountries : DEFAULT_CONVERSION_RATE;
  if (from === 'AUD' && to === 'INR') {
    return amount * rate;
  }
  if (from === 'INR' && to === 'AUD') {
    return amount / rate;
  }
  return amount;
}

/**
 * Format currency dynamically
 */
export function formatCurrencyValue(
  amount: number,
  currency: string,
  countries: CountryConfig[] = INITIAL_COUNTRIES
): string {
  const resolvedCountries = countries && countries.length > 0 ? countries : INITIAL_COUNTRIES;
  const c = resolvedCountries.find(item => String(item.currency || '').toUpperCase() === String(currency || '').toUpperCase());
  const symbol = c ? c.symbol : '$';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: currency.toUpperCase() === 'INR' || currency.toUpperCase() === 'JPY' ? 0 : 2
    }).format(amount);
  } catch (e) {
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Parses a YYYY-MM-DD string into a local midnight Date object to prevent timezone shifts.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  return new Date(dateStr);
}

/**
 * Generates all scheduled instances for active payments within a specific date range.
 * Pairs them dynamically with the corresponding payment history entries.
 */
export function getScheduledInstancesForRange(
  payments: RecurringPayment[],
  history: PaymentHistory[],
  rangeStart: Date,
  rangeEnd: Date
): ScheduledInstance[] {
  const instances: ScheduledInstance[] = [];

  const startYear = rangeStart.getFullYear();
  const startMonth = rangeStart.getMonth() + 1;
  const startDay = rangeStart.getDate();
  const rangeStartStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  const endYear = rangeEnd.getFullYear();
  const endMonth = rangeEnd.getMonth() + 1;
  const endDay = rangeEnd.getDate();
  const rangeEndStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  payments.forEach(p => {
    if (!p.active) return;

    const cycle = p.billingCycle || 'monthly';
    const day = p.dayOfMonth;

    // Collect candidate due dates for this payment in the range (Date objects)
    const dueDates: Date[] = [];

    if (cycle === 'once') {
      const dateStr = p.startDate || `${startYear}-${String(startMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateStr >= rangeStartStr && dateStr <= rangeEndStr) {
        dueDates.push(parseLocalDate(dateStr));
      }
    } 
    else if (cycle === 'weekly') {
      let current = parseLocalDate(p.startDate || rangeStartStr);
      if (!p.startDate) {
        // Go back 3 weeks to ensure coverage of current month boundaries
        current.setDate(current.getDate() - 21);
      }
      
      let count = 0;
      while (count < 150) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (dateStr > rangeEndStr) {
          break;
        }

        const isOnOrAfterStart = dateStr >= rangeStartStr;
        const isOnOrAfterStartDate = !p.startDate || dateStr >= p.startDate;

        if (isOnOrAfterStart && isOnOrAfterStartDate) {
          dueDates.push(new Date(current));
        }

        current.setDate(current.getDate() + 7);
        count++;
      }
    } 
    else {
      // Monthly, 2-months, 3-months, 4-months, 6-months, yearly
      let monthsInterval = 1;
      if (cycle === '2-months') monthsInterval = 2;
      else if (cycle === '3-months') monthsInterval = 3;
      else if (cycle === '4-months') monthsInterval = 4;
      else if (cycle === '6-months') monthsInterval = 6;
      else if (cycle === 'yearly') monthsInterval = 12;

      let currY = p.startDate ? parseInt(p.startDate.split('-')[0], 10) : rangeStart.getFullYear() - 1;
      let currM = p.startDate ? parseInt(p.startDate.split('-')[1], 10) : rangeStart.getMonth() + 1;

      if (isNaN(currY) || isNaN(currM)) {
        currY = rangeStart.getFullYear() - 1;
        currM = rangeStart.getMonth() + 1;
      }

      let count = 0;
      while (count < 150) {
        const lastDay = new Date(currY, currM, 0).getDate();
        const targetDay = Math.min(day, lastDay);
        const dateStr = `${currY}-${String(currM).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

        if (dateStr > rangeEndStr) {
          break;
        }

        const isOnOrAfterStart = dateStr >= rangeStartStr;
        const isOnOrAfterStartDate = !p.startDate || dateStr >= p.startDate;

        if (isOnOrAfterStart && isOnOrAfterStartDate) {
          dueDates.push(parseLocalDate(dateStr));
        }

        currM += monthsInterval;
        while (currM > 12) {
          currM -= 12;
          currY += 1;
        }
        count++;
      }
    }

    const paymentHistory = history
      .filter(h => h.paymentId === p.id)
      .sort((a, b) => {
        const dateA = a.paidDate || '';
        const dateB = b.paidDate || '';
        return dateA.localeCompare(dateB);
      });

    const matchedHistoryIds = new Set<string>();

    dueDates.forEach(dueDate => {
      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dateVal = String(dueDate.getDate()).padStart(2, '0');
      const dueDateStr = `${year}-${month}-${dateVal}`;

      // Try to find a history entry with identical paidDate (explicitly matching this instance)
      let matchedH = paymentHistory.find(h => h.paidDate === dueDateStr && !matchedHistoryIds.has(h.id));

      if (!matchedH) {
        // If not exact date, match calendar month for monthly and multi-month
        matchedH = paymentHistory.find(h => {
          if (matchedHistoryIds.has(h.id)) return false;
          const hDate = parseLocalDate(h.paidDate);
          
          if (cycle === 'weekly') {
            const diffDays = Math.abs(hDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 4;
          } else {
            return hDate.getFullYear() === dueDate.getFullYear() && hDate.getMonth() === dueDate.getMonth();
          }
        });
      }

      // Positional fallback for weekly if no exact date match
      if (!matchedH && cycle === 'weekly') {
        matchedH = paymentHistory.find(h => !matchedHistoryIds.has(h.id));
      }

      const today = new Date();
      const todayDateOnlyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const isPast = dueDateStr < todayDateOnlyStr;

      if (matchedH) {
        matchedHistoryIds.add(matchedH.id);
        instances.push({
          id: `${p.id}_${dueDateStr}`,
          paymentId: p.id,
          paymentName: p.name,
          amount: matchedH.amount,
          currency: p.currency,
          category: p.category,
          dueDate: dueDateStr,
          billingCycle: cycle,
          status: 'paid',
          paymentMethod: p.paymentMethod || 'manual',
          taggedFor: p.taggedFor,
          historyId: matchedH.id
        });
      } else {
        instances.push({
          id: `${p.id}_${dueDateStr}`,
          paymentId: p.id,
          paymentName: p.name,
          amount: p.amount,
          currency: p.currency,
          category: p.category,
          dueDate: dueDateStr,
          billingCycle: cycle,
          status: isPast ? 'overdue' : 'pending',
          paymentMethod: p.paymentMethod || 'manual',
          taggedFor: p.taggedFor
        });
      }
    });
  });

  return instances.sort((a, b) => {
    const dateA = a.dueDate || '';
    const dateB = b.dueDate || '';
    return dateA.localeCompare(dateB);
  });
}

/**
 * Filter payments that are due in the next week (0 to 7 days away)
 */
export function getPaymentsDueNextWeek(
  payments: RecurringPayment[], 
  baseDate: Date = new Date(),
  history: PaymentHistory[] = []
): RecurringPayment[] {
  return payments
    .filter(p => p.active)
    .filter(p => {
      const days = getDaysUntilPayment(p, baseDate, history);
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => getDaysUntilPayment(a, baseDate, history) - getDaysUntilPayment(b, baseDate, history));
}

/**
 * Filter payments that are due in the current month (and haven't passed today yet)
 */
export function getPaymentsDueCurrentMonth(
  payments: RecurringPayment[], 
  baseDate: Date = new Date(),
  history: PaymentHistory[] = []
): RecurringPayment[] {
  const currentMonth = baseDate.getMonth();
  const currentYear = baseDate.getFullYear();
  
  return payments
    .filter(p => p.active)
    .filter(p => {
      const nextDate = getNextPaymentDate(p, baseDate, history);
      return nextDate.getMonth() === currentMonth && nextDate.getFullYear() === currentYear;
    })
    .sort((a, b) => getDaysUntilPayment(a, baseDate, history) - getDaysUntilPayment(b, baseDate, history));
}

/**
 * Filter payments that are due in the next calendar month
 */
export function getPaymentsDueNextMonth(
  payments: RecurringPayment[], 
  baseDate: Date = new Date(),
  history: PaymentHistory[] = []
): RecurringPayment[] {
  const startOfNextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  const endOfNextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 2, 0);
  
  const nextMonthInstances = getScheduledInstancesForRange(payments, history, startOfNextMonth, endOfNextMonth);
  const paymentIdsInNextMonth = new Set(nextMonthInstances.map(ins => ins.paymentId));
  
  return payments
    .filter(p => p.active && paymentIdsInNextMonth.has(p.id))
    .sort((a, b) => getDaysUntilPayment(a, baseDate, history) - getDaysUntilPayment(b, baseDate, history));
}

/**
 * Sample payments list
 */
export const INITIAL_PAYMENTS: RecurringPayment[] = [
  {
    id: '1',
    name: 'Netflix Premium',
    amount: 22.99,
    currency: 'AUD',
    dayOfMonth: 5,
    category: 'Entertainment',
    active: true,
    notes: 'Premium Ultra HD plan shared with family',
    reminderDaysBefore: 2,
  },
  {
    id: '2',
    name: 'Gym Membership',
    amount: 1500,
    currency: 'INR',
    dayOfMonth: 12,
    category: 'Lifestyle',
    active: true,
    notes: 'Cult.fit elite annual plan billing',
    reminderDaysBefore: 3,
  },
  {
    id: '3',
    name: 'Adobe Creative Cloud',
    amount: 45.99,
    currency: 'AUD',
    dayOfMonth: 18,
    category: 'Software',
    active: true,
    notes: 'All Apps student plan discount rate',
    reminderDaysBefore: 2,
  },
  {
    id: '4',
    name: 'Office Broadband WiFi',
    amount: 999,
    currency: 'INR',
    dayOfMonth: 20,
    category: 'Utilities',
    active: true,
    notes: 'Airtel Fiber 200 Mbps plan',
    reminderDaysBefore: 1,
  },
  {
    id: '5',
    name: 'AWS Cloud Backup',
    amount: 4200,
    currency: 'INR',
    dayOfMonth: 28,
    category: 'Software',
    active: true,
    notes: 'Server backup storage and server maintenance fees',
    reminderDaysBefore: 3,
  },
  {
    id: '6',
    name: 'Car & Health Insurance',
    amount: 185.50,
    currency: 'AUD',
    dayOfMonth: 1, // First day of next month or early this month
    category: 'Insurance',
    active: true,
    notes: 'Bupa health coverage premium payment',
    reminderDaysBefore: 5,
  }
];

/**
 * Sample payment histories representing "Paid so far"
 */
export const INITIAL_HISTORY: PaymentHistory[] = [
  {
    id: 'h1',
    paymentId: '1',
    paymentName: 'Netflix Premium',
    amount: 22.99,
    currency: 'AUD',
    paidDate: '2026-06-05'
  },
  {
    id: 'h2',
    paymentId: '2',
    paymentName: 'Gym Membership',
    amount: 1500,
    currency: 'INR',
    paidDate: '2026-06-12'
  },
  {
    id: 'h3',
    paymentId: '3',
    paymentName: 'Adobe Creative Cloud',
    amount: 45.99,
    currency: 'AUD',
    paidDate: '2026-06-18'
  },
  {
    id: 'h4',
    paymentId: '4',
    paymentName: 'Office Broadband WiFi',
    amount: 999,
    currency: 'INR',
    paidDate: '2026-06-20'
  },
  {
    id: 'h5',
    paymentId: '5',
    paymentName: 'AWS Cloud Backup',
    amount: 4200,
    currency: 'INR',
    paidDate: '2026-05-28'
  },
  {
    id: 'h6',
    paymentId: '6',
    paymentName: 'Car & Health Insurance',
    amount: 185.50,
    currency: 'AUD',
    paidDate: '2026-06-01'
  }
];
