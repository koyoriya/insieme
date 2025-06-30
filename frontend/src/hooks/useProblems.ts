import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';

export interface Problem {
  id: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
  type: 'multiple-choice' | 'short-answer' | 'essay';
  subject: string;
  difficulty: string;
  topic: string;
  createdAt: string;
  createdBy: string;
}

export function useProblems() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setProblems([]);
      setLoading(false);
      return;
    }

    const problemsRef = collection(db, 'problems');
    const q = query(
      problemsRef,
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const problemList: Problem[] = [];
        snapshot.forEach((doc) => {
          problemList.push({ id: doc.id, ...doc.data() } as Problem);
        });
        setProblems(problemList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching problems:', err);
        setError('問題の取得に失敗しました');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { problems, loading, error };
}