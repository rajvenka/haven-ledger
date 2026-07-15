import React from 'react';

interface IPhoneFrameProps {
  children: React.ReactNode;
}

export default function IPhoneFrame({ children }: IPhoneFrameProps) {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      {children}
    </div>
  );
}

