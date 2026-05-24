import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Flame, 
  HelpCircle, 
  Heart, 
  PlusCircle, 
  Calendar, 
  Infinity as InfinityIcon, 
  Sparkles, 
  Send, 
  RotateCcw, 
  Check, 
  X, 
  User, 
  Edit2, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Lightbulb
} from 'lucide-react';
import { FandomTopic, LeaderboardEntry, UserSubmission } from './types';
// @ts-ignore
import lotusLogo from './assets/images/lotus_logo_1779402689808.png';

// Import Firebase Auth / Firestore SDK clients & helpers
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logoutUser, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';

// Synthesize custom audio feedback using standard Web Audio API (lightweight, zero dependency)
function playAudioFeedback(isCorrect: boolean) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (isCorrect) {
      // High-pitched upward chime/beep for correct guess
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Dynamic low sawtooth buzz for incorrect guess
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140.00, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(65.00, ctx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (err) {
    console.warn("Audio feedback context could not be created:", err);
  }
}

export default function App() {
  // Countdown Timer state
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Next UTC midnight (daily refresh)
      const nextMidnight = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      ));
      const diffMs = nextMidnight.getTime() - now.getTime();
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
      const seconds = Math.floor((diffMs / 1000) % 60);
      
      const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setTimeLeft(formatted);
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Username management
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('fandom-username') || `Weirdo_${Math.floor(Math.random() * 900) + 100}`;
  });
  const [isEditingUsername, setIsEditingUsername] = useState<boolean>(false);
  const [tempUsername, setTempUsername] = useState<string>(username);

  // Global score persistent state
  const [cumulativePoints, setCumulativePoints] = useState<number>(() => {
    return parseInt(localStorage.getItem('fandom-cumulative-points') || '0', 10);
  });
  const [highestStreak, setHighestStreak] = useState<number>(() => {
    return parseInt(localStorage.getItem('fandom-highest-streak') || '0', 10);
  });

  // Daily Streak tracking state
  const [dailyStreak, setDailyStreak] = useState<number>(() => {
    const lastPlayed = localStorage.getItem('fandom-last-played');
    const streakStr = localStorage.getItem('fandom-daily-streak') || '0';
    const streak = parseInt(streakStr, 10);
    if (!lastPlayed) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];
    
    if (lastPlayed === today || lastPlayed === yesterday) {
      return streak;
    }
    return 0;
  });

  // Firebase Authentication states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Current active mode: 'daily' (deterministic 5 questions) or 'infinite' (continuous AI generated)
  const [activeMode, setActiveMode] = useState<'daily' | 'infinite'>('daily');

  // Daily Challenge state
  const [dailyTopics, setDailyTopics] = useState<FandomTopic[]>([]);
  const [dailyIndex, setDailyIndex] = useState<number>(0);
  const [dailyGuesses, setDailyGuesses] = useState<{ [id: string]: { userGuess: boolean; isCorrect: boolean } }>({});
  const [dailyScore, setDailyScore] = useState<number>(0);
  const [dailyCompleted, setDailyCompleted] = useState<boolean>(() => {
    const lastPlayed = localStorage.getItem('fandom-last-played');
    const today = new Date().toISOString().split('T')[0];
    return lastPlayed === today;
  });
  const [dailyLoading, setDailyLoading] = useState<boolean>(false);

  // Infinite mode state
  const [infiniteTopic, setInfiniteTopic] = useState<FandomTopic | null>(null);
  const [infiniteStreak, setInfiniteStreak] = useState<number>(0);
  const [infiniteGuess, setInfiniteGuess] = useState<{ userGuess: boolean; isCorrect: boolean } | null>(null);
  const [infiniteLoading, setInfiniteLoading] = useState<boolean>(false);

  // General audit/submissions state
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [submitTopicName, setSubmitTopicName] = useState<string>('');
  const [submitDescription, setSubmitDescription] = useState<string>('');
  const [submitIsReal, setSubmitIsReal] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [evaluatedSubmission, setEvaluatedSubmission] = useState<UserSubmission | null>(null);

  // Facts & did you know section highlighted fact
  const [currentFact, setCurrentFact] = useState<{ title: string; text: string; category?: string }>({
    title: "Interchange Enthusiasts",
    text: "In Japan, a passionate community called 'Interchange-kun' photographs highway flyovers/interchanges at night for their industrial beauty, celebrating the concrete geometric flows as modern art masterpieces.",
    category: "Architecture & Travel"
  });

  // Leaderboard data state
  const [leaderboardMode, setLeaderboardMode] = useState<'daily' | 'infinite'>('daily');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);

  // Listen to Auth State changes & load/sync player data with Cloud Firestore database
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await loadOrSyncUserProfile(user);
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadOrSyncUserProfile = async (user: any) => {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      const localPoints = parseInt(localStorage.getItem('fandom-cumulative-points') || '0', 10);
      const localHighest = parseInt(localStorage.getItem('fandom-highest-streak') || '0', 10);
      const localDaily = parseInt(localStorage.getItem('fandom-daily-streak') || '0', 10);
      const localLastPlayed = localStorage.getItem('fandom-last-played') || '';

      if (docSnap.exists()) {
        const firestoreData = docSnap.data();
        
        // Merge strategy: choose whichever score / streak is higher to ensure no lost progress
        const mergedPoints = Math.max(localPoints, firestoreData.cumulativePoints || 0);
        const mergedHighest = Math.max(localHighest, firestoreData.highestStreak || 0);
        
        let mergedDaily = localDaily;
        let mergedLastPlayed = localLastPlayed;
        if (firestoreData.lastPlayed) {
          if (firestoreData.lastPlayed >= localLastPlayed) {
            mergedLastPlayed = firestoreData.lastPlayed;
            mergedDaily = firestoreData.dailyStreak || 0;
          }
        }

        // Update local React states and localStorage cache
        setCumulativePoints(mergedPoints);
        setHighestStreak(mergedHighest);
        setDailyStreak(mergedDaily);
        
        const finalName = firestoreData.username || username;
        setUsername(finalName);
        setTempUsername(finalName);
        localStorage.setItem('fandom-username', finalName);

        // Upload merged state back to server
        await setDoc(userDocRef, {
          uid: user.uid,
          username: finalName,
          cumulativePoints: mergedPoints,
          highestStreak: mergedHighest,
          dailyStreak: mergedDaily,
          lastPlayed: mergedLastPlayed,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        // Document does not exist yet; populate it from local progress
        const initialProfile = {
          uid: user.uid,
          username: username,
          cumulativePoints: localPoints,
          highestStreak: localHighest,
          dailyStreak: localDaily,
          lastPlayed: localLastPlayed,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userDocRef, initialProfile);
      }
      
      // Instantly refresh leaderboards once data matches
      await fetchLeaderboard();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }
  };

  // Sync client updates with local storage and Firebase Cloud simultaneously
  const updateCloudProgress = async (points: number, highest: number, daily?: number, lastPlayedDate?: string) => {
    setCumulativePoints(points);
    setHighestStreak(highest);
    if (daily !== undefined) setDailyStreak(daily);

    localStorage.setItem('fandom-cumulative-points', points.toString());
    localStorage.setItem('fandom-highest-streak', highest.toString());
    if (daily !== undefined) localStorage.setItem('fandom-daily-streak', daily.toString());
    if (lastPlayedDate !== undefined) localStorage.setItem('fandom-last-played', lastPlayedDate);

    if (auth.currentUser) {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      try {
        await updateDoc(userDocRef, {
          cumulativePoints: points,
          highestStreak: highest,
          ...(daily !== undefined && { dailyStreak: daily }),
          ...(lastPlayedDate !== undefined && { lastPlayed: lastPlayedDate }),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        // fallback to merge-set if doc hasn't loaded yet
        try {
          await setDoc(userDocRef, {
            uid: auth.currentUser.uid,
            username: username,
            cumulativePoints: points,
            highestStreak: highest,
            dailyStreak: daily !== undefined ? daily : dailyStreak,
            lastPlayed: lastPlayedDate !== undefined ? lastPlayedDate : (localStorage.getItem('fandom-last-played') || ''),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (innerErr) {
          handleFirestoreError(innerErr, OperationType.WRITE, `users/${auth.currentUser.uid}`);
        }
      }
      // Re-fetch standings asynchronously
      fetchLeaderboard();
    }
  };

  // Initialize general app data
  useEffect(() => {
    fetchDailyProgress();
    fetchLeaderboard();
    fetchSubmissions();
    loadRandomFeaturedFact();
  }, [leaderboardMode]);

  // Sync highest streak & points to localStorage as reactive fallback
  useEffect(() => {
    localStorage.setItem('fandom-cumulative-points', cumulativePoints.toString());
  }, [cumulativePoints]);

  useEffect(() => {
    localStorage.setItem('fandom-highest-streak', highestStreak.toString());
  }, [highestStreak]);

  // Load deterministic daily challenge
  const fetchDailyProgress = async () => {
    try {
      setDailyLoading(true);
      const res = await fetch('/api/fandoms/daily');
      if (res.ok) {
        const data = await res.json();
        setDailyTopics(data.topics || []);
      }
    } catch (e) {
      console.error("Unable to load daily challenge:", e);
    } finally {
      setDailyLoading(false);
    }
  };

  // Load approved community submissions
  const fetchSubmissions = async () => {
    try {
      const subCol = collection(db, 'submissions');
      const q = query(subCol, orderBy('createdAt', 'desc'), limit(15));
      const snap = await getDocs(q);
      const fsSubs: UserSubmission[] = [];
      snap.forEach((doc) => {
        fsSubs.push(doc.data() as UserSubmission);
      });
      
      if (fsSubs.length > 0) {
        setSubmissions(fsSubs);
      } else {
        // Fallback to initial seed submissions from backend API
        const res = await fetch('/api/fandoms/submissions');
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.submissions || []);
        }
      }
    } catch (e) {
      console.warn("Unable to load submissions from Firestore, fallback to Express backend:", e);
      const res = await fetch('/api/fandoms/submissions');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    }
  };

  // Fetch or construct leaderboards
  const fetchLeaderboard = async () => {
    try {
      const usersCol = collection(db, 'users');
      // Order by high score or high streak depending on leaderboard tab
      const q = query(
        usersCol,
        orderBy(leaderboardMode === 'daily' ? 'cumulativePoints' : 'highestStreak', 'desc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        entries.push({
          name: d.username || 'Anonymous',
          score: leaderboardMode === 'daily' ? (d.cumulativePoints || 0) : (d.highestStreak || 0),
          accuracy: 100,
          timestamp: d.updatedAt || new Date().toISOString(),
          isCurrentUser: auth.currentUser ? d.uid === auth.currentUser.uid : false,
          mode: leaderboardMode
        });
      });

      if (entries.length > 0) {
        setLeaderboardEntries(entries);
      } else {
        loadSeededLeaderboard();
      }
    } catch (e) {
      console.warn("Firestore leaderboard disconnected hook, fetching fallback localStorage boards:", e);
      loadSeededLeaderboard();
    }
  };

  const loadSeededLeaderboard = () => {
    const key = `fandom-leaderboard-${leaderboardMode}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLeaderboardEntries(JSON.parse(stored));
    } else {
      let initialList: LeaderboardEntry[] = [];
      if (leaderboardMode === 'daily') {
        initialList = [
          { name: "SonicSoapSurfer", score: 10, accuracy: 100, timestamp: new Date(Date.now() - 3600000).toISOString(), mode: 'daily' },
          { name: "ExtremeIroner", score: 8, accuracy: 80, timestamp: new Date(Date.now() - 7200000).toISOString(), mode: 'daily' },
          { name: "MuzakCollector_7", score: 8, accuracy: 80, timestamp: new Date(Date.now() - 14400000).toISOString(), mode: 'daily' },
          { name: "FruitStickerKing", score: 6, accuracy: 60, timestamp: new Date(Date.now() - 25200000).toISOString(), mode: 'daily' },
          { name: "ConcreteObserver", score: 6, accuracy: 60, timestamp: new Date(Date.now() - 86400000).toISOString(), mode: 'daily' }
        ];
      } else {
        initialList = [
          { name: "SubcultureProfessor", score: 14, accuracy: 92, timestamp: new Date(Date.now() - 1800000).toISOString(), mode: 'infinite' },
          { name: "LoreKeeper_42", score: 9, accuracy: 85, timestamp: new Date(Date.now() - 5400000).toISOString(), mode: 'infinite' },
          { name: "DuctTapeEnthusiast", score: 7, accuracy: 78, timestamp: new Date(Date.now() - 10800000).toISOString(), mode: 'infinite' },
          { name: "ToasterCrustEater", score: 5, accuracy: 60, timestamp: new Date(Date.now() - 43200000).toISOString(), mode: 'infinite' }
        ];
      }
      localStorage.setItem(key, JSON.stringify(initialList));
      setLeaderboardEntries(initialList);
    }
  };


  // Pull a fun historical fact to showcase in the "Did You Know" card
  const loadRandomFeaturedFact = () => {
    const facts = [
      {
        title: "The extreme ironing league",
        text: "Started in 1997 in the UK, this subculture combines rock climbing or hiking with domestic neatness. Enthusiasts bag summits while pressing shirts on vertical granite walls.",
        category: "Extreme Sports"
      },
      {
        title: "Kansas Barbed Wire Museum",
        text: "There are over 2,000 patented variations of antique barbed wire. Collectors gather at national conventions to buy, trade, and showcase 18-inch specimens.",
        category: "Collectibles & History"
      },
      {
        title: "Musical Canine Freestyle",
        text: "A real international sport where dogs and owners design highly choreographed, theatrical dance routines to select pop tracks, judged on synchrony and agility.",
        category: "Creative Sports"
      },
      {
        title: "The Cloud Appreciation Society",
        text: "With 50,000 members worldwide, this association successfully lobbied the World Meteorological Organization to officially include 'Asperitas' as a real cloud type in 2017.",
        category: "Science"
      },
      {
        title: "Singing Justin Bieber Toothbrush",
        text: "A 2011 battery-operated toothbrush that plays Justin Bieber hits for exactly 2 minutes (dentist timeline). Collectors keep them in mint packaging and trade custom batteries.",
        category: "Music Memorabilia"
      }
    ];
    const picked = facts[Math.floor(Math.random() * facts.length)];
    setCurrentFact(picked);
  };

  // Initiate dynamic generation for Infinite Mode
  const getNextInfiniteTopic = async () => {
    try {
      setInfiniteLoading(true);
      setInfiniteGuess(null);
      const res = await fetch('/api/fandoms/generate-random');
      if (res.ok) {
        const data = await res.json();
        setInfiniteTopic(data.topic);
        // Feed into fact section just in case they are curious
        if (data.topic && data.topic.didYouKnow) {
          setCurrentFact({
            title: data.topic.topicName,
            text: data.topic.didYouKnow,
            category: data.topic.category
          });
        }
      }
    } catch (e) {
      console.error("Unable to generate random AI topic:", e);
    } finally {
      setInfiniteLoading(false);
    }
  };

  // Launch Infinite Play automatically if active
  useEffect(() => {
    if (activeMode === 'infinite' && !infiniteTopic) {
      getNextInfiniteTopic();
    }
  }, [activeMode]);

  // Handle Username custom modification
  const handleSaveUsername = async () => {
    const cleaned = tempUsername.trim();
    if (cleaned) {
      setUsername(cleaned);
      localStorage.setItem('fandom-username', cleaned);
      setIsEditingUsername(false);

      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        try {
          await setDoc(userDocRef, { 
            username: cleaned, 
            updatedAt: new Date().toISOString() 
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
        }
      }
      fetchLeaderboard();
    }
  };

  // Core Guess Action handler
  const handleGuessAction = async (guess: boolean) => {
    // 1. Daily Mode Flow
    if (activeMode === 'daily') {
      const topic = dailyTopics[dailyIndex];
      if (!topic) return;

      const isCorrect = guess === topic.isReal;
      const newGuesses = { ...dailyGuesses, [topic.id]: { userGuess: guess, isCorrect } };
      setDailyGuesses(newGuesses);

      // Play correct / incorrect synthesized sound instantly
      playAudioFeedback(isCorrect);

      let stepScore = dailyScore;
      if (isCorrect) {
        stepScore += 1;
        setDailyScore(stepScore);
      }

      // Update the Did you know highlight fact immediately to the solved question
      setCurrentFact({
        title: topic.topicName,
        text: topic.didYouKnow,
        category: topic.category
      });

      // Daily complete check on last index trigger
      if (dailyIndex + 1 === dailyTopics.length) {
        // Compute daily streak increase based on UTC consecutive matches
        const lastPlayed = localStorage.getItem('fandom-last-played');
        const todayUtcDate = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const yesterdayUtcDate = yesterdayDate.toISOString().split('T')[0];

        let nextDailyStreak = dailyStreak;
        if (lastPlayed === yesterdayUtcDate) {
          nextDailyStreak = dailyStreak + 1;
        } else if (lastPlayed === todayUtcDate) {
          // Already earned today's streak increment
        } else {
          nextDailyStreak = 1;
        }

        const addedPoints = (isCorrect ? 100 : 0);
        const finalPoints = cumulativePoints + addedPoints;
        
        setDailyCompleted(true);
        postScoreToLeaderboard('daily', stepScore, Math.round((stepScore / dailyTopics.length) * 100));
        
        // Sync progress with cloud Firestore
        await updateCloudProgress(finalPoints, highestStreak, nextDailyStreak, todayUtcDate);
      } else {
        if (isCorrect) {
          const finalPoints = cumulativePoints + 100;
          await updateCloudProgress(finalPoints, highestStreak);
        }
      }
    } 
    // 2. Infinite Mode Flow
    else {
      if (!infiniteTopic) return;
      const isCorrect = guess === infiniteTopic.isReal;
      setInfiniteGuess({ userGuess: guess, isCorrect });

      // Play correct / incorrect sound instantly
      playAudioFeedback(isCorrect);

      if (isCorrect) {
        const nextStreak = infiniteStreak + 1;
        setInfiniteStreak(nextStreak);
        
        let nextHighest = highestStreak;
        if (nextStreak > highestStreak) {
          nextHighest = nextStreak;
        }
        
        const finalPoints = cumulativePoints + 150;
        postScoreToLeaderboard('infinite', nextStreak, 100);
        
        // Sync progress with cloud Firestore
        await updateCloudProgress(finalPoints, nextHighest);
      } else {
        // Streak broken
        setInfiniteStreak(0);
      }

      // Update fact card
      if (infiniteTopic.didYouKnow) {
        setCurrentFact({
          title: infiniteTopic.topicName,
          text: infiniteTopic.didYouKnow,
          category: infiniteTopic.category
        });
      }
    }
  };

  // Score posting API to local leaderboard storage
  const postScoreToLeaderboard = (mode: 'daily' | 'infinite', finalScore: number, finalAccuracy: number) => {
    const key = `fandom-leaderboard-${mode}`;
    const stored = localStorage.getItem(key);
    let entries: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];

    // Filter out our current nickname's old entry to avoid overflow
    entries = entries.filter(e => e.name !== username);

    const newEntry: LeaderboardEntry = {
      name: username,
      score: finalScore,
      accuracy: finalAccuracy,
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
      mode: mode
    };

    entries.push(newEntry);
    localStorage.setItem(key, JSON.stringify(entries));
    
    // Refresh currently displayed leaderboard lists in the background
    if (leaderboardMode === mode) {
      setLeaderboardEntries(entries);
    }
  };

  // Submit User Proposed Topic & call Gemini-3.5-flash evaluation auditor
  const handleUserSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTopicName.trim() || !submitDescription.trim()) return;

    try {
      setIsSubmitting(true);
      setEvaluatedSubmission(null);

      const res = await fetch('/api/fandoms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: submitTopicName.trim(),
          description: submitDescription.trim(),
          userName: username
        })
      });

      if (res.ok) {
        const data = await res.json();
        const auditedSub = data.submission;
        setEvaluatedSubmission(auditedSub);
        
        // Reset forms
        setSubmitTopicName('');
        setSubmitDescription('');
        
        // Save audited submission globally to Firebase for everyone!
        if (auditedSub && auditedSub.status === 'approved') {
          try {
            const subRef = doc(db, 'submissions', auditedSub.id);
            await setDoc(subRef, {
              id: auditedSub.id,
              topicName: auditedSub.topicName,
              description: auditedSub.description,
              status: auditedSub.status,
              isReal: auditedSub.isReal ?? false,
              didYouKnow: auditedSub.didYouKnow ?? "",
              aiExplanation: auditedSub.aiExplanation ?? "",
              submittedBy: auditedSub.submittedBy || 'Anonymous',
              createdAt: auditedSub.createdAt || new Date().toISOString()
            });
          } catch (dbErr) {
            console.error("Firestore submission write error:", dbErr);
          }
        }
        
        // Refresh approved list
        fetchSubmissions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear Leaderboards
  const handleClearHistory = () => {
    if (confirm(`Do you want to reset your scores, highest streaks, and local boards?`)) {
      localStorage.removeItem(`fandom-leaderboard-daily`);
      localStorage.removeItem(`fandom-leaderboard-infinite`);
      localStorage.removeItem('fandom-cumulative-points');
      localStorage.removeItem('fandom-highest-streak');
      localStorage.removeItem('fandom-last-played');
      
      setCumulativePoints(0);
      setHighestStreak(0);
      setInfiniteStreak(0);
      setDailyScore(0);
      setDailyIndex(0);
      setDailyGuesses({});
      setDailyCompleted(false);
      
      fetchLeaderboard();
      alert("System wiped. Leaderboards successfully restored to factory defaults.");
    }
  };

  // Safe navigation index helpers
  const handleDailyNext = () => {
    if (dailyIndex + 1 < dailyTopics.length) {
      setDailyIndex(prev => prev + 1);
    }
  };

  return (
    <div className="neo-body min-h-screen text-slate-900 font-sans p-4 sm:p-6 md:p-8 flex flex-col gap-6 selection:bg-indigo-300">
      
      {/* 1. Header Segment conforming to "Vibrant Palette" */}
      <header className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-2 px-3">
        {/* Brand logo in giant high-contrast style */}
        <div className="text-center md:text-left">
          <h1 className="font-display font-[900] text-3xl sm:text-4xl text-white tracking-tighter uppercase select-none drop-shadow-[2px_2px_0px_#000000]">
            FANDOM? or FICTION.
          </h1>
          <p className="font-mono text-xs text-indigo-200 mt-1 uppercase tracking-wider font-semibold">
            THE CHRONICLES OF HYPER-NICHE PASSION
          </p>
          <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
            <span className="font-mono text-[10px] bg-black text-emerald-400 px-2.5 py-1 rounded-lg border-2 border-black uppercase font-black tracking-widest shadow-[2px_2px_0px_#000] select-none">
              ⏱️ DAILY REFRESH IN: {timeLeft}
            </span>
          </div>
        </div>

        {/* User Statistics styled perfectly as high-contrast white pills with solid shadows */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="neo-stat-pill bg-amber-300" title="Cumulative points earned">
            <span>🏆</span>
            <span className="font-mono">{cumulativePoints.toLocaleString()} PTS</span>
          </div>

          <div className="neo-stat-pill bg-orange-300" title="Your consecutive days completing the Daily Challenge">
            <span>🔥 DAILY:</span>
            <span className="font-mono">{dailyStreak}D</span>
          </div>

          <div className="neo-stat-pill bg-rose-400" title="Your personal best streak in AI infinite mode">
            <span>🔥 INF:</span>
            <span className="font-mono">{highestStreak} RECORD</span>
          </div>

          <div className="neo-stat-pill bg-teal-300 relative group flex items-center gap-2">
            <span>👤</span>
            {isEditingUsername ? (
              <div className="flex items-center gap-1">
                <input
                  id="user-inline-editing-name"
                  type="text"
                  maxLength={15}
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  onBlur={handleSaveUsername}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
                  className="bg-white text-xs text-slate-900 px-1.5 py-0.5 rounded border border-black font-semibold outline-none w-24"
                  autoFocus
                />
                <button onClick={handleSaveUsername} className="text-emerald-950 hover:scale-110">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-slate-900">@{username}</span>
                <button 
                  onClick={() => {
                    setTempUsername(username);
                    setIsEditingUsername(true);
                  }} 
                  className="text-slate-700 hover:text-black hover:scale-110 ml-0.5 transition"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Real-time Google Authentication connector */}
          {currentUser ? (
            <div 
              className="neo-stat-pill bg-emerald-400 hover:bg-emerald-500 cursor-pointer flex items-center gap-1.5 transition text-slate-900 border-2 border-black" 
              title={`Logged in as ${currentUser.displayName || currentUser.email}. Click to Sign Out.`}
              onClick={async () => {
                if (confirm("Sign out of your Fandom or Fiction cloud account?")) {
                  await logoutUser();
                }
              }}
            >
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="" 
                  className="w-4.5 h-4.5 rounded-full border border-black inline-block"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>👤</span>
              )}
              <span className="font-mono text-[10px] uppercase font-black tracking-tight select-none">CONNECTED</span>
            </div>
          ) : (
            <button
              id="google-signin-btn"
              onClick={async () => {
                try {
                  await loginWithGoogle();
                } catch (err) {
                  alert("Google Sign-In popup blocked or could not be initialized.\n\n" +
                        "💡 If you are in the default AI Studio iframe preview, please click 'Open in new tab' at the top right corner of the screen so that the secure Google Auth popup can open directly in a new window.");
                }
              }}
              className="neo-stat-pill bg-indigo-500 hover:bg-indigo-600 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000] font-black cursor-pointer flex items-center gap-1.5 text-white shadow-[2px_2px_0px_#000] border-2 border-black transition"
              title="Sign in with your Google account to secure your high scores & sync them globally"
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-3 w-3 fill-current inline-block" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.74-.08-1.3-.177-1.859H12.24z"/>
                </svg>
                <span>SIGN IN WITH GOOGLE</span>
              </span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Game Module Card - High Contrast Solid Border Container */}
      <main className="neo-box w-full max-w-5xl mx-auto p-6 sm:p-10 flex flex-col justify-between relative min-h-[480px]">
        {/* Dynamic Theme Badge pinned to top right */}
        <div className="neo-badge absolute -top-5 right-8 sm:right-12 px-5 py-2.5 rotate-[3deg] select-none text-xs sm:text-sm tracking-widest uppercase font-black text-center z-10">
          {activeMode === 'daily' ? "📅 DAILY CHALLENGE" : "🌀 INFINITE AI PLAY"}
        </div>

        {/* Content Area */}
        <div className="w-full flex-1 flex flex-col justify-center items-center">
          
          {/* Mode Switcher Buttons */}
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] mb-8 z-10">
            <button
              id="switch-daily-mode"
              onClick={() => setActiveMode('daily')}
              className={`flex items-center gap-1.5 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-display font-black tracking-wide uppercase transition ${
                activeMode === 'daily'
                  ? 'bg-[#6366F1] text-white border-2 border-black shadow-[2px_2px_0px_#000]'
                  : 'text-slate-600 hover:text-black hover:bg-white/50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Daily challenge</span>
            </button>
            <button
              id="switch-infinite-mode"
              onClick={() => setActiveMode('infinite')}
              className={`flex items-center gap-1.5 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-display font-black tracking-wide uppercase transition ${
                activeMode === 'infinite'
                  ? 'bg-[#6366F1] text-white border-2 border-black shadow-[2px_2px_0px_#000]'
                  : 'text-slate-600 hover:text-black hover:bg-white/50'
              }`}
            >
              <InfinityIcon className="h-4 w-4" />
              <span>Infinite AI mode</span>
            </button>
          </div>

          {/* GAMEPLAY ELEMENT - DAILY CHALLENGE MODE */}
          {activeMode === 'daily' && (
            <div className="w-full text-center flex flex-col items-center justify-center animate-fade-in">
              {dailyLoading ? (
                <div id="daily-loader" className="py-16 flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4 stroke-[2.5]" />
                  <p className="font-mono text-sm uppercase font-semibold text-slate-500">Retrieving today's unique dataset...</p>
                </div>
              ) : dailyTopics.length === 0 ? (
                <div className="py-12">
                  <p className="text-slate-500 font-mono mb-4 text-sm">Failed to connect to subculture records.</p>
                  <button onClick={fetchDailyProgress} className="neo-btn-black py-2.5 px-5 rounded-xl text-sm">Retry Connection</button>
                </div>
              ) : dailyCompleted ? (
                /* Daily Finished Review */
                <div className="w-full max-w-2xl py-6 flex flex-col items-center">
                  <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0_0_#000] mb-5">
                    <Trophy className="h-8 w-8 text-black" />
                  </div>
                  <h3 className="font-display font-[900] text-3xl text-black uppercase tracking-tight mb-2">
                    Daily Challenge Completed!
                  </h3>
                  <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
                    You've locked in your score for today. Come back tomorrow for 10 new strange subculture puzzles! Play infinite mode to keep expanding your streak.
                  </p>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-6">
                    <div className="bg-emerald-100 border-3 border-black p-4 rounded-2xl shadow-[3px_3px_0px_#000] text-center">
                      <span className="block text-xs uppercase tracking-wider font-mono font-bold text-slate-500">Correct Guesses</span>
                      <span className="font-display font-[900] text-3xl text-emerald-800">{dailyScore} / {dailyTopics.length}</span>
                    </div>
                    <div className="bg-indigo-100 border-3 border-black p-4 rounded-2xl shadow-[3px_3px_0px_#000] text-center">
                      <span className="block text-xs uppercase tracking-wider font-mono font-bold text-slate-500">Accuracy</span>
                      <span className="font-display font-[900] text-3xl text-indigo-800">{Math.round((dailyScore / dailyTopics.length) * 100)}%</span>
                    </div>
                  </div>

                  <button 
                    id="play-infinite-shortcut"
                    onClick={() => setActiveMode('infinite')}
                    className="neo-btn-black text-sm py-3 px-6 rounded-2xl flex items-center gap-2"
                  >
                    <span>Hop Into infinite AI Play</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* Active Daily Guessing */
                <div className="w-full flex flex-col items-center max-w-3xl">
                  {/* Topic indicator badge */}
                  <p className="challenge-text text-[#6366F1] font-display font-black tracking-widest text-lg uppercase mb-3">
                    Topic #{dailyIndex + 1} of {dailyTopics.length}
                  </p>

                  {/* Category Stamp */}
                  <span className="font-mono text-xs font-bold bg-[#FACC15] text-black border-2 border-black rounded-lg px-2.5 py-1 mb-4 select-none">
                    🔖 {dailyTopics[dailyIndex]?.category || "HYPER-NICHE"}
                  </span>

                  {/* Giant Title */}
                  <h2 className="topic-title font-display font-[900] text-3xl sm:text-5xl leading-none text-black tracking-tighter text-center max-w-2xl mb-5">
                    {dailyTopics[dailyIndex]?.topicName}
                  </h2>

                  {/* Description Box */}
                  <div className="bg-[#F1F5F9]/50 border-3 border-black rounded-2xl p-5 mx-auto font-sans text-sm sm:text-base leading-relaxed text-slate-800 max-w-xl text-center mb-8 relative">
                    <span className="font-serif absolute -top-3.5 left-6 bg-white px-2 text-3xl font-bold opacity-30 select-none">“</span>
                    {dailyTopics[dailyIndex]?.description}
                    <span className="font-serif absolute -bottom-8 right-6 bg-white px-2 text-3xl font-bold opacity-30 select-none">”</span>
                  </div>

                  {/* Answers display / Reveal status */}
                  {dailyGuesses[dailyTopics[dailyIndex]?.id] ? (
                    <div className="w-full max-w-xl p-6 rounded-2xl border-4 border-black shadow-[4px_4px_0_0_#000] mb-4 text-left animate-fade-in bg-zinc-50 relative overflow-hidden">
                      {/* Ribbon banner on right */}
                      <div className={`absolute top-0 right-0 px-4 py-2 font-display font-black text-xs uppercase border-l-4 border-b-4 border-black ${
                        dailyGuesses[dailyTopics[dailyIndex].id].isCorrect ? 'bg-[#4ADE80]' : 'bg-[#F87171]'
                      }`}>
                        {dailyGuesses[dailyTopics[dailyIndex].id].isCorrect ? "🏆 Correct" : "❌ Wrong"}
                      </div>

                      <h4 className="font-display font-[900] text-lg text-black mb-2 uppercase">
                        The Verdict: {dailyTopics[dailyIndex].isReal ? "LEGIT RESIDENT FANDOM" : "FABRICATED PLOT"}
                      </h4>
                      <p className="text-slate-700 text-sm font-sans mb-3 font-semibold">
                        You guessed: <span className="underline">{dailyGuesses[dailyTopics[dailyIndex].id].userGuess ? "Real Fandom" : "Fiction"}</span>
                      </p>
                      
                      {/* Fact explainer section */}
                      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-xs leading-relaxed text-indigo-950 font-sans">
                        <span className="font-display font-black uppercase text-indigo-800 tracking-wider flex items-center gap-1 mb-1">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0" /> DID YOU KNOW?
                        </span>
                        {dailyTopics[dailyIndex].didYouKnow}
                      </div>

                      <button
                        id="btn-daily-advance-step"
                        onClick={dailyIndex + 1 === dailyTopics.length ? () => setDailyCompleted(true) : handleDailyNext}
                        className="mt-4 neo-btn-black w-full py-2.5 rounded-xl font-display text-sm uppercase flex items-center justify-center gap-1.5"
                      >
                        <span>{dailyIndex + 1 === dailyTopics.length ? "Finish and post results" : "Next subculture"}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    /* Guess Buttons conforming to button-group styles in instructions */
                    <div className="button-group w-full max-w-lg flex flex-col sm:flex-row gap-4 mb-4 select-none">
                      <button
                        id="btn-real-guess"
                        onClick={() => handleGuessAction(true)}
                        className="game-btn btn-real flex-1 neo-btn-real border-6 border-black rounded-3xl p-5 text-xl sm:text-2xl cursor-pointer"
                      >
                        LEGIT
                        <span className="btn-sub text-xs opacity-75 font-mono tracking-wider font-semibold">REAL FANDOM</span>
                      </button>
                      <button
                        id="btn-fake-guess"
                        onClick={() => handleGuessAction(false)}
                        className="game-btn btn-fake flex-1 neo-btn-fake border-6 border-black rounded-3xl p-5 text-xl sm:text-2xl cursor-pointer"
                      >
                        CAP
                        <span className="btn-sub text-xs opacity-75 font-mono tracking-wider font-semibold">FAKE TOPIC</span>
                      </button>
                    </div>
                  )}

                  {/* Progress Indicator Dots */}
                  <div className="flex gap-2.5 mt-8 items-center select-none">
                    {dailyTopics.map((topic, idx) => {
                      const guess = dailyGuesses[topic.id];
                      let dotColor = "bg-slate-200 border-2 border-black";
                      if (idx === dailyIndex) dotColor = "bg-indigo-500 scale-125 border-2 border-black ring-2 ring-indigo-200";
                      else if (guess && guess.isCorrect) dotColor = "bg-emerald-400 border-2 border-black";
                      else if (guess && !guess.isCorrect) dotColor = "bg-rose-400 border-2 border-black";

                      return (
                        <div
                          key={topic.id}
                          className={`w-4 h-4 rounded-full transition-all duration-350 ${dotColor}`}
                          title={`Topic ${idx + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAMEPLAY ELEMENT - INFINITE MODE */}
          {activeMode === 'infinite' && (
            <div className="w-full text-center flex flex-col items-center justify-center animate-fade-in">
              {infiniteLoading ? (
                <div id="infinite-ai-loader" className="py-16 flex flex-col items-center">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
                    <Sparkles className="h-5 w-5 text-yellow-400 absolute top-1 right-1 animate-ping" />
                  </div>
                  <p className="font-mono text-sm uppercase font-semibold text-slate-500">Generating hyper-specific concept with Gemini...</p>
                </div>
              ) : !infiniteTopic ? (
                <div className="py-12">
                  <p className="text-slate-500 font-mono mb-4 text-sm">Failed to generate with AI backend.</p>
                  <button onClick={getNextInfiniteTopic} className="neo-btn-black py-2.5 px-5 rounded-xl text-sm">Attempt Spontaneous Generation</button>
                </div>
              ) : (
                /* Live AI play screen */
                <div className="w-full flex flex-col items-center max-w-3xl">
                  
                  {/* Streak banner */}
                  <div className="flex items-center gap-1.5 text-rose-500 font-display font-black text-lg uppercase mb-3 px-3 py-1.5 bg-rose-50 border-3 border-black rounded-xl shadow-[2px_2px_0px_#000] select-none">
                    <Flame className="h-5 w-5 text-rose-500 fill-rose-500 animate-bounce" />
                    <span>Current Streak: {infiniteStreak}</span>
                  </div>

                  {/* Category tag */}
                  <span className="font-mono text-xs font-bold bg-[#FACC15] text-black border-2 border-black rounded-lg px-2.5 py-1 mb-4 select-none">
                    🔖 {infiniteTopic.category || "AI INCUBATED"}
                  </span>

                  {/* Giant Title */}
                  <h2 className="topic-title font-display font-[900] text-3xl sm:text-5xl leading-none text-black tracking-tighter text-center max-w-2xl mb-5">
                    {infiniteTopic.topicName}
                  </h2>

                  {/* Description */}
                  <div className="bg-[#F1F5F9]/50 border-3 border-black rounded-2xl p-5 mx-auto font-sans text-sm sm:text-base leading-relaxed text-slate-800 max-w-xl text-center mb-8 relative">
                    <span className="font-serif absolute -top-3.5 left-6 bg-white px-2 text-3xl font-bold opacity-30 select-none">“</span>
                    {infiniteTopic.description}
                    <span className="font-serif absolute -bottom-8 right-6 bg-white px-2 text-3xl font-bold opacity-30 select-none">”</span>
                  </div>

                  {/* Post-submit / reveal card */}
                  {infiniteGuess ? (
                    <div className="w-full max-w-xl p-6 rounded-2xl border-4 border-black shadow-[4px_4px_0_0_#000] mb-4 text-left animate-fade-in bg-zinc-50 relative overflow-hidden">
                      {/* Verdict header banner */}
                      <div className={`absolute top-0 right-0 px-4 py-2 font-display font-black text-xs uppercase border-l-4 border-b-4 border-black ${
                        infiniteGuess.isCorrect ? 'bg-[#4ADE80]' : 'bg-[#F87171]'
                      }`}>
                        {infiniteGuess.isCorrect ? "🔥 CORRECT!" : "💔 STREAK RESET"}
                      </div>

                      <h4 className="font-display font-[900] text-lg text-black mb-2 uppercase">
                        The Verdict: {infiniteTopic.isReal ? "REAL RECOGNIZED WORLD SUB-CULTURE" : "FABRICATED CO-CONSPIRATOR"}
                      </h4>
                      <p className="text-slate-700 text-sm font-sans mb-3 font-semibold">
                        You guessed: <span className="underline">{infiniteGuess.userGuess ? "Real Fandom" : "Fiction"}</span>
                      </p>

                      {/* Cool fact box */}
                      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-xs leading-relaxed text-indigo-950 font-sans">
                        <span className="font-display font-black uppercase text-indigo-800 tracking-wider flex items-center gap-1 mb-1">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0" /> WHY? HERE IS THE TRUTH:
                        </span>
                        {infiniteTopic.didYouKnow}
                      </div>

                      {/* Call to action */}
                      <button
                        id="btn-next-infinite-ai"
                        onClick={getNextInfiniteTopic}
                        className="mt-4 neo-btn-black w-full py-2.5 rounded-xl font-display text-sm uppercase flex items-center justify-center gap-1.5"
                      >
                        <span>Generate Next Weird Subculture</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    /* Guess buttons */
                    <div className="button-group w-full max-w-lg flex flex-col sm:flex-row gap-4 mb-4 select-none">
                      <button
                        id="btn-infinite-real"
                        onClick={() => handleGuessAction(true)}
                        className="game-btn btn-real flex-1 neo-btn-real border-6 border-black rounded-3xl p-5 text-xl sm:text-2xl cursor-pointer"
                      >
                        LEGIT
                        <span className="btn-sub text-xs opacity-75 font-mono tracking-wider font-semibold">REAL FANDOM</span>
                      </button>
                      <button
                        id="btn-infinite-fake"
                        onClick={() => handleGuessAction(false)}
                        className="game-btn btn-fake flex-1 neo-btn-fake border-6 border-black rounded-3xl p-5 text-xl sm:text-2xl cursor-pointer"
                      >
                        CAP
                        <span className="btn-sub text-xs opacity-75 font-mono tracking-wider font-semibold">FAKE TOPIC</span>
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 font-mono mt-4">
                    Generated spontaneously on-demand by Gemini-3.5-flash server routines.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer info within main box */}
        <div className="mt-8 pt-4 border-t-3 border-dashed border-gray-300 w-full flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5 font-mono uppercase font-semibold">
            <Clock className="h-4 w-4 text-indigo-500" />
            <span>UTC Clock: 2026-05-20</span>
          </div>
          <span className="font-sans text-slate-400 flex items-center gap-1 hover:text-slate-600 transition cursor-pointer" onClick={handleClearHistory}>
            ⚠️ Reset score memory cache
          </span>
        </div>
      </main>

      {/* 3. Bottom Grid - Perfect Neo-Brutalist Bento Alignment displaying all requested panels */}
      <div className="bottom-grid grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto mt-2">
        
        {/* PANEL A: 📊 Leaderboard */}
        <section className="card-small neo-card p-5 flex flex-col justify-between">
          <div>
            <div className="card-title text-base font-display font-black text-indigo-600 flex items-center justify-between mb-4">
              <span className="flex items-center gap-1.5">📊 HISTORIC STANDINGS</span>
              {/* Leaderboard toggle */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg border-2 border-black text-[9px] font-mono">
                <button 
                  onClick={() => setLeaderboardMode('daily')}
                  className={`px-2 py-0.5 rounded-md ${leaderboardMode === 'daily' ? 'bg-[#6366F1] text-white' : 'text-slate-500'}`}
                >
                  DAILY
                </button>
                <button 
                  onClick={() => setLeaderboardMode('infinite')}
                  className={`px-2 py-0.5 rounded-md ${leaderboardMode === 'infinite' ? 'bg-[#6366F1] text-white' : 'text-slate-500'}`}
                >
                  INF.
                </button>
              </div>
            </div>

            <ul className="leaderboard-list space-y-2 max-h-[175px] overflow-y-auto pr-1">
              {leaderboardEntries
                .sort((a,b) => b.score - a.score)
                .slice(0, 5)
                .map((entry, idx) => {
                  const isCur = entry.name === username;
                  return (
                    <li 
                      key={`${entry.name}-${idx}`} 
                      className={`leader-item flex items-center justify-between pb-1.5 border-b-2 border-slate-100 font-mono text-xs ${
                        isCur ? 'bg-indigo-50 px-2.5 py-1 rounded-lg border-b-0 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="rank font-bold font-sans text-indigo-500">{idx+1}</span>
                        <span className={`text-slate-800 ${isCur ? 'text-indigo-900 font-bold' : ''}`}>
                          {entry.name}
                        </span>
                      </div>
                      <span className="points font-black text-slate-900">
                        {entry.score} {entry.mode === 'daily' ? 'pts' : 'strk'}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-3 select-none">
            *Scores save locally into standard LocalStorage.
          </p>
        </section>

        {/* PANEL B: 💡 Did You Know? */}
        <section className="card-small neo-card p-5 flex flex-col justify-between">
          <div>
            <div className="card-title text-base font-display font-black text-indigo-600 flex items-center gap-1.5 mb-3 select-none uppercase">
              <span>💡 Did You Know?</span>
            </div>
            {currentFact.category && (
              <span className="text-[9px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-sm uppercase font-black tracking-wider">
                {currentFact.category}
              </span>
            )}
            <h4 className="font-display font-black text-sm text-slate-900 mt-2 mb-1 uppercase tracking-tight">
              {currentFact.title}
            </h4>
            <p className="fact-text text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
              {currentFact.text}
            </p>
          </div>

          <div className="pt-2 border-t-2 border-slate-100 flex items-center justify-between mt-3">
            <span className="text-[10px] text-indigo-400 font-mono italic">Source: Verified Ledger</span>
            <button 
              id="get-next-trivia"
              onClick={loadRandomFeaturedFact}
              className="text-[10px] font-sans font-bold bg-slate-50 border-2 border-black rounded-lg px-2.5 py-1 text-slate-900 hover:bg-slate-100 transition shadow-[2px_2px_0px_#000]"
            >
              Cycle Trivia ⚡
            </button>
          </div>
        </section>

        {/* PANEL C: ✍️ Submit Topic */}
        <section className="card-small neo-card p-5 flex flex-col justify-between">
          <form onSubmit={handleUserSubmission} className="submit-box flex flex-col gap-3">
            <div className="card-title text-base font-display font-black text-indigo-600 flex items-center justify-between select-none uppercase">
              <span>✍️ Submit Topic</span>
              <span className="text-[10px] text-slate-400 font-mono">Gemini Audit</span>
            </div>

            <div className="space-y-2">
              <input
                id="sumbit-topic-title"
                type="text"
                required
                placeholder="Fandom / Subculture Name..."
                value={submitTopicName}
                onChange={(e) => setSubmitTopicName(e.target.value)}
                className="input-styled neo-input text-xs"
              />
              <textarea
                id="submit-topic-desc"
                required
                maxLength={250}
                placeholder="Describe what these people actually do..."
                value={submitDescription}
                onChange={(e) => setSubmitDescription(e.target.value)}
                className="input-styled neo-input text-xs h-14 resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-1 select-none">
              <span className="text-[11px] text-slate-500 font-mono uppercase font-bold">Category Verdict:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubmitIsReal(true)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border-2 border-black ${
                    submitIsReal ? 'bg-[#4ADE80] text-black' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Legit
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitIsReal(false)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border-2 border-black ${
                    !submitIsReal ? 'bg-[#F87171] text-black' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Fake
                </button>
              </div>
            </div>

            <button
              id="btn-trigger-gemini-audit"
              type="submit"
              disabled={isSubmitting}
              className="submit-btn neo-btn-black py-2 text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Auditing with AI...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send to Review Ledger</span>
                </>
              )}
            </button>
          </form>
        </section>
      </div>

      {/* 4. Submission Feedback / Approved community submissions boards */}
      {(evaluatedSubmission || submissions.length > 0) && (
        <section className="w-full max-w-5xl mx-auto neo-card p-6 bg-yellow-50/70 border-4 border-black border-dashed mt-4">
          <h3 className="font-display font-[900] text-xl text-black uppercase tracking-tight mb-4 flex items-center gap-1.5 select-none">
            <span>🕵️‍♂️ THE AUDITOR'S LEDGER REVIEW BOARD</span>
            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-sm lowercase font-mono">live reviews</span>
          </h3>

          {/* Newest Audited response details */}
          {evaluatedSubmission && (
            <div id="evaluated-submission-feedback" className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0_0_#000] mb-5 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono bg-black text-yellow-300 font-extrabold px-2.5 py-0.5 rounded-sm">
                  NEW AUDIT REPORT
                </span>
                <span className="text-xs text-slate-400 font-mono">Evaluated by Gemini Live</span>
              </div>
              
              <h4 className="font-display font-extrabold text-[#6366F1] text-lg uppercase">
                {evaluatedSubmission.topicName}
              </h4>
              <p className="text-slate-600 text-xs my-2 leading-relaxed italic">
                "{evaluatedSubmission.description}"
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t-2 border-slate-100">
                <div className="bg-amber-50 border-2 border-amber-200 p-3 rounded-xl text-xs text-amber-950">
                  <span className="font-display font-extrabold block text-amber-900 mb-1">AUDITOR VERDICT:</span>
                  This fandom is verified <strong>{evaluatedSubmission.isReal ? "REAL" : "FAKE"}</strong>!
                  <span className="block mt-1 font-sans font-medium text-slate-700">{evaluatedSubmission.didYouKnow}</span>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-200 p-3 rounded-xl text-xs text-indigo-950">
                  <span className="font-display font-extrabold block text-indigo-900 mb-1">AUDITOR'S COMMENT:</span>
                  {evaluatedSubmission.aiExplanation}
                </div>
              </div>
            </div>
          )}

          {/* Submissions list */}
          {submissions.length > 0 && (
            <div>
              <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-3">
                RECENT AUDITED COMMUNITY ENTRIES
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                {submissions.slice(0, 6).map((sub) => (
                  <div key={sub.id} className="bg-white border-2 border-black p-3.5 rounded-xl shadow-[2px_2px_0px_#000] text-xs">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-display font-extrabold uppercase text-slate-900 truncate max-w-[170px]">
                        {sub.topicName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-black ${
                        sub.isReal ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {sub.isReal ? 'Legit' : 'Fake'}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-normal mb-2 max-h-[40px] overflow-hidden truncate whitespace-normal">
                      {sub.description}
                    </p>
                    <div className="bg-stone-50 p-2.5 rounded-lg text-[10px] text-slate-600 italic">
                      <strong>Auditor report:</strong> {sub.didYouKnow}
                    </div>
                    <div className="mt-2 text-[9px] font-mono text-slate-400 text-right">
                      Submitted by @{sub.submittedBy || 'Anonymous'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. Heartful brand footer & Lotus AI Experiment branding */}
      <footer className="w-full max-w-5xl mx-auto py-6 flex flex-col items-center justify-center text-center text-xs text-indigo-100 font-mono gap-5 select-none">
        
        {/* Elegant Neo-Brutalist Lotus Card */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border-4 border-black p-4 rounded-3xl shadow-[5px_5px_0px_#000] text-slate-900 max-w-sm sm:max-w-md">
          <img 
            src={lotusLogo} 
            alt="Lotus AI Experiments Logo" 
            className="w-16 h-16 object-contain rounded-xl border-2 border-black bg-stone-50"
            referrerPolicy="no-referrer"
          />
          <div className="text-center sm:text-left">
            <p className="font-display font-[900] text-sm uppercase tracking-tight text-slate-900">
              A Lotus AI Experiment
            </p>
            <p className="text-[10px] font-sans font-medium text-slate-500 mt-1 leading-relaxed">
              Exploring the eccentric bounds of digital ethnography and artificial subcultures.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-semibold">CRAFTED FOR TRIVIA ANTHROPOLOGISTS & STRANGE SUBCULTURE AFICIONADOS</p>
          <p className="opacity-75 flex items-center justify-center gap-1">
            Made with <span><Heart className="h-3 w-3 text-rose-300 fill-rose-300 inline" /></span> by Gemini-3.5-flash & AI Studio Build
          </p>
        </div>
      </footer>

    </div>
  );
}
