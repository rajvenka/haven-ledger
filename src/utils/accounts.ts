/**
 * "Accounts" = the people / properties money is spent on or for. Derived from the existing
 * taggedFor field on bills and payment history - no schema change.
 */
import { RecurringPayment, PaymentHistory, CountryConfig } from '../types';
import {
  convertCurrency,
  getNextPaymentDate,
  isPaymentPaidForCurrentPeriod,
} from './paymentUtils';

export type AccountType = 'person' | 'property' | 'other';

export const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'person', label: 'Person' },
  { id: 'property', label: 'Property' },
  { id: 'other', label: 'Other' },
];

export const accountNameOf = (tag?: string | null) => (tag || 'Self').trim() || 'Self';

export function inferAccountType(name: string): AccountType {
  const n = name.toLowerCase();
  if (/\d/.test(n) || /(street|\bst\b|road|\brd\b|drive|\bdr\b|avenue|\bave\b|lane|court|unit|apt|apartment|flat|villa|house|home|property|rental|office)/.test(n)) {
    return 'property';
  }
  if (/(bank|loan|card|insurance|tax|business|company)/.test(n)) return 'other';
  return 'person';
}

const LS_KEY = 'hv_account_types';
export function loadTypeOverrides(): Record<string, AccountType> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
export function saveTypeOverride(name: string, type: AccountType) {
  try {
    const cur = loadTypeOverrides();
    cur[name] = type;
    localStorage.setItem(LS_KEY, JSON.stringify(cur));
  } catch { /* ignore */ }
}

export const isMonthlyCycle = (cycle?: string) => {
  const c = String(cycle || 'monthly').toLowerCase();
  return c === 'monthly' || c === 'weekly';
};

/** Average monthly cost of a bill, in its own currency. */
export function monthlyEquivalent(p: RecurringPayment): number {
  const cycle = String(p.billingCycle || 'monthly').toLowerCase();
  let m = Number(p.amount) || 0;
  if (cycle === 'weekly') m *= 4.33;
  else if (cycle === 'yearly') m /= 12;
  else if (cycle === '2-months') m /= 2;
  else if (cycle === '3-months') m /= 3;
  else if (cycle === '4-months') m /= 4;
  else if (cycle === '6-months') m /= 6;
  else if (cycle === 'once') m = 0;
  return m;
}

export const toCcy = (amount: number, from: string, to: string, countries: CountryConfig[]) =>
  convertCurrency(amount, String(from || to), to, countries);

export interface BillState {
  paid: boolean;          // paid for the current period
  paidThisMonth: boolean; // a payment was logged in the current calendar month
  next: Date;
  days: number;           // days until next due (negative = overdue)
  overdueDays: number;
  dueThisMonth: boolean;  // unpaid and due on/before the end of this month
  future: boolean;        // non-monthly bill due after this month
}

export function billState(p: RecurringPayment, history: PaymentHistory[], now: Date = new Date()): BillState {
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const paid = isPaymentPaidForCurrentPeriod(p, history, now);
  const paidThisMonth = history.some((h) => h.paymentId === p.id && String(h.paidDate || '').startsWith(monthStr));
  let next = now;
  try { next = getNextPaymentDate(p, now, history); } catch { /* keep now */ }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime() - todayStart.getTime()) / 86400000);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthly = isMonthlyCycle(p.billingCycle);
  const future = !monthly && !paidThisMonth && next > endOfMonth;
  const dueThisMonth = p.active && !paid && !future && (monthly || next <= endOfMonth);
  return { paid, paidThisMonth, next, days, overdueDays: !paid && days < 0 ? -days : 0, dueThisMonth, future };
}

export interface Account {
  name: string;
  type: AccountType;
  bills: RecurringPayment[];
  history: PaymentHistory[];
}

export function buildAccounts(
  payments: RecurringPayment[],
  history: PaymentHistory[],
  overrides: Record<string, AccountType>
): Account[] {
  const map = new Map<string, Account>();
  const get = (raw?: string | null) => {
    const name = accountNameOf(raw);
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, { name, type: overrides[name] || inferAccountType(name), bills: [], history: [] });
    return map.get(key)!;
  };
  payments.forEach((p) => get(p.taggedFor).bills.push(p));
  history.forEach((h) => get(h.taggedFor).history.push(h));
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATARS = ['bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-fuchsia-500'];
export function avatarClass(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATARS[Math.abs(h) % AVATARS.length];
}
