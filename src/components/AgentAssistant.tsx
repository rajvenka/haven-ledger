import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  Sparkles,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, UserProfile } from '../types';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} took too long — please try again.`)), ms)),
  ]);
}

// Colorizes +N%/-N% and +$N/-$N figures within assistant chat text - green for gains, rose
// for losses. String.split() with a capturing group puts the matched figures at odd array
// indices and the plain text between them at even indices - more reliable than re-testing
// each piece against the pattern, since a global regex's own lastIndex state would otherwise
// give inconsistent results across the map iteration.
const SIGNED_FIGURE_PATTERN = /([+\-]\$?[\d,]+(?:\.\d+)?%?)/g;
function renderColorizedText(text: string): React.ReactNode {
  const parts = text.split(SIGNED_FIGURE_PATTERN);
  return parts.map((part, i) => {
    if (i % 2 === 0) return <React.Fragment key={i}>{part}</React.Fragment>;
    const isGain = part.startsWith('+');
    return (
      <span key={i} className={`font-black ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {part}
      </span>
    );
  });
}

// Renders the agent's structured portfolioTable as an actual table + horizontal bar chart,
// instead of a wall of prose text. Sorted by pnlPct descending (should already arrive sorted
// from the model, but re-sorted here defensively rather than trusting that blindly).
function PortfolioTableCard({ rows }: { rows: PortfolioTableRow[] }) {
  const sorted = [...rows].sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  const chartData = sorted.map(r => ({ name: r.symbol, pnl: Number(r.pnlPct?.toFixed?.(1) ?? r.pnlPct) }));
  const chartHeight = Math.max(80, sorted.length * 28);

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <th className="text-left font-bold px-2.5 py-1.5">Symbol</th>
            <th className="text-left font-bold px-2.5 py-1.5">Portfolio</th>
            <th className="text-right font-bold px-2.5 py-1.5">P&L</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const isGain = (r.pnlPct ?? 0) >= 0;
            return (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">{r.symbol}</td>
                <td className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400 truncate max-w-[90px]">{r.portfolio}</td>
                <td className={`px-2.5 py-1.5 text-right font-black ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {isGain ? '+' : ''}{(r.pnlPct ?? 0).toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-1.5 pt-1 pb-1.5" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9 }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={70} />
            <Tooltip
              formatter={(v: number) => [`${v}%`, 'P&L']}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.pnl >= 0 ? '#059669' : '#e11d48'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Simpler than PortfolioTableCard - no chart needed for a bills list, and amounts are
// color-neutral (unlike P&L, a bill amount isn't inherently a "gain" or "loss").
function BillsTableCard({ rows }: { rows: BillsTableRow[] }) {
  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <th className="text-left font-bold px-2.5 py-1.5">Bill</th>
            <th className="text-left font-bold px-2.5 py-1.5">Due</th>
            <th className="text-right font-bold px-2.5 py-1.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{r.name}</td>
              <td className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.dueDate}</td>
              <td className="px-2.5 py-1.5 text-right font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {r.amount} {r.currency}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PortfolioSummaryItem {
  portfolio: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  livePrice: number;
  currency: string;
}

interface AgentAssistantProps {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  userProfile: UserProfile | null;
  summaryCurrency: string;
  portfolioSummary?: PortfolioSummaryItem[];
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => Promise<any>;
  onUpdatePayment?: (payment: RecurringPayment) => Promise<any>;
  onRecordPayment: (paymentId: string, amount?: number, status?: 'paid' | 'delayed' | 'carry', taggedFor?: string) => Promise<any>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideFab?: boolean;
}

interface PortfolioTableRow {
  symbol: string;
  portfolio: string;
  pnlPct: number;
  currency: string;
}

interface BillsTableRow {
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  portfolioTable?: PortfolioTableRow[];
  billsTable?: BillsTableRow[];
}

export default function AgentAssistant({
  payments,
  history,
  userProfile,
  summaryCurrency,
  portfolioSummary,
  onAddPayment,
  onUpdatePayment,
  onRecordPayment,
  isOpen: externalIsOpen,
  onOpenChange,
  hideFab
}: AgentAssistantProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => {
    if (onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalIsOpen(val);
    }
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const welcomeMessage: Message = {
    id: 'welcome',
    sender: 'assistant',
    text: "Hello! I am your Haven Agent. How can I help you today? You can write comments here to quickly add bills or log transactions, or ask about your portfolios - e.g. \"what's my best performer?\"",
    timestamp: new Date()
  };
  const chatHistoryStorageKey = userProfile?.uid ? `haven_agent_chat_${userProfile.uid}` : null;
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      if (!chatHistoryStorageKey) return [welcomeMessage];
      const raw = localStorage.getItem(chatHistoryStorageKey);
      if (!raw) return [welcomeMessage];
      const parsed = JSON.parse(raw) as Message[];
      if (!Array.isArray(parsed) || parsed.length === 0) return [welcomeMessage];
      // JSON round-trip loses Date objects (timestamp becomes a string) - restore them.
      return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
      return [welcomeMessage];
    }
  });
  // Persist on every change, capped at the last 50 messages so storage doesn't grow unbounded
  // over a long-running chat history.
  useEffect(() => {
    if (!chatHistoryStorageKey) return;
    try {
      localStorage.setItem(chatHistoryStorageKey, JSON.stringify(messages.slice(-50)));
    } catch { /* ignore storage errors (e.g. quota exceeded) */ }
  }, [messages, chatHistoryStorageKey]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const suggestions = [
    { label: "Log Gas Bill payment", prompt: "log transaction for Gas Bill" },
    { label: "Add Netflix Payment", prompt: "add Netflix payment of 15 AUD on day 10" },
    { label: "EB Bill paid for $40", prompt: "marked EB Bill as paid for 40 AUD" },
    { label: "How is my budget looking?", prompt: "How is my monthly budget looking?" }
  ];

  // Process user input
  const handleUserCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add user message to log
    const userMsgId = Math.random().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      sender: 'user',
      text: command,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setTextInput('');
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Only send the (potentially large) portfolio summary when the prompt (or the agent's
      // own most recent reply, e.g. it just asked "which portfolio?") actually looks
      // portfolio-related - keeps bill-entry messages (the common case) fast and light,
      // rather than sending every holding on every single message regardless of relevance.
      const portfolioKeywordPattern = /\b(stock|share|portfolio|invest|holding|fund|gainer|loser|perform|etoro|zerodha|webull|groww|stake|sasi)\b/i;
      const lastAssistantText = [...messages].reverse().find(m => m.sender === 'assistant')?.text || '';
      const looksPortfolioRelated = portfolioKeywordPattern.test(command) || portfolioKeywordPattern.test(lastAssistantText);

      // Build full chat history including the latest message
      const chatHistory = [...messages, newUserMessage].map(m => ({
        sender: m.sender,
        text: m.text
      }));

      // Send command, history, and current database state to the backend Agent endpoint.
      // 65s - slightly above the backend's own maxDuration (60s, configured in vercel.json).
      // The actual root cause of persistent timeouts wasn't this client-side value at all -
      // it was Vercel's default 10s function timeout silently killing api/agent.ts regardless
      // of what this was set to, since maxDuration was never configured for that function.
      // Now that it is, this just needs to not abort before the backend's own window ends.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 65000);
      let response: Response;
      try {
        response = await fetch('/api/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: command,
            payments,
            history,
            userProfile,
            portfolioSummary: looksPortfolioRelated ? portfolioSummary : undefined,
            chatHistory
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        let errMessage = 'Failed to reach assistant server.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const result = await response.json();

      // Formulate assistant's message
      const assistantMsgId = Math.random().toString();
      const assistantMessage: Message = {
        id: assistantMsgId,
        sender: 'assistant',
        text: result.replyMessage || "I processed that, but I'm not sure how to respond.",
        timestamp: new Date(),
        portfolioTable: Array.isArray(result.portfolioTable) && result.portfolioTable.length > 0 ? result.portfolioTable : undefined,
        billsTable: Array.isArray(result.billsTable) && result.billsTable.length > 0 ? result.billsTable : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Perform background action if specified
      if (result.intent === 'add_expense' && result.addExpenseData) {
        const data = result.addExpenseData;
        const finalCurrency = data.currency || summaryCurrency || 'AUD';
        const finalCategory = data.category || 'Bills';
        const finalDay = data.dayOfMonth || new Date().getDate();
        
        const addedPayment = await withTimeout(onAddPayment({
          name: data.name || 'Unnamed Bill',
          amount: data.amount || 0,
          currency: finalCurrency,
          category: finalCategory,
          dayOfMonth: finalDay,
          billingCycle: data.billingCycle || 'monthly',
          paymentMethod: data.paymentMethod || 'manual',
          active: true,
          reminderDaysBefore: 3,
          paymentType: data.paymentType || 'fixed'
        }), 15000, 'Saving the payment');

        if (addedPayment && data.isPaid) {
          await withTimeout(onRecordPayment(addedPayment.id, addedPayment.amount, 'paid', addedPayment.taggedFor || 'Self'), 15000, 'Recording the payment');
        }
      } else if (result.intent === 'add_bulk_expenses' && Array.isArray(result.addBulkExpenseData)) {
        for (const data of result.addBulkExpenseData) {
          const finalCurrency = data.currency || summaryCurrency || 'AUD';
          const finalCategory = data.category || 'Bills';
          const finalDay = data.dayOfMonth || new Date().getDate();
          
          const addedPayment = await onAddPayment({
            name: data.name || 'Unnamed Bill',
            amount: data.amount || 0,
            currency: finalCurrency,
            category: finalCategory,
            dayOfMonth: finalDay,
            billingCycle: data.billingCycle || 'monthly',
            paymentMethod: data.paymentMethod || 'manual',
            active: true,
            reminderDaysBefore: 3,
            paymentType: data.paymentType || 'fixed'
          });

          if (addedPayment && data.isPaid) {
            await onRecordPayment(addedPayment.id, addedPayment.amount, 'paid', addedPayment.taggedFor || 'Self');
          }
        }
      } else if (result.intent === 'mark_paid' && result.markPaidData) {
        const data = result.markPaidData;
        
        // Find matching payment in our list
        let matched = payments.find(p => p.id === data.paymentId);
        if (!matched && data.paymentName) {
          // Fallback fuzzy search by name
          matched = payments.find(p => String(p.name || '').toLowerCase().includes(data.paymentName.toLowerCase()) || data.paymentName.toLowerCase().includes(String(p.name || '').toLowerCase()));
        }

        if (matched) {
          // Supports custom logging amount if extracted by AI
          const customAmount = data.amount || matched.amount;
          const status = data.status || 'paid';
          const taggedFor = data.taggedFor || matched.taggedFor || 'Self';
          await onRecordPayment(matched.id, customAmount, status, taggedFor);
        } else {
          setMessages(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              sender: 'assistant',
              text: `I wanted to log a payment for "${data.paymentName || 'that bill'}", but I couldn't find a configured payment with that name in your list. Try adding it as a bill/payment first!`,
              timestamp: new Date()
            }
          ]);
        }
      } else if (result.intent === 'update_expense' && result.updateExpenseData) {
        const data = result.updateExpenseData;

        let matched = payments.find(p => p.id === data.paymentId);
        if (!matched && data.paymentName) {
          matched = payments.find(p => String(p.name || '').toLowerCase().includes(data.paymentName.toLowerCase()) || data.paymentName.toLowerCase().includes(String(p.name || '').toLowerCase()));
        }

        if (matched && onUpdatePayment) {
          await onUpdatePayment({
            ...matched,
            name: data.name ?? matched.name,
            amount: data.amount ?? matched.amount,
            currency: data.currency ?? matched.currency,
            category: data.category ?? matched.category,
            dayOfMonth: data.dayOfMonth ?? matched.dayOfMonth,
            billingCycle: data.billingCycle ?? matched.billingCycle,
            paymentMethod: data.paymentMethod ?? matched.paymentMethod,
            paymentType: data.paymentType ?? matched.paymentType,
            active: data.active ?? matched.active,
          });
        } else if (!matched) {
          setMessages(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              sender: 'assistant',
              text: `I wanted to update "${data.paymentName || 'that bill'}", but I couldn't find a matching payment in your list. Could you tell me exactly which bill you mean?`,
              timestamp: new Date()
            }
          ]);
        }
      }

    } catch (err: any) {
      console.error(err);
      // Restore the message into the input box on failure - it was already cleared
      // optimistically when sending, so without this the user would need to retype the
      // whole thing just to retry after a transient failure like a timeout.
      setTextInput(command);
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `Sorry, I had trouble processing your request: ${err.message || 'Please check your network and try again.'}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    handleUserCommand(textInput);
  };

  return (
    <>
      {/* Floating Haven Agent Button */}
      {!hideFab && (
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="w-13 h-13 rounded-full bg-[#1c1c1e] dark:bg-white text-white dark:text-[#1c1c1e] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.16)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.24)] transition-all border border-slate-800/80 dark:border-slate-200/80 cursor-pointer relative overflow-hidden group"
          id="floating-haven-agent-btn"
        >
          {/* Subtle glowing Siri/Apple AI color accent background overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#5856d6]/20 via-[#007aff]/25 to-[#34c759]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <Sparkles className="w-5 h-5 text-[#0a84ff] dark:text-[#007aff] group-hover:text-pink-500 dark:group-hover:text-pink-500 transition-colors duration-300 animate-pulse relative z-10" />
        </motion.button>
      </div>
      )}

      {/* Slide-up Agent assistant drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40"
            />

            {/* Slide-up Container Panel */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed bottom-0 md:bottom-24 left-0 right-0 md:left-auto md:right-6 h-[80%] md:h-[620px] md:w-[400px] bg-white dark:bg-[#1c1c1e] rounded-t-3xl md:rounded-2xl border-t md:border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-2xl z-50 flex flex-col overflow-hidden"
              id="haven-agent-drawer"
            >
              {/* Drawer handle notch */}
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mt-3 shrink-0" />

              {/* Header section */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#007aff] dark:text-[#0a84ff]">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                      Haven Intelligence Agent
                    </h3>
                    <p className="text-[9px] text-[#8e8e93] dark:text-[#aeaeb2] font-semibold">Write natural comments to manage bills</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setMessages([welcomeMessage]);
                      if (chatHistoryStorageKey) {
                        try { localStorage.removeItem(chatHistoryStorageKey); } catch { /* ignore */ }
                      }
                    }}
                    title="Clear chat history"
                    className="p-1.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] rounded-full text-slate-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] rounded-full text-slate-500 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 no-scrollbar bg-[#f5f5f7]/40 dark:bg-[#1c1c1e]/40">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'text-left justify-start'}`}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="w-7 h-7 rounded-full text-white flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-tr from-[#5856d6] via-[#007aff] to-[#34c759]">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}

                    <div className={`flex flex-col gap-1 ${(msg.portfolioTable || msg.billsTable) ? 'max-w-[92%]' : 'max-w-[75%]'}`}>
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-[#007aff] dark:bg-[#0a84ff] text-white rounded-tr-sm text-right'
                            : 'bg-[#f2f2f7] dark:bg-[#2c2c2e] text-slate-900 dark:text-slate-100 rounded-tl-sm text-left'
                        }`}
                      >
                        {msg.sender === 'assistant' ? renderColorizedText(msg.text) : msg.text}
                        {msg.portfolioTable && <PortfolioTableCard rows={msg.portfolioTable} />}
                        {msg.billsTable && <BillsTableCard rows={msg.billsTable} />}
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold px-1 select-none text-left">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-[#e5e5ea] dark:bg-[#3a3a3c] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex gap-2.5 justify-start text-left">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#5856d6] via-[#007aff] to-[#34c759] text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] px-3.5 py-2.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007aff] dark:text-[#0a84ff]" />
                      <span>Analyzing comment...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested comments prompt row */}
              <div className="px-4 py-2.5 border-t border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] overflow-x-auto shrink-0 no-scrollbar flex gap-2">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleUserCommand(s.prompt)}
                    className="px-3 py-1.5 rounded-full border border-[#e5e5ea] dark:border-[#2c2c2e] text-[#555] dark:text-slate-300 bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 text-[10px] font-bold hover:bg-[#e5e5ea] dark:hover:bg-[#3a3a3c] flex items-center gap-1.5 shrink-0 transition-all cursor-pointer text-left"
                  >
                    <MessageSquare className="w-3 h-3 text-[#007aff] dark:text-[#0a84ff]" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Status and Error indicators */}
              {errorMessage && (
                <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 text-[10px] font-bold flex items-center gap-1.5 shrink-0 text-left">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Text comment form */}
              <div className="p-4 pb-5 border-t border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] shrink-0">
                <form onSubmit={handleTextSubmit} className="w-full flex gap-2.5">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type a comment to log a bill..."
                    className="flex-1 px-4 py-2.5 text-xs bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 border border-transparent focus:border-[#d1d1d6] dark:focus:border-[#48484a] focus:bg-white dark:focus:bg-[#1c1c1e] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 transition-all duration-200"
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isProcessing}
                    className="px-4 bg-[#007aff] hover:bg-[#007aff]/90 dark:bg-[#0a84ff] dark:hover:bg-[#0a84ff]/90 disabled:opacity-40 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer font-bold text-xs active:scale-95 shadow-sm shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
