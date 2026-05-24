import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Infinity, Trash2, Award, Zap, TrendingUp } from 'lucide-react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  currentUsername: string;
}

export default function Leaderboard({ currentUsername }: LeaderboardProps) {
  const [boardMode, setBoardMode] = useState<'daily' | 'infinite'>('daily');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  // Load and setup initial leaderboard data
  useEffect(() => {
    const key = `fandom-leaderboard-${boardMode}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      setEntries(JSON.parse(stored));
    } else {
      // Mock starting entries
      let mockList: LeaderboardEntry[] = [];
      if (boardMode === 'daily') {
        mockList = [
          { name: "SonicSoapSurfer", score: 5, accuracy: 100, timestamp: new Date(Date.now() - 3600000).toISOString(), mode: 'daily' },
          { name: "IroningAboveGlaciers", score: 4, accuracy: 80, timestamp: new Date(Date.now() - 7200000).toISOString(), mode: 'daily' },
          { name: "MuzakManiac_99", score: 4, accuracy: 80, timestamp: new Date(Date.now() - 14400000).toISOString(), mode: 'daily' },
          { name: "FruitStickerKing", score: 3, accuracy: 60, timestamp: new Date(Date.now() - 25200000).toISOString(), mode: 'daily' },
          { name: "MinecraftGravelBlaster", score: 2, accuracy: 40, timestamp: new Date(Date.now() - 86400000).toISOString(), mode: 'daily' }
        ];
      } else {
        mockList = [
          { name: "SubcultureProfessor", score: 18, accuracy: 92, timestamp: new Date(Date.now() - 1800000).toISOString(), mode: 'infinite' },
          { name: "LoreKeeper_42", score: 12, accuracy: 85, timestamp: new Date(Date.now() - 5400000).toISOString(), mode: 'infinite' },
          { name: "DuctTapeTuxedo", score: 9, accuracy: 78, timestamp: new Date(Date.now() - 10800000).toISOString(), mode: 'infinite' },
          { name: "ToasterPastrySkeptic", score: 6, accuracy: 60, timestamp: new Date(Date.now() - 43200000).toISOString(), mode: 'infinite' }
        ];
      }
      localStorage.setItem(key, JSON.stringify(mockList));
      setEntries(mockList);
    }
  }, [boardMode]);

  const clearLeaderboard = () => {
    if (confirm(`Are you sure you want to clear your local ${boardMode} leaderboard?`)) {
      const key = `fandom-leaderboard-${boardMode}`;
      localStorage.removeItem(key);
      setEntries([]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 animate-fade-in max-w-2xl mx-auto">
      {/* Mode selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500 stroke-[2]" />
            <span>Leaderboards</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Compare your strange cultural literacy against global explorers.
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            id="btn-board-daily"
            onClick={() => setBoardMode('daily')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all ${
              boardMode === 'daily'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Daily challenge</span>
          </button>
          <button
            id="btn-board-infinite"
            onClick={() => setBoardMode('infinite')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all ${
              boardMode === 'infinite'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Infinity className="h-3.5 w-3.5" />
            <span>Infinite AI mode</span>
          </button>
        </div>
      </div>

      {/* Board List */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-gray-200">
            <Award className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No scores submitted yet. Be the first!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-slate-50/50">
            {entries
              .sort((a, b) => b.score - a.score || b.accuracy - a.accuracy)
              .map((entry, index) => {
                const isUser = entry.isCurrentUser || entry.name === currentUsername;
                const rankLabels = ["🥇", "🥈", "🥉"];
                
                return (
                  <div
                    key={`${entry.name}-${index}`}
                    id={`leaderboard-entry-${index}`}
                    className={`flex items-center justify-between px-4 py-3.5 transition-colors ${
                      isUser 
                        ? 'bg-indigo-50/70 border-l-4 border-indigo-500' 
                        : 'hover:bg-white'
                    }`}
                  >
                    {/* Left: Rank & User Avatar Details */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-slate-400 w-6 text-center">
                        {index < 3 ? rankLabels[index] : `${index + 1}`}
                      </span>

                      {/* Mascot Placeholder */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shadow-sm ${
                        isUser 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white border border-gray-200 text-slate-700'
                      }`}>
                        {entry.name.substring(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold tracking-tight ${
                            isUser ? 'text-indigo-900 font-bold' : 'text-slate-800'
                          }`}>
                            {entry.name}
                          </span>
                          {isUser && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-sans font-bold px-1.5 py-0.5 rounded-sm">
                              You
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Right: Scores & Accuracy bars */}
                    <div className="flex items-center gap-5 text-right">
                      {/* Score Badge */}
                      <div>
                        <span className="block font-display font-extrabold text-slate-900 text-lg">
                          {entry.score}
                        </span>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-sans">
                          {boardMode === 'daily' ? 'points' : 'streak'}
                        </span>
                      </div>

                      {/* Accuracy Meter */}
                      <div className="w-16 hidden sm:block">
                        <div className="flex justify-between text-[10px] font-mono font-medium text-slate-400 mb-0.5">
                          <span>Acc.</span>
                          <span>{entry.accuracy}%</span>
                        </div>
                        <div className="w-full bg-slate-250 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              entry.accuracy >= 80 
                                ? 'bg-emerald-500' 
                                : entry.accuracy >= 60 
                                  ? 'bg-amber-500' 
                                  : 'bg-rose-500'
                            }`}
                            style={{ width: `${entry.accuracy}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Reset stats footer */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span>Scores are saved to your local session storage</span>
        </div>
        <button
          id="btn-clear-leaderboard"
          onClick={clearLeaderboard}
          className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-rose-50 transition-colors font-sans font-medium"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear My History</span>
        </button>
      </div>
    </div>
  );
}
