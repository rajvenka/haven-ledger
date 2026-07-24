import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Globe, TrendingUp, Briefcase, ClipboardList, FileBarChart, BrainCircuit } from 'lucide-react';

interface TourStep {
  tab: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface AppTourProps {
  onNavigate: (tab: string) => void;
  onFinish: () => void;
  hasFeature?: (feature: string) => boolean;
}

export default function AppTour({ onNavigate, onFinish, hasFeature }: AppTourProps) {
  const allSteps: (TourStep & { feature?: string })[] = [
    { tab: 'summary', icon: <LayoutDashboard className="w-6 h-6" />, title: 'Dashboard', description: 'Your home base - a quick summary of bills, spending, and what needs attention.' },
    { tab: 'expenses', icon: <Globe className="w-6 h-6" />, title: 'Expenses & Bills', description: 'Track recurring bills and subscriptions, see what\'s due, and mark payments as done.' },
    { tab: 'income', icon: <TrendingUp className="w-6 h-6" />, feature: 'income', title: 'Income', description: 'Log income sources and keep track of what\'s coming in.' },
    { tab: 'portfolio', icon: <Briefcase className="w-6 h-6" />, feature: 'portfolio', title: 'Portfolio', description: 'Your stock and mutual fund holdings, with live prices and gains at a glance.' },
    { tab: 'investment_plan', icon: <ClipboardList className="w-6 h-6" />, feature: 'portfolio', title: 'Investment Plan', description: 'Track who\'s contributing what, split ownership, and manage recurring contribution plans.' },
    { tab: 'reports', icon: <FileBarChart className="w-6 h-6" />, feature: 'portfolio', title: 'Reports', description: 'Deeper analysis - allocation charts, price movement, target progress, and more.' },
    { tab: 'ai', icon: <BrainCircuit className="w-6 h-6" />, feature: 'ai', title: 'AI Insights', description: 'Ask questions about your finances in plain language and get instant answers.' },
  ];
  const steps = allSteps.filter(s => !s.feature || !hasFeature || hasFeature(s.feature));

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const goTo = (index: number) => {
    setStepIndex(index);
    onNavigate(steps[index].tab);
  };

  React.useEffect(() => {
    onNavigate(steps[0].tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full sm:max-w-sm shadow-2xl overflow-hidden">
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              {step.icon}
            </div>
            <button onClick={onFinish} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer" title="Skip tour">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Step {stepIndex + 1} of {steps.length}</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{step.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{step.description}</p>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 p-4 pt-0">
          {stepIndex > 0 && (
            <button onClick={() => goTo(stepIndex - 1)} className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <button onClick={onFinish} className="px-3 py-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-bold cursor-pointer">
            Skip Tour
          </button>
          <div className="flex-1" />
          <button
            onClick={() => (isLast ? onFinish() : goTo(stepIndex + 1))}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            {isLast ? 'Done' : 'Next'} {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
