import React from 'react';
import { HelpCircle, Trophy, Calendar, Sparkles, PlusCircle, Infinity } from 'lucide-react';

interface HeaderProps {
  activeTab: 'daily' | 'infinite' | 'leaderboard' | 'submit' | 'all-submissions';
  setActiveTab: (tab: 'daily' | 'infinite' | 'leaderboard' | 'submit' | 'all-submissions') => void;
  dailyCompleted: boolean;
  score: number;
}

export default function Header({ activeTab, setActiveTab, dailyCompleted, score }: HeaderProps) {
  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-50 shadow-xs">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 p-2.5 rounded-xl shadow-md text-white flex items-center justify-center">
            <HelpCircle className="h-6 w-6 text-indigo-400 rotate-12 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight text-slate-900">
              Fandom <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">or Fiction?</span>
            </h1>
            <p className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
              The Hyper-Niche Subculture Ledger
            </p>
          </div>
        </div>

        {/* Tab Actions */}
        <nav className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-50 p-1.5 rounded-xl">
          <button
            id="tab-daily"
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-sans font-medium transition-all duration-200 ${
              activeTab === 'daily'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Daily Challenge</span>
            {dailyCompleted && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            id="tab-infinite"
            onClick={() => setActiveTab('infinite')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-sans font-medium transition-all duration-200 ${
              activeTab === 'infinite'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Infinity className="h-4 w-4" />
            <span>Infinite AI Mode</span>
          </button>

          <button
            id="tab-leaderboard"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-sans font-medium transition-all duration-200 ${
              activeTab === 'leaderboard'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>Leaderboard</span>
          </button>

          <button
            id="tab-submit"
            onClick={() => setActiveTab('submit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-sans font-medium transition-all duration-200 ${
              activeTab === 'submit' || activeTab === 'all-submissions'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <PlusCircle className="h-4 w-4 text-indigo-500" />
            <span>Submit Topic</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
