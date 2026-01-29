
import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { SystemUsageStats } from '../types';

const getTodayKey = () => new Date().toISOString().split('T')[0];

export const trackAiRequest = async () => {
    const dateKey = getTodayKey();
    const ref = doc(db, 'system_usage', dateKey);
    
    try {
        await updateDoc(ref, {
            aiRequests: increment(1),
            estimatedCost: increment(0.005) // Approximate cost per query in USD (example)
        });
    } catch (e) {
        // If doc doesn't exist, create it
        await setDoc(ref, {
            date: dateKey,
            aiRequests: 1,
            dbReads: 0,
            dbWrites: 0,
            estimatedCost: 0.005
        }, { merge: true });
    }
};

export const trackDbOperation = async (type: 'read' | 'write', count: number = 1) => {
    const dateKey = getTodayKey();
    const ref = doc(db, 'system_usage', dateKey);
    
    try {
        await updateDoc(ref, {
            [type === 'read' ? 'dbReads' : 'dbWrites']: increment(count)
        });
    } catch (e) {
        await setDoc(ref, {
            date: dateKey,
            aiRequests: 0,
            dbReads: type === 'read' ? count : 0,
            dbWrites: type === 'write' ? count : 0,
            estimatedCost: 0
        }, { merge: true });
    }
};

export const getUsageStats = async (): Promise<SystemUsageStats> => {
    const dateKey = getTodayKey();
    const ref = doc(db, 'system_usage', dateKey);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return snap.data() as SystemUsageStats;
    }

    return {
        date: dateKey,
        aiRequests: 0,
        dbReads: 0,
        dbWrites: 0,
        estimatedCost: 0
    };
};

export const getHistoricalUsageStats = async (days: number = 7): Promise<SystemUsageStats[]> => {
    const results: SystemUsageStats[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const ref = doc(db, 'system_usage', dateKey);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            results.push(snap.data() as SystemUsageStats);
        } else {
            results.push({
                date: dateKey,
                aiRequests: 0,
                dbReads: 0,
                dbWrites: 0,
                estimatedCost: 0
            });
        }
    }

    return results;
};
