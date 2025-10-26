import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const USER_ID = "2UfFA6pt4YVwk7smBg1pKpkjezJ2";

async function backupFirebaseData() {
  const backup = {
    cycles: [],
    workouts: [],
    timestamp: new Date().toISOString(),
    userId: USER_ID
  };

  try {
    // Backup cycles
    const cyclesRef = collection(db, "workouts", USER_ID, "cycles");
    const cyclesSnapshot = await getDocs(cyclesRef);
    backup.cycles = cyclesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Backup completed workouts
    const workoutsRef = collection(db, "workouts", USER_ID, "completed");
    const workoutsSnapshot = await getDocs(workoutsRef);
    backup.workouts = workoutsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Write to file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Create backups directory if it doesn't exist
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Save backup file with timestamp
    const filename = `firebase-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupPath = path.join(backupDir, filename);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`Backup saved to: ${backupPath}`);

  } catch (error) {
    console.error("Error creating backup:", error);
    throw error;
  }
}

// Run the backup
backupFirebaseData().catch(console.error);
