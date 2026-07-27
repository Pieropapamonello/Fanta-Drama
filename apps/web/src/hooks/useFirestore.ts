import { useEffect, useState } from 'react';
import { type DocumentData, type DocumentReference, onSnapshot } from 'firebase/firestore';

export function useRealtimeDocument<T = DocumentData>(ref: DocumentReference<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setData(snapshot.data() as T);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
}
