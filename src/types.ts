export interface FandomTopic {
  id: string;
  topicName: string;
  description: string;
  isReal: boolean;
  didYouKnow: string;
  category: string;
  source: 'precurated' | 'gemini' | 'user';
  submittedBy?: string;
}

export interface GameSession {
  mode: 'daily' | 'infinite';
  currentIndex: number;
  score: number;
  questions: FandomTopic[];
  answers: {
    [topicId: string]: {
      userGuess: boolean;
      isCorrect: boolean;
    };
  };
  completed: boolean;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  accuracy: number; // 0-100
  timestamp: string;
  isCurrentUser?: boolean;
  mode: 'daily' | 'infinite';
}

export interface UserSubmission {
  id: string;
  topicName: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  isReal?: boolean;
  didYouKnow?: string;
  aiExplanation?: string;
  submittedBy?: string;
  createdAt: string;
}
