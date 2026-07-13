import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationBannerProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onNavigateToSecurity?: () => void;
}

export default function NotificationBanner({ notifications, onDismiss, onNavigateToSecurity }: NotificationBannerProps) {
  const [showBanner, setShowBanner] = useState(false);

  // If there are unread notifications, show exactly one simplified banner
  useEffect(() => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length > 0) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [notifications]);

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="absolute top-12 left-4 right-4 z-50 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] border border-slate-800/80 p-3.5 flex items-start gap-3 select-none cursor-pointer hover:bg-slate-850 dark:hover:bg-slate-900 transition-colors"
        onClick={() => {
          onNavigateToSecurity?.();
          setShowBanner(false);
        }}
      >
        {/* Simplified Icon */}
        <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 shadow-md shadow-indigo-500/20">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>

        {/* Simplified Content */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold">
              Notifications Available
            </span>
            <span className="text-[10px] text-slate-500 font-medium">now</span>
          </div>
          <h4 className="text-sm font-black text-white mt-0.5 leading-snug">View My Notifications</h4>
          <p className="text-xs text-slate-350 mt-1 leading-normal font-medium">
            You have pending billing alerts and system reminders. Click here to check them securely.
          </p>
        </div>

        {/* Close/Dismiss Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowBanner(false);
            // Dismiss all current unread notifications so it doesn't show again immediately
            notifications.forEach(n => {
              if (!n.read) onDismiss(n.id);
            });
          }}
          className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
