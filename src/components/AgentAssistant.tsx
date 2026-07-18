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
  ArrowRight
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, UserProfile } from '../types';

interface AgentAssistantProps {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  userProfile: UserProfile | null;
  summaryCurrency: string;
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => Promise<any>;
  onUpdatePayment?: (payment: RecurringPayment) => Promise<any>;
  onRecordPayment: (paymentId: string, amount?: number, status?: 'paid' | 'delayed' | 'carry', taggedFor?: string) => Promise<any>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideFab?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function AgentAssistant({
  payments,
  history,
  userProfile,
  summaryCurrency,
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am your Haven Agent. How can I help you today? You can write comments here to quickly add bills or log transactions.",
      timestamp: new Date()
    }
  ]);
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
      // Build full chat history including the latest message
      const chatHistory = [...messages, newUserMessage].map(m => ({
        sender: m.sender,
        text: m.text
      }));

      // Send command, history, and current database state to the backend Agent endpoint
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: command,
          payments,
          history,
          userProfile,
          chatHistory
        })
      });

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
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Perform background action if specified
      if (result.intent === 'add_expense' && result.addExpenseData) {
        const data = result.addExpenseData;
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
          matched = payments.find(p => p.name.toLowerCase().includes(data.paymentName.toLowerCase()) || data.paymentName.toLowerCase().includes(p.name.toLowerCase()));
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
          matched = payments.find(p => p.name.toLowerCase().includes(data.paymentName.toLowerCase()) || data.paymentName.toLowerCase().includes(p.name.toLowerCase()));
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

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] rounded-full text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
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

                    <div className="flex flex-col max-w-[75%] gap-1">
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-[#007aff] dark:bg-[#0a84ff] text-white rounded-tr-sm text-right'
                            : 'bg-[#f2f2f7] dark:bg-[#2c2c2e] text-slate-900 dark:text-slate-100 rounded-tl-sm text-left'
                        }`}
                      >
                        {msg.text}
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
