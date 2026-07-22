export type Currency = string;

export interface CountryConfig {
  id: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  rateToAUD: number; // exchange rate from 1 AUD to this currency (e.g. 55.0 for INR)
  userId?: string;
  familyGroupId?: string;
}

export type PaymentCategory = 
  | 'Entertainment' 
  | 'Utilities' 
  | 'Rent' 
  | 'Insurance' 
  | 'Software' 
  | 'Lifestyle' 
  | 'EMI'
  | 'Education'
  | 'Investment'
  | 'Health'
  | 'Groceries'
  | 'Other';

export type BillingCycle = 'once' | 'weekly' | 'monthly' | '2-months' | '3-months' | '4-months' | '6-months' | 'yearly';

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  dayOfMonth: number; // 1 to 31
  category: string;
  active: boolean;
  notes?: string;
  reminderDaysBefore: number; // How many days before to alert
  userId?: string;
  familyGroupId?: string;
  paymentType?: 'fixed' | 'flexi';
  paymentMethod?: 'manual' | 'direct_debit';
  billingCycle?: BillingCycle;
  frequency?: string; // Schema-required field matching firebase-blueprint.json
  startDate?: string; // Optional: YYYY-MM-DD
  taggedFor?: string; // e.g. "Bank", "Father", "Mother", "Home", "Self"
  autoRenew?: boolean; // Optional: Auto-generate next month's record on payment
  order?: number; // Manual ordering field
}

export interface PaymentHistory {
  id: string;
  paymentId: string;
  paymentName: string;
  amount: number;
  amountPaid?: number; // Schema-required field matching firebase-blueprint.json
  currency: Currency;
  paidDate: string; // YYYY-MM-DD
  datePaid?: string;   // Schema-required field matching firebase-blueprint.json
  userId?: string;
  familyGroupId?: string;
  taggedFor?: string; // Tagged for whom (Bank, Father, Mother, etc.)
  status?: 'paid' | 'delayed' | 'carry'; // 'paid', 'delayed', 'carry' (carry to next month)
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'adhoc' | 'one-time';
  category: 'salary' | 'cashback' | 'borrowing' | 'investment' | 'refund' | 'other';
  isRecurring: boolean;
  isSimpleTotal?: boolean;
  payDate?: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'family' | 'business';
  inviteCode: string;
  role: 'host' | 'modify' | 'view';
  isOwner: boolean;
  incomeMode?: 'simple' | 'detailed';
  monthlyIncome?: string;
  accessLevel?: 'full' | 'limited';
  enabledFeatures?: string[];
}

export interface RewardPerk {
  id: string;
  providerName: string;
  category: 'Credit Card' | 'Refinance' | 'Electricity' | 'Gas' | 'Health' | 'Other';
  applicationDate: string;
  closingDate?: string;
  exclusionPeriodMonths: number;
  bonusValue?: string;
  notes?: string;
  applicantName?: string;
  annualFee: number;
  pointsEarned?: number;
  pointsProgram?: 'Qantas' | 'Velocity' | 'Flybuys' | 'None' | 'Other';
  cashValue: number;
  userId?: string;
  familyGroupId?: string;
}

export function getCategoryLabel(category: string, mode: 'family' | 'business' = 'family'): string {
  if (mode === 'family') return category;
  const businessLabels: Record<string, string> = {
    Entertainment: 'Client & Team Relations',
    Utilities: 'Office Utilities',
    Rent: 'Lease & Commercial Rent',
    Insurance: 'Commercial Insurance',
    Software: 'SaaS & Infrastructure',
    Lifestyle: 'Travel & Business Meals',
    EMI: 'Business Debt & Loans',
    Education: 'Marketing & Training',
    Investment: 'Capital & Growth',
    Health: 'Team Health Benefit',
    Groceries: 'Pantry & Office Supplies',
    Other: 'Operating OPEX / Other',
  };
  return businessLabels[category] || category;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  familyGroupId: string;
  isSuperAdmin?: boolean;
  whatsappPhone?: string;
  licensePlanId?: string;
  licensePlanName?: string;
  licensePlanFeatures?: string[];
  canCreateBusiness?: boolean;
  appNotificationsEnabled?: boolean;
  mobileNotificationsEnabled?: boolean;
  ownNotificationsEnabled?: boolean;
  familyNotificationsEnabled?: boolean;
  role?: 'view' | 'modify'; // Access level
  isFamilyHost?: boolean; // If this user is the host/owner of the current family group code
  Connected_To_Host_UUID?: string;
  inviteCode?: string;
}

