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
}

export interface WorksheetSubmission {
  id: string;
  worksheetId: string;
  userId: string;
  answers: ProblemAnswer[];
  submittedAt: string;
  score?: number;
  totalProblems: number;
}