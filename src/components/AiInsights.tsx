import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  BrainCircuit, 
  TrendingUp, 
  Bot, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  ThumbsUp, 
  DollarSign, 
  Activity, 
  CheckCircle2,
  ShieldCheck,
  Zap,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, UserProfile } from '../types';

interface AiInsightsProps {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  userProfile: UserProfile | null;
  onOpenAgent: (isOpen: boolean) => void;
  summaryCurrency: string;
}

interface GeminiInsightsData {
  summary: string;
  healthScore: number;
  insights: {
    type: 'warning' | 'saving' | 'tip' | 'info';
    title: string;
    description: string;
  }[];
  recommendations: string[];
  forecast: string;
}

export default function AiInsights({
  payments,
  history,
  userProfile,
  onOpenAgent,
  summaryCurrency = 'AUD'
}: AiInsightsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<GeminiInsightsData | null>(null);
  const [activeTab, setActiveTab] = useState<'insights' | 'recommendations'>('insights');

  // Local rule-based fallback generator for bill and payment metrics
  const generateLocalInsights = (): GeminiInsightsData => {
    const totalCount = payments.length;
    const activeCount = payments.filter(p => p.active).length;
    const totalMonthlyCost = payments.reduce((acc, p) => acc + (p.active ? p.amount : 0), 0);
    const flexiCount = payments.filter(p => p.active && p.paymentType === 'flexi').length;
    const directDebitCount = payments.filter(p => p.active && p.paymentMethod === 'direct_debit').length;

    // Calculate dynamic health score
    let score = 100;
    if (activeCount > 8) score -= 15;
    else if (activeCount > 5) score -= 5;
    
    // Penalize manual payments for bills since direct debit is preferred
    const manualCount = activeCount - directDebitCount;
    if (manualCount > 4) score -= 10;
    else if (manualCount > 2) score -= 5;

    // Ensure score bounded
    score = Math.max(30, Math.min(100, score));

    // Generate static but highly tailored smart rule-based insights
    const dynamicInsightsList: GeminiInsightsData['insights'] = [];
    const recs: string[] = [];

    if (totalCount === 0) {
      return {
        summary: "You don't have any bill or payment records added to Haven Vault yet.",
        healthScore: 100,
        insights: [
          {
            type: 'info',
            title: 'No Active Bills',
            description: 'Add your recurring bills, utility bills, or EMI payments to see detailed AI insights.'
          }
        ],
        recommendations: [
          'Add your first recurring payment to begin monitoring family expenses.',
          'Connect with your family group to split recurring billing costs.'
        ],
        forecast: 'Add billing entries to enable recurring cost forecasts.'
      };
    }

    // Heuristics
    if (flexiCount > 0) {
      dynamicInsightsList.push({
        type: 'info',
        title: `${flexiCount} Variable Cost Payments`,
        description: `You have ${flexiCount} flexible payment(s) (like Gas or EB Bills). Fluctuating utility costs can make budget tracking difficult.`
      });
      recs.push('For variable bills, use the Haven Agent comments to log the exact transaction amount each month.');
    }

    // Direct Debit recommendations
    if (manualCount > 0) {
      dynamicInsightsList.push({
        type: 'tip',
        title: 'Optimize with Direct Debit',
        description: `You have ${manualCount} bills paid manually. Direct Debit setup ensures you never miss a payment and often qualifies you for automatic 2-5% utility discounts.`
      });
      recs.push('Consider setting up Auto-Pay / Direct Debit for critical utility payments.');
    }

    // Category overlaps
    const categories = payments.map(p => p.category);
    const duplicateCategories = categories.filter((c, index) => categories.indexOf(c) !== index);
    if (duplicateCategories.includes('Entertainment')) {
      dynamicInsightsList.push({
        type: 'saving',
        title: 'Streaming Overlap Audit',
        description: 'You have multiple active recurring outgoings in the Entertainment category. Review whether family members are actively sharing streaming accounts to eliminate redundancy.'
      });
      recs.push('Bundle media platforms or try rotated-monthly streaming services to optimize entertainment costs.');
    }

    // Heavy bills alerts
    const expensiveSub = payments.find(p => p.amount > 100 && p.active);
    if (expensiveSub) {
      dynamicInsightsList.push({
        type: 'warning',
        title: `High-Cost Payment Alert`,
        description: `"${expensiveSub.name}" represents a significant portion of your recurring ledger (${summaryCurrency} ${expensiveSub.amount}).`
      });
      recs.push(`Audit ${expensiveSub.name} quarterly to ensure your family group is receiving full value for the cost.`);
    }

    // Add general recommendations if list is short
    if (recs.length < 3) {
      recs.push('Set billing alert reminders to 3 days before payment dates to prepare sufficient cash flow.');
      recs.push('Utilize family shared spaces to split expenses with other group members to offset high payment overhead.');
    }

    return {
      summary: `You are currently auditing ${activeCount} active payments with an aggregate monthly cost of ${summaryCurrency} ${totalMonthlyCost.toFixed(2)}. Your Billing Health score is currently evaluated at ${score}/100.`,
      healthScore: score,
      insights: dynamicInsightsList,
      recommendations: recs,
      forecast: `Based on your active billing cycles, your upcoming monthly recurring costs are expected to stay stabilized at ${summaryCurrency} ${totalMonthlyCost.toFixed(2)}, unless seasonal utility bills trigger variations.`
    };
  };

  // Run dynamic Gemini AI Insights
  const [usingOfflinePreview, setUsingOfflinePreview] = useState(false);

  const runAiAudit = async () => {
    setLoading(true);
    setError(null);
    setUsingOfflinePreview(false);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payments,
          history,
          userProfile
        })
      });

      if (!response.ok) {
        let errMessage = 'The AI audit failed to respond.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch { /* ignore parse failure, use default message */ }
        throw new Error(errMessage);
      }

      const result = await response.json();
      setInsightsData(result);
    } catch (err: any) {
      console.warn("AI Insights error:", err);
      setInsightsData(null);
      setError(err.message || 'Something went wrong reaching the AI audit.');
    } finally {
      setLoading(false);
    }
  };

  const showOfflinePreviewInstead = () => {
    setInsightsData(generateLocalInsights());
    setUsingOfflinePreview(true);
    setError(null);
  };

  // Generate initial state — no more auto-filling with the local heuristic preview on load.
  // That silently made every fresh visit look like "AI already ran" when it hadn't.
  const currentData = insightsData;
  const isRealAiResult = insightsData !== null && !usingOfflinePreview;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-6 text-left select-none bg-slate-50 dark:bg-slate-900">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-sm border border-slate-200/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-bold tracking-widest text-indigo-300 uppercase">Haven AI Intelligence</span>
          </div>
          <h2 className="text-base md:text-lg font-semibold tracking-tight leading-snug">Smart Bill & Payment Insights</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Run complete financial audits, detect redundant accounts, optimize direct debit, and forecast next month's recurring bills.
          </p>
        </div>

        <button
          onClick={runAiAudit}
          disabled={loading || payments.length === 0}
          className="apple-btn-primary py-2.5 px-5 shadow-none text-xs rounded-full cursor-pointer flex items-center justify-center gap-2 shrink-0 self-start md:self-center"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{loading ? 'Auditing ledger...' : 'Run Gemini AI Audit'}</span>
        </button>
      </div>

      {/* Real error state, with an explicit opt-in for the offline estimate - never a silent swap */}
      {error && (
        <div className="p-4 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200/30 dark:border-rose-900/30 rounded-xl text-left flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold leading-normal">{error}</p>
            <button
              onClick={showOfflinePreviewInstead}
              className="text-[10px] font-bold text-slate-500 dark:text-slate-400 underline cursor-pointer"
            >
              Show a rule-based estimate instead (not AI)
            </button>
          </div>
        </div>
      )}

      {/* Empty state before the first audit ever runs */}
      {!currentData && !error && !loading && (
        <div className="apple-card p-10 flex flex-col items-center text-center gap-3">
          <BrainCircuit className="w-10 h-10 text-slate-300 dark:text-slate-700" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">No audit run yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[320px] mx-auto leading-relaxed">
              This page only shows real analysis after you run one — nothing here is precomputed. Tap "Run Gemini AI Audit" above to have it actually look at your bills.
            </p>
          </div>
        </div>
      )}

      {currentData && (
      <>
      {/* Badge showing whether this is real AI output or the offline estimate */}
      <div className="flex items-center gap-1.5">
        {isRealAiResult ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-2.5 h-2.5" /> AI-Generated Analysis
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
            Rule-Based Estimate (not AI)
          </span>
        )}
      </div>

      {/* Main Grid: Health Score & Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score Card */}
        <div className="lg:col-span-1 apple-card flex flex-col justify-between items-center text-center space-y-4">
          <div className="w-full text-left">
            <h4 className="apple-section-label">Health Score</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-normal">Audit based on overhead & methods</p>
          </div>

          <div className="relative flex items-center justify-center w-28 h-28">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-100 dark:stroke-slate-900"
                strokeWidth="7"
                fill="transparent"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-indigo-500 dark:stroke-indigo-400"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * currentData.healthScore) / 100 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white leading-none">{currentData.healthScore}</span>
              <span className="text-[8px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mt-1">
                {currentData.healthScore >= 90 ? 'Excellent' : currentData.healthScore >= 75 ? 'Optimal' : 'Needs Review'}
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/80 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-450 font-semibold leading-normal text-left">
              {currentData.healthScore >= 85 
                ? 'Your ledger is streamlined. Your payment categories match optimal sharing limits.'
                : 'Consider configuring direct debits and bundling entertainment overlap costs.'
              }
            </p>
          </div>
        </div>

        {/* AI Summary and Future Forecast Card */}
        <div className="lg:col-span-2 apple-card flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="apple-section-label">Financial Overview</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-normal">Instant ledger synthesis</p>
              </div>
              <span className="apple-badge-indigo">
                Audited State
              </span>
            </div>

            <p className="text-xs text-slate-750 dark:text-slate-300 font-medium leading-relaxed">
              {currentData.summary}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/40 dark:border-slate-800/80 text-left space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Next 3 Months Forecast</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {currentData.forecast}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs and Details */}
      <div className="apple-card p-0 overflow-hidden space-y-0">
        {/* Tab Headers */}
        <div className="p-1 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900">
          <div className="apple-segmented-control border-none shadow-none">
            <button
              onClick={() => setActiveTab('insights')}
              className={activeTab === 'insights' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}
            >
              Smart Audit Items ({currentData.insights.length})
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={activeTab === 'recommendations' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}
            >
              Saving Recommendations ({currentData.recommendations.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          <AnimatePresence mode="wait">
            {activeTab === 'insights' ? (
              <motion.div
                key="insights-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-3"
              >
                {currentData.insights.map((insight, idx) => (
                  <div 
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                      insight.type === 'warning'
                        ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-100/30 dark:border-rose-900/30'
                        : insight.type === 'saving'
                        ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-100/30 dark:border-emerald-900/30'
                        : insight.type === 'tip'
                        ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-100/30 dark:border-indigo-900/30'
                        : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-150 dark:border-slate-800/80'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      insight.type === 'warning'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : insight.type === 'saving'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : insight.type === 'tip'
                        ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        : 'bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400'
                    }`}>
                      {insight.type === 'warning' && <AlertCircle className="w-3.5 h-3.5" />}
                      {insight.type === 'saving' && <Zap className="w-3.5 h-3.5" />}
                      {insight.type === 'tip' && <Lightbulb className="w-3.5 h-3.5" />}
                      {insight.type === 'info' && <HelpCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="space-y-0.5 text-left min-w-0">
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-white">{insight.title}</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="recs-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-3 text-left"
              >
                {currentData.recommendations.map((rec, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-150 dark:border-slate-850/60 rounded-xl flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-650 dark:text-slate-350 font-semibold leading-relaxed">
                      {rec}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      </>
      )}

      {/* Link to Agent Section (Interlocking workflow) */}
      <div className="apple-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 text-left relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-48 h-48 rounded-full bg-indigo-500/[0.03] blur-3xl pointer-events-none" />
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Haven Vault Assistant</span>
          </div>
          <h3 className="apple-title-main">Looking for Custom Inquiries?</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
            Interact with our voice-enabled conversational AI agent. You can type commands in real-time to instantly add bills, mark bills as paid, or ask custom questions about your history.
          </p>
        </div>

        <button
          onClick={() => onOpenAgent(true)}
          className="apple-btn-secondary py-2 px-4 shadow-none text-xs rounded-full cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Launch Chat Agent</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
