import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal, Monitor, Smartphone, ShieldCheck } from 'lucide-react';

interface IPhoneFrameProps {
  children: React.ReactNode;
}

export default function IPhoneFrame({ children }: IPhoneFrameProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [isLaptopMode, setIsLaptopMode] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Auto-detect based on screen width on mount or fetch saved preference
    const saved = localStorage.getItem('pm_use_laptop_mode');
    if (saved !== null) {
      setIsLaptopMode(JSON.parse(saved));
    } else {
      setIsLaptopMode(window.innerWidth >= 768);
    }

    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearInterval(interval);
    };
  }, []);

  // On real mobile device screens, render the viewport contents directly with no nested wrappers to ensure native safe areas are active
  if (isMobileScreen) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
        {children}
      </div>
    );
  }

  const toggleMode = () => {
    const nextVal = !isLaptopMode;
    setIsLaptopMode(nextVal);
    localStorage.setItem('pm_use_laptop_mode', JSON.stringify(nextVal));
  };

  // If in laptop browser mode, we render a highly polished wide desktop application container
  if (isLaptopMode) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 select-none font-sans flex flex-col transition-colors duration-300">
        
        {/* Sleek Laptop View Top Switcher Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Laptop Web Console Mode
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleMode}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-sm animate-fade-in"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Switch to iPhone Frame View</span>
            </button>
          </div>
        </div>

        {/* Outer body grid / container that stretches beautifully on desktop */}
        <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto md:p-6 p-0 min-h-0 overflow-hidden">
          <div className="flex-1 bg-white dark:bg-slate-950 md:rounded-3xl md:border md:border-slate-200 dark:md:border-slate-800 md:shadow-2xl flex flex-col overflow-hidden relative">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, we render the gorgeous, physical iOS mockup chassis (excellent for device presentations)
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-0 md:p-6 select-none font-sans overflow-x-hidden relative">
      
      {/* Dynamic Floating Mode Switcher Panel on background (Desktop only) */}
      <div className="hidden md:flex absolute top-6 right-6 z-50">
        <button
          onClick={toggleMode}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-2xl backdrop-blur-md border border-white/15 flex items-center gap-2 shadow-lg transition-all cursor-pointer"
        >
          <Monitor className="w-4 h-4 text-indigo-400" />
          <span>Switch to Laptop Web View</span>
        </button>
      </div>

      {/* Subtle glowing ambient background for desktop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08)_0,transparent_60%)] pointer-events-none hidden md:block" />
      
      {/* iPhone Outer Chassis */}
      <div className="w-full h-screen md:h-[840px] md:w-[390px] md:max-w-[390px] bg-slate-950 md:rounded-[55px] relative md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] md:border-[10px] md:border-slate-800 flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Physical Volume Buttons & Power Button Mock (Desktop only) */}
        <div className="absolute left-[-13px] top-[140px] w-[3px] h-[40px] bg-slate-700 rounded-l-md hidden md:block" />
        <div className="absolute left-[-13px] top-[195px] w-[3px] h-[50px] bg-slate-700 rounded-l-md hidden md:block" />
        <div className="absolute left-[-13px] top-[255px] w-[3px] h-[50px] bg-slate-700 rounded-l-md hidden md:block" />
        <div className="absolute right-[-13px] top-[195px] w-[3px] h-[70px] bg-slate-700 rounded-r-md hidden md:block" />

        {/* Main Immersive OS Window */}
        <div className="flex-1 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col relative overflow-hidden rounded-none md:rounded-t-[36px] md:rounded-b-[36px]">
          {children}
        </div>

        {/* Physical Home Indicator (Desktop only - thin bar at the bottom) */}
        <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-[120px] h-1 bg-white/20 rounded-full z-40 hidden md:block pointer-events-none" />
      </div>
    </div>
  );
}
