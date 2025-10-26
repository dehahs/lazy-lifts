const { collection, getDocs, doc, setDoc } = require("firebase/firestore");
const { db } = require("../lib/firebase");
const fs = require('fs');
const path = require('path');

const USER_ID = "2UfFA6pt4YVwk7smBg1pKpkjezJ2";

interface WorkoutData {
  id: string;
  [key: string]: any;
}

async function backupFirebaseData() {
  const backup: {
    cycles: WorkoutData[];
    workouts: WorkoutData[];
    timestamp: string;
    userId: string;
  } = {
    cycles: [],
    workouts: [],
    timestamp: new Date().toISOString(),
    userId: USER_ID
  };

  try {
    // Backup cycles
    const cyclesRef = collection(db, "workouts", USER_ID, "cycles");
    const cyclesSnapshot = await getDocs(cyclesRef);
    backup.cycles = cyclesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Backup completed workouts
    const workoutsRef = collection(db, "workouts", USER_ID, "completed");
    const workoutsSnapshot = await getDocs(workoutsRef);
    backup.workouts = workoutsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
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

// Restore function for when we need to restore from backup
async function restoreFromBackup(backupFilePath: string) {
  try {
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    // First, verify this is the correct user's backup
    if (backupData.userId !== USER_ID) {
      throw new Error("Backup file is for a different user!");
    }

    // Restore cycles
    for (const cycle of backupData.cycles) {
      const { id, ...data } = cycle;
      await setDoc(doc(db, "workouts", USER_ID, "cycles", id), data);
    }

    // Restore workouts
    for (const workout of backupData.workouts) {
      const { id, ...data } = workout;
      await setDoc(doc(db, "workouts", USER_ID, "completed", id), data);
    }

    console.log("Restore completed successfully!");
  } catch (error) {
    console.error("Error restoring from backup:", error);
    throw error;
  }
}

// Run the backup
backupFirebaseData().catch(console.error);