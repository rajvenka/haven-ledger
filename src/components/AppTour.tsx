import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Globe, TrendingUp, Briefcase, ClipboardList, FileBarChart, BrainCircuit } from 'lucide-react';

interface TourStep {
  tab: string;
  needsMobileMenu?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface AppTourProps {
  onNavigate: (tab: string) => void;
  onOpenMobileMenu: (open: boolean) => void;
  onFinish: () => void;
  hasFeature?: (feature: string) => boolean;
}

// Finds whichever variant (desktop sidebar vs mobile bottom-nav/drawer) is actually
// rendered and visible right now - both exist in the DOM simultaneously (CSS-hidden by
// breakpoint), so a plain getElementById could return the hidden one.
function findVisibleTourTarget(tab: string): HTMLElement | null {
  for (const suffix of ['desktop', 'mobile']) {
    const el = document.getElementById(`tour-tab-${tab}-${suffix}`);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

export default function AppTour({ onNavigate, onOpenMobileMenu, onFinish, hasFeature }: AppTourProps) {
  const allSteps: (TourStep & { feature?: string })[] = [
    { tab: 'summary', icon: <LayoutDashboard className="w-6 h-6" />, title: 'Dashboard', description: 'Your home base - a quick summary of bills, spending, and what needs attention.' },
    { tab: 'expenses', icon: <Globe className="w-6 h-6" />, title: 'Expenses & Bills', description: 'Track recurring bills and subscriptions, see what\'s due, and mark payments as done.' },
    { tab: 'income', needsMobileMenu: true, icon: <TrendingUp className="w-6 h-6" />, feature: 'income', title: 'Income', description: 'Log income sources and keep track of what\'s coming in.' },
    { tab: 'portfolio', needsMobileMenu: true, icon: <Briefcase className="w-6 h-6" />, feature: 'portfolio', title: 'Portfolio', description: 'Your stock and mutual fund holdings, with live prices and gains at a glance.' },
    { tab: 'investment_plan', needsMobileMenu: true, icon: <ClipboardList className="w-6 h-6" />, feature: 'portfolio', title: 'Investment Plan', description: 'Track who\'s contributing what, split ownership, and manage recurring contribution plans.' },
    { tab: 'reports', needsMobileMenu: true, icon: <FileBarChart className="w-6 h-6" />, feature: 'portfolio', title: 'Reports', description: 'Deeper analysis - allocation charts, price movement, target progress, and more.' },
    { tab: 'ai', icon: <BrainCircuit className="w-6 h-6" />, feature: 'ai', title: 'AI Insights', description: 'Ask questions about your finances in plain language and get instant answers.' },
  ];
  const steps = allSteps.filter(s => !s.feature || !hasFeature || hasFeature(s.feature));

  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cardPos, setCardPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number; centered: boolean }>({ centered: true });
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!step) return;
    const isMobileViewport = window.innerWidth < 768;
    onNavigate(step.tab);
    onOpenMobileMenu(isMobileViewport && !!step.needsMobileMenu);
    setHighlightRect(null);

    let attempts = 0;
    const CARD_WIDTH = 384; // max-w-sm
    const CARD_HEIGHT = 260; // rough estimate for spacing decisions
    const MARGIN = 16;

    const measure = () => {
      const el = findVisibleTourTarget(step.tab);
      if (el) {
        const r = el.getBoundingClientRect();
        setHighlightRect({ top: r.top, left: r.left, width: r.width, height: r.height });

        const isSidebar = r.left < 300 && r.width < 300 && window.innerWidth >= 768;
        if (isSidebar) {
          // Desktop sidebar item: place the card just to the right of the sidebar,
          // vertically near the highlighted row rather than stacking above/below it.
          const top = Math.min(Math.max(r.top - 40, MARGIN), window.innerHeight - CARD_HEIGHT - MARGIN);
          setCardPos({ top, left: 280, centered: false });
        } else {
          const spaceAbove = r.top;
          const spaceBelow = window.innerHeight - (r.top + r.height);
          if (spaceBelow >= CARD_HEIGHT || spaceBelow >= spaceAbove) {
            setCardPos({ top: Math.min(r.top + r.height + MARGIN, window.innerHeight - CARD_HEIGHT - MARGIN), centered: true });
          } else {
            setCardPos({ top: Math.max(r.top - CARD_HEIGHT - MARGIN, MARGIN), centered: true });
          }
        }
      } else if (attempts < 15) {
        attempts++;
        requestAnimationFrame(measure);
      } else {
        setCardPos({ centered: true });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(measure));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    return () => onOpenMobileMenu(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (index: number) => setStepIndex(index);

  if (!step) return null;

  const cardStyle: React.CSSProperties = cardPos.centered
    ? { top: cardPos.top, left: '50%', transform: 'translateX(-50%)' }
    : { top: cardPos.top, left: cardPos.left };

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Very light dim so the real page underneath stays visible */}
      <div className="absolute inset-0 bg-black/15" />

      {highlightRect && (
        <div
          className="absolute rounded-2xl ring-4 ring-indigo-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] animate-pulse pointer-events-none transition-all duration-300"
          style={{
            top: highlightRect.top - 6,
            left: highlightRect.left - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
          }}
        />
      )}

      <div
        className="absolute px-4 pointer-events-none transition-all duration-300"
        style={highlightRect ? cardStyle : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl w-[calc(100vw-2rem)] max-w-sm shadow-2xl overflow-hidden pointer-events-auto">
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
    </div>
  );
}
