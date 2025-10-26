import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const firebaseAdminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

export function getFirebaseAdminApp() {
  if (getApps().length === 0) {
    return initializeApp({
      credential: cert(firebaseAdminConfig),
    });
  }
  return getApps()[0];
}

export function getFirebaseAdminDB() {
  return getFirestore(getFirebaseAdminApp());
}
