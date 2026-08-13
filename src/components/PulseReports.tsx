/**
 * Pulse Reports — full ReportsView in Pulse chrome.
 */
import React from 'react';
import PulsePageShell from './PulsePageShell';
import ReportsView from './ReportsView';

export default function PulseReports(props: any) {
  return (
    <PulsePageShell title="Reports" subtitle="Portfolio · dividends · fees · snapshots">
      <div className="px-1 sm:px-2">
        <ReportsView {...props} />
      </div>
    </PulsePageShell>
  );
}
