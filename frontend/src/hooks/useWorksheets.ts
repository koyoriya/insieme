import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { Worksheet } from '../types';

export function useWorksheets() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setWorksheets([]);
      setLoading(false);
      return;
    }

    const worksheetsRef = collection(db, 'worksheets');
    const q = query(
      worksheetsRef,
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const worksheetList: Worksheet[] = [];
        const now = Date.now();
        const CREATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

        snapshot.forEach((doc) => {
          const worksheet = { id: doc.id, ...doc.data() } as Worksheet;
          
          // Filter out old "creating" worksheets that are likely stuck
          if (worksheet.status === 'creating') {
            const createdAt = new Date(worksheet.createdAt).getTime();
            const isStuck = now - createdAt > CREATION_TIMEOUT;
            
            if (isStuck) {
              console.warn(`Filtering out stuck creating worksheet: ${worksheet.id}`);
              return; // Skip this worksheet
            }
          }
          
          worksheetList.push(worksheet);
        });
        
        setWorksheets(worksheetList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching worksheets:', err);
        setError('ワークシートの取得に失敗しました');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { worksheets, loading, error };
}