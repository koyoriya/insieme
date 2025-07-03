export interface Problem {
  id: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export type WorksheetStatus = 'creating' | 'error' | 'ready' | 'submitted';

export interface Worksheet {
  id: string;
  title: string;
  description?: string;
  subject: string;
  topic: string;
  difficulty: string;
  createdAt: string;
  createdBy: string;
  problems: Problem[];
  status?: WorksheetStatus;
}

export interface ProblemAnswer {
  problemId: string;
  answer: string;
  isCorrect?: boolean;
  // LLM grading support
  partialScore?: number;
  maxScore?: number;
  feedback?: string;
  reasoning?: string;
  confidence?: number;
}

export interface WorksheetSubmission {
  id: string;
  worksheetId: string;
  userId: string;
  answers: ProblemAnswer[];
  submittedAt: string;
  score?: number;
  totalProblems: number;
  // Enhanced grading support
  partialScore?: number;
  percentageScore?: number;
  gradingMethod?: 'basic' | 'llm-assisted';
  gradingVersion?: string;
}

export interface GradingResult {
  success: boolean;
  submissionId?: string;
  gradedAnswers: ProblemAnswer[];
  totalScore: number;
  maxTotalScore: number;
  partialScore: number;
  percentageScore: number;
  gradingSummary: {
    correct: number;
    total: number;
    averageConfidence: number;
  };
}