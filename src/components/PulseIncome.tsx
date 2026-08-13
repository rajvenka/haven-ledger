/**
 * Pulse Income — full IncomeView inside Pulse chrome.
 */
import React from 'react';
import PulsePageShell from './PulsePageShell';
import IncomeView from './IncomeView';
import { IncomeSource, Currency, CountryConfig, RecurringPayment, PaymentHistory } from '../types';

interface Props {
  incomeSources: IncomeSource[];
  incomeMode: 'simple' | 'detailed';
  monthlyIncome: string;
  summaryCurrency: Currency;
  countries: CountryConfig[];
  payments: RecurringPayment[];
  history: PaymentHistory[];
  addIncomeSource: (src: Omit<IncomeSource, 'id'>) => void | Promise<void>;
  deleteIncomeSource: (id: string) => void | Promise<void>;
  updateIncomeMode: (mode: 'simple' | 'detailed') => void | Promise<void>;
  updateMonthlyIncome: (val: string) => void | Promise<void>;
  isReadOnly?: boolean;
}

export default function PulseIncome(props: Props) {
  return (
    <PulsePageShell title="Income" subtitle="Sources · cashflow coverage">
      <div className="px-1 sm:px-2">
        <IncomeView {...props} />
      </div>
    </PulsePageShell>
  );
}
