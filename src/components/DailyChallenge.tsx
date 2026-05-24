import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, ArrowRight, CheckCircle2, XCircle, AlertCircle, HelpCircle, Trophy, Globe, Loader2 } from 'lucide-react';
import { FandomTopic, LeaderboardEntry } from '../types';

interface DailyChallengeProps {
  currentUsername: string;
  setCurrentUsername: (name: string) => void;
  onCompleteChallenge: () => void;
  jumpToTab: (tab: 'leaderboard') => void;
}

export default function DailyChallenge({
  currentUsername,
  setCurrentUsername,
  onCompleteChallenge,
  jumpToTab
}: DailyChallengeProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<FandomTopic[]>([]);
  const [dateStr, setDateStr] = useState<string>('');

  // Active game state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [gameState, setGameState] = useState<'guesser' | 'revealed' | 'complete'>('guesser');
  const [userAnswers, setUserAnswers] = useState<{ [id: string]: { guess: boolean; isCorrect: boolean } }>({});
  const [score, setScore] = useState<number>(0);
  
  // Leaderboard posting states
  const [typedName, setTypedName] = useState<string>(currentUsername);
  const [posted, setPosted] = useState<boolean>(false);

  useEffect(() => {
    fetchDailyTopics();
  }, []);

  const fetchDailyTopics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/fandoms/daily');
      if (!res.ok) throw new Error("Failed to load daily challenge topics.");
      const data = await res.json();
      setTopics(data.topics || []);
      setDateStr(data.date || "");
    } catch (err: any) {
      console.error(err);
      setError("Unable to sync today's daily fandom ledger. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentTopic = topics[currentIndex];

  const handleGuess = (guess: boolean) => {
    if (!currentTopic) return;
    
    const isCorrect = guess === currentTopic.isReal;
    const newAnswers = {
      ...userAnswers,
      [currentTopic.id]: { guess, isCorrect }
    };
    
    setUserAnswers(newAnswers);
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setGameState('revealed');
  };

  const handleNext = () => {
    if (currentIndex + 1 < topics.length) {
      setCurrentIndex((prev) => prev + 1);
      setGameState('guesser');
    } else {
      setGameState('complete');
      onCompleteChallenge();
    }
  };

  const handlePostScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedName.trim()) return;
    
    // Save username globally
    setCurrentUsername(typedName.trim());

    // Update daily leaderboard in localStorage
    const key = 'fandom-leaderboard-daily';
    const stored = localStorage.getItem(key);
    let entries: LeaderboardEntry[] = [];
    if (stored) {
      entries = JSON.parse(stored);
    }

    // Filter out existing submissions for exact username to avoid duplicates
    entries = entries.filter((e) => e.name !== typedName.trim());

    const accuracy = Math.round((score / topics.length) * 100);
    const newEntry: LeaderboardEntry = {
      name: typedName.trim(),
      score: score,
      accuracy: accuracy,
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
      mode: 'daily'
    };

    entries.push(newEntry);
    localStorage.setItem(key, JSON.stringify(entries));
    setPosted(true);

    // Jump to leaderboard tab
    setTimeout(() => {
      jumpToTab('leaderboard');
    }, 1200);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-150 shadow-xs max-w-xl mx-auto">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <h3 className="font-display font-medium text-lg text-slate-800">Reviewing subculture ledgers...</h3>
        <p className="text-slate-400 text-sm mt-1">Sourcing real and fake fandom records</p>
      </div>
    );
  }

  if (error || topics.length === 0) {
    return (
      <div className="bg-rose-50 border border-rose-150 rounded-2xl p-6 text-center max-w-xl mx-auto">
        <AlertCircle className="h-8 w-8 text-rose-600 mx-auto mb-3" />
        <h3 className="font-display font-bold text-lg text-rose-900">Synchronization Offline</h3>
        <p className="text-rose-700 text-sm mt-1 mb-4">{error || "No daily subculture challenges prepared."}</p>
        <button
          onClick={fetchDailyTopics}
          className="bg-rose-600 font-sans font-semibold text-white px-5 py-2 rounded-xl text-sm hover:bg-rose-700 transition"
        >
          Check Archives Again
        </button>
      </div>
    );
  }

  // Active Guessing or Revealed Step
  if (gameState !== 'complete' && currentTopic) {
    const isRevealed = gameState === 'revealed';
    const lastResult = userAnswers[currentTopic.id];

    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        {/* Game Progress Indicator */}
        <div className="flex justify-between items-center mb-4 px-1">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
            <span>DAILY: {dateStr}</span>
          </div>
          <div className="font-mono text-xs font-semibold text-slate-400">
            FANDOM STATUS: <span className="text-slate-900">{currentIndex + 1} / {topics.length}</span>
          </div>
        </div>

        {/* Dynamic Card Container */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[380px] flex flex-col justify-between">
          
          {/* Accent Header */}
          <div className="bg-slate-950 p-4 border-b border-gray-150 flex items-center justify-between text-white">
            <span className="text-[11px] font-mono tracking-widest bg-indigo-500/30 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full uppercase">
              {currentTopic.category}
            </span>
            <span className="text-xs text-slate-400 font-medium">Topic Ledger #{currentTopic.id}</span>
          </div>

          {/* Core Content */}
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
            {/* Topic Title */}
            <h3 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight leading-snug mb-3">
              {currentTopic.topicName}
            </h3>

            {/* Topic Description Box */}
            <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-xl text-slate-700 text-sm leading-relaxed">
              {currentTopic.description}
            </div>

            {/* Reveal state animation / feedback */}
            {isRevealed && lastResult && (
              <div className="mt-5 animate-fade-in space-y-4">
                {/* Result Title */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  lastResult.isCorrect 
                    ? 'bg-emerald-50/70 border-emerald-150 text-emerald-900' 
                    : 'bg-rose-50/70 border-rose-150 text-rose-900'
                }`}>
                  {lastResult.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-display font-bold text-base leading-tight">
                      {lastResult.isCorrect ? "Correct verdict!" : "Incorrect deduction!"}
                    </h4>
                    <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                      You guessed this fandom is <strong>{lastResult.guess ? "REAL" : "FAKE"}</strong>. 
                      In reality, it is <strong>{currentTopic.isReal ? "REAL" : "FAKE"}</strong>!
                    </p>
                  </div>
                </div>

                {/* Did You Know section */}
                <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-xl">
                  <h5 className="font-display font-semibold text-indigo-950 text-xs flex items-center gap-1.5 uppercase tracking-wider mb-2">
                    <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span>Did you know?</span>
                  </h5>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    {currentTopic.didYouKnow}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Panel */}
          <div className="bg-slate-50 p-4 border-t border-gray-100 rounded-b-2xl">
            {!isRevealed ? (
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  id="btn-guess-fake"
                  onClick={() => handleGuess(false)}
                  className="bg-white hover:bg-rose-50 hover:border-rose-350 border border-gray-200 text-rose-700 font-sans font-bold py-3.5 px-4 rounded-xl shadow-xs transition duration-250 text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>FICTION / FAKE</span>
                </button>
                <button
                  id="btn-guess-real"
                  onClick={() => handleGuess(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 text-white font-sans font-bold py-3.5 px-4 rounded-xl shadow-xs transition duration-250 text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span>ACTUALLY REAL</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-next-fandom"
                onClick={handleNext}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-sans font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{currentIndex + 1 === topics.length ? "Determine Final Score" : "Next Fandom Ledger"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Current Streak summary */}
        <div className="flex justify-center items-center gap-1.5 mt-4 text-[11px] font-mono font-medium text-slate-400">
          <span>Correct ledger verdicts:</span>
          <span className="text-indigo-600 font-bold">{score} / {currentIndex + (isRevealed ? 1 : 0)}</span>
        </div>
      </div>
    );
  }

  // Challenge Complete Summary Card
  const scorePercentage = Math.round((score / topics.length) * 100);
  let badgeTitle = "Mainstream Conformist";
  let badgeDesc = "You struggle to spot crazy subcultures, preferring conventional high-street hobbies.";
  let badgeIconColor = "text-slate-400";

  if (scorePercentage === 100) {
    badgeTitle = "Absolute Subculture Deity";
    badgeDesc = "You possess encyclopedic awareness of Earth's weirdest subcultures. Nothing escapes you!";
    badgeIconColor = "text-amber-500";
  } else if (scorePercentage >= 80) {
    badgeTitle = "Hyper-Niche Professor";
    badgeDesc = "Highly impressive. You easily distinguish eccentric subculture groups from fictional parodies.";
    badgeIconColor = "text-indigo-500";
  } else if (scorePercentage >= 60) {
    badgeTitle = "Quirky Anthropologist";
    badgeDesc = "Decent awareness of human weirdness. You spot a solid half of the ledger's eccentricities.";
    badgeIconColor = "text-emerald-500";
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6 sm:p-8 max-w-xl mx-auto animate-fade-in text-center">
      {/* Trophy Circle Banner */}
      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
        <Trophy className="h-8 w-8 text-amber-500" />
      </div>

      <h2 className="font-display font-extrabold text-2xl text-slate-900">
        Challenge Finalized!
      </h2>
      <p className="text-slate-500 text-sm mt-1">You scrutinized today's seeded subcultures</p>

      {/* Accuracy Scoring breakdown */}
      <div className="bg-slate-50 border border-gray-100 rounded-2xl p-5 my-6 flex items-center justify-around">
        <div>
          <span className="block font-display font-extrabold text-3xl sm:text-4xl text-slate-950">
            {score} / {topics.length}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Correct guesses</span>
        </div>
        <div className="h-8 w-[1px] bg-gray-250" />
        <div>
          <span className={`block font-display font-extrabold text-3xl sm:text-4xl ${
            scorePercentage >= 80 ? 'text-emerald-600' : scorePercentage >= 60 ? 'text-amber-600' : 'text-slate-700'
          }`}>
            {scorePercentage}%
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Accuracy rating</span>
        </div>
      </div>

      {/* Achievement Banner */}
      <div className="border border-indigo-100/70 bg-indigo-50/30 rounded-xl p-4 text-left flex items-start gap-3 mb-6">
        <div className={`p-2.5 rounded-lg bg-white shadow-xs ${badgeIconColor}`}>
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <span className="font-sans text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Unlocked Rank</span>
          <h4 className="font-display font-extrabold text-slate-900 text-base">{badgeTitle}</h4>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{badgeDesc}</p>
        </div>
      </div>

      {/* Post Score Form */}
      {!posted ? (
        <form onSubmit={handlePostScore} className="text-left space-y-3.5 border-t border-gray-150 pt-6">
          <div>
            <label htmlFor="user-name-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5ID">
              Post Score to Leaderboard
            </label>
            <div className="flex gap-2">
              <input
                id="user-name-input"
                type="text"
                required
                maxLength={20}
                placeholder="Enter nickname (e.g. FandomFinder_01)"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-sans focus:outline-indigo-600 placeholder:text-slate-400 shadow-2xs"
              />
              <button
                id="btn-submit-score"
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-semibold text-xs py-2.5 px-4 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Globe className="h-4 w-4" />
                <span>Submit Stats</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            *Posting is optional. If you submit, your score and nickname will be added to the daily leaderboard for local brag rights.
          </p>
        </form>
      ) : (
        <div className="border border-emerald-100 bg-emerald-50/50 rounded-xl p-4.5 text-center mt-6 animate-fade-in text-emerald-950 text-sm font-semibold flex items-center justify-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Stats verified and posted to Daily Leaderboard!</span>
        </div>
      )}
    </div>
  );
}
