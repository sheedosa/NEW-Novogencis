import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const logClinicalAction = async (adminId: string, actionType: string, targetId: string, details: string) => {
  try {
    const logsRef = collection(db, 'system_logs');
    await addDoc(logsRef, {
      adminId,
      actionType,
      targetId,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log clinical action:', error);
  }
};
