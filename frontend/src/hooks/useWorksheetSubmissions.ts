import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { WorksheetSubmission } from '../types';

export function useWorksheetSubmissions() {
  const [submissions, setSubmissions] = useState<{[worksheetId: string]: WorksheetSubmission}>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSubmissions({});
      setLoading(false);
      return;
    }

    const submissionsRef = collection(db, 'worksheet_submissions');
    const q = query(
      submissionsRef,
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const submissionMap: {[worksheetId: string]: WorksheetSubmission} = {};
        snapshot.forEach((doc) => {
          const submission = { id: doc.id, ...doc.data() } as WorksheetSubmission;
          submissionMap[submission.worksheetId] = submission;
        });
        setSubmissions(submissionMap);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching submissions:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { submissions, loading };
}