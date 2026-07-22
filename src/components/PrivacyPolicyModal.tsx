import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="fixed inset-4 md:inset-x-0 md:top-10 md:bottom-10 md:max-w-lg md:mx-auto bg-white dark:bg-slate-950 rounded-2xl shadow-2xl z-[61] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-900 shrink-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" /> Privacy Policy
              </h3>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-left text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="text-[10px] text-slate-400">Last updated: July 2026</p>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">What we collect</h4>
                <p>Your email address, display name, and whatever financial information you choose to enter — bills, payments, income, and notes. If you connect WhatsApp, we store the phone number you link.</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Who can see your data</h4>
                <p>Only you, and anyone you explicitly invite into a workspace with you. Data in a Family or Business workspace is visible to that workspace's members according to the access level you grant them. Nobody outside your invited workspace can see your data.</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">AI features</h4>
                <p>The AI Agent and AI Insights features send relevant parts of your request (like a message you type, or a summary of your bills) to Google's Gemini API to generate a response. This is only triggered when you actively use those features.</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Where it's stored</h4>
                <p>Your data is stored in a Supabase-hosted database with row-level security, meaning access rules are enforced at the database level, not just in the app's interface.</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">What we don't do</h4>
                <p>We don't sell your data, and we don't show ads. This app doesn't currently share data with any third party except Google (for the AI features above) and Supabase (for hosting).</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Your data, your control</h4>
                <p>You can delete individual bills, income entries, or your rewards data anytime from within the app. To delete your entire account or request an export of your data, contact the app administrator.</p>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
