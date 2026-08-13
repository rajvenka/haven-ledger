/**
 * Pulse Investment plan — full InvestmentPlanView in Pulse chrome.
 */
import React from 'react';
import PulsePageShell from './PulsePageShell';
import InvestmentPlanView from './InvestmentPlanView';

export default function PulseInvestment(props: any) {
  return (
    <PulsePageShell title="Investment plan" subtitle="Contributions · recurring · cash targets">
      <div className="px-1 sm:px-2">
        <InvestmentPlanView {...props} />
      </div>
    </PulsePageShell>
  );
}