export interface BillAccess {
  id: string;          // paymentId_memberUid
  paymentId: string;   // reference to payment
  memberUid: string;   // user getting access
  ownerUid: string;    // creator of the payment
  accessLevel: 'view' | 'modify';
  sharedAt: string;
}

export interface FamilyInvitation {
  id: string;
  fromUid: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toUid?: string;
  proposedRole: 'view' | 'modify';
  proposedAccessLevel?: 'full' | 'limited';
  proposedFeatures?: string[];
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
  inviteCode?: string;
}

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; iconBg: string }> = {
  Entertainment: { bg: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400', text: 'text-red-600', iconBg: 'bg-red-500' },
  Utilities: { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', text: 'text-amber-600', iconBg: 'bg-amber-500' },
  Rent: { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', text: 'text-emerald-600', iconBg: 'bg-emerald-500' },
  Insurance: { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400', text: 'text-blue-600', iconBg: 'bg-blue-500' },
  Software: { bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400', text: 'text-indigo-600', iconBg: 'bg-indigo-500' },
  Lifestyle: { bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400', text: 'text-purple-600', iconBg: 'bg-purple-500' },
  EMI: { bg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400', text: 'text-pink-600', iconBg: 'bg-pink-500' },
  Education: { bg: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', text: 'text-orange-600', iconBg: 'bg-orange-500' },
  Investment: { bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400', text: 'text-teal-600', iconBg: 'bg-teal-500' },
  Health: { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400', text: 'text-rose-600', iconBg: 'bg-rose-500' },
  Groceries: { bg: 'bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-400', text: 'text-lime-600', iconBg: 'bg-lime-500' },
  Other: { bg: 'bg-slate-50 text-slate-700 dark:bg-slate-850/30 dark:text-slate-400', text: 'text-slate-600', iconBg: 'bg-slate-500' },
};

export function getCategoryColor(category: string): { bg: string; text: string; iconBg: string } {
  const preset = CATEGORY_COLORS[category];
  if (preset) return preset;

  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    { bg: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400', text: 'text-red-600', iconBg: 'bg-red-500' },
    { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', text: 'text-amber-600', iconBg: 'bg-amber-500' },
    { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', text: 'text-emerald-600', iconBg: 'bg-emerald-500' },
    { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400', text: 'text-blue-600', iconBg: 'bg-blue-500' },
    { bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400', text: 'text-indigo-600', iconBg: 'bg-indigo-500' },
    { bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400', text: 'text-purple-600', iconBg: 'bg-purple-500' },
    { bg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400', text: 'text-pink-600', iconBg: 'bg-pink-500' },
    { bg: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', text: 'text-orange-600', iconBg: 'bg-orange-500' },
    { bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400', text: 'text-teal-600', iconBg: 'bg-teal-500' },
    { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400', text: 'text-rose-600', iconBg: 'bg-rose-500' },
    { bg: 'bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-400', text: 'text-lime-600', iconBg: 'bg-lime-500' },
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'info' | 'warning' | 'alert';
}

export interface ScheduledInstance {
  id: string; // paymentId_dueDate
  paymentId: string;
  paymentName: string;
  amount: number;
  currency: string;
  category: string;
  dueDate: string; // YYYY-MM-DD
  billingCycle: string;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod: 'manual' | 'direct_debit';
  taggedFor?: string;
  historyId?: string; // Linked history entry ID if paid
}
