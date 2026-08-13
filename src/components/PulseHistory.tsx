/**
 * Pulse Payment History — full history tools in Pulse chrome.
 */
import React from 'react';
import PulsePageShell from './PulsePageShell';
import PaymentHistoryView from './PaymentHistoryView';

export default function PulseHistory(props: any) {
  const count = Array.isArray(props.history) ? props.history.length : 0;
  return (
    <PulsePageShell title="Payment history" subtitle={`${count} logged payment${count === 1 ? '' : 's'}`}>
      <div className="px-1 sm:px-2">
        <PaymentHistoryView {...props} />
      </div>
    </PulsePageShell>
  );
}
