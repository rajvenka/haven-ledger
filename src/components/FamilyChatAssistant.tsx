import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Users } from 'lucide-react';
import { UserProfile } from '../types';

interface FamilyMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  senderName: string;
}

interface FamilyChatAssistantProps {
  currentUserUid: string;
  userProfile: UserProfile | null;
  familyMembers: UserProfile[];
  messages: FamilyMessage[];
  onSendMessage: (content: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export default function FamilyChatAssistant({
  currentUserUid,
  userProfile,
  familyMembers,
  messages,
  onSendMessage,
  isOpen,
  onClose
}: FamilyChatAssistantProps) {
  const [chatInputText, setChatInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const hasFamily = familyMembers.length > 1;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = chatInputText.trim();
    if (!content || isSending) return;
    setError(null);
    setIsSending(true);
    try {
      await onSendMessage(content);
      setChatInputText('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed bottom-0 md:bottom-24 left-0 right-0 md:left-auto md:right-6 h-[80%] md:h-[620px] md:w-[400px] bg-white dark:bg-[#1c1c1e] rounded-t-3xl md:rounded-2xl border-t md:border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3.5 border-b border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Family Chat</h3>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    {hasFamily ? `${familyMembers.length} members` : 'Just you, so far'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] rounded-full text-slate-500 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 no-scrollbar bg-[#f5f5f7]/40 dark:bg-[#1c1c1e]/40">
              {!hasFamily ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
                  <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-600 mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">No Family Yet</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                    Create or join a family in <strong>Family Sharing</strong> to start chatting with them here.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2 animate-bounce">💬</div>
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Start the Conversation</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Send a message to your family!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentUserUid;
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'justify-end' : 'text-left justify-start'}`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 shadow-sm font-extrabold text-[10px]">
                          {msg.senderName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col max-w-[75%] gap-1">
                        {!isMe && (
                          <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase px-1">{msg.senderName}</span>
                        )}
                        <div className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm text-right' : 'bg-[#f2f2f7] dark:bg-[#2c2c2e] text-slate-900 dark:text-slate-100 rounded-tl-sm text-left'}`}>
                          {msg.content}
                        </div>
                        <span className={`text-[8px] text-slate-400 font-bold px-1 select-none ${isMe ? 'text-right' : 'text-left'}`}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      {isMe && (
                        <div className="w-7 h-7 rounded-full bg-[#e5e5ea] dark:bg-[#3a3a3c] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 font-extrabold text-[10px]">
                          {userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase() || 'M'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {hasFamily && (
              <div className="p-4 pb-5 border-t border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] shrink-0">
                {error && <p className="text-[10px] text-red-500 font-semibold mb-2">{error}</p>}
                <form onSubmit={handleSend} className="w-full flex gap-2.5">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    placeholder="Message your family..."
                    className="flex-1 px-4 py-2.5 text-xs bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 border border-transparent focus:border-[#d1d1d6] dark:focus:border-[#48484a] focus:bg-white dark:focus:bg-[#1c1c1e] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all duration-200"
                  />
                  <button
                    type="submit"
                    disabled={!chatInputText.trim() || isSending}
                    className="px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer font-bold text-xs active:scale-95 shadow-sm shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
