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
  onRecordPayment: (paymentId: string, amount?: number, status?: 'paid' | 'delayed' | 'carry', taggedFor?: string) => Promise<any>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  onRecordPayment,
  isOpen: externalIsOpen,
  onOpenChange
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
      // Send command and current database state to the backend Agent endpoint
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: command,
          payments,
          history,
          userProfile
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reach assistant server.');
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
        
        await onAddPayment({
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
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: "Sorry, I had trouble processing your request. Please check your network and try again.",
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
      <div className="absolute bottom-20 right-4 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-650 to-violet-650 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all border border-indigo-400/20 cursor-pointer"
          id="floating-haven-agent-btn"
        >
          <Sparkles className="w-5 h-5 animate-pulse" />
        </motion.button>
      </div>

      {/* Slide-up Agent assistant drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/50 z-40 rounded-3xl"
            />

            {/* Slide-up Container Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 h-[85%] bg-white dark:bg-slate-950 rounded-t-3xl border-t border-slate-100 dark:border-slate-900 shadow-2xl z-50 flex flex-col overflow-hidden"
              id="haven-agent-drawer"
            >
              {/* Drawer handle notch */}
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mt-3 shrink-0" />

              {/* Header section */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-900 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Haven Agent
                    </h3>
                    <p className="text-[9px] text-slate-450 dark:text-slate-500 font-bold">Write comments to quickly log transactions</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 no-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'text-left justify-start'}`}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}

                    <div className="flex flex-col max-w-[75%] gap-1">
                      <div
                        className={`px-3 py-2.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold px-1 select-none">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex gap-2.5 justify-start text-left">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 px-3 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Analyzing comment...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested comments prompt row */}
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 overflow-x-auto shrink-0 no-scrollbar flex gap-2">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleUserCommand(s.prompt)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-250 dark:border-slate-800 text-slate-650 dark:text-slate-350 bg-slate-50/50 dark:bg-slate-900/30 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1 shrink-0 transition-all cursor-pointer text-left"
                  >
                    <MessageSquare className="w-3 h-3 text-indigo-500" />
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
              <div className="p-4 border-t border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0">
                <form onSubmit={handleTextSubmit} className="w-full flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Enter your comment, e.g. 'spent 15 dollars on Spotify today'..."
                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isProcessing}
                    className="px-3.5 bg-indigo-650 hover:bg-indigo-750 disabled:opacity-40 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
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
