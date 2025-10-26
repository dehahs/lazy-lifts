import { NextResponse } from 'next/server';
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';

const USER_ID = "2UfFA6pt4YVwk7smBg1pKpkjezJ2";

export async function GET() {
  try {
    const backup = {
      cycles: [],
      workouts: [],
      timestamp: new Date().toISOString(),
      userId: USER_ID
    };

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

    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Save backup file with timestamp
    const filename = `firebase-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupPath = path.join(backupDir, filename);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: `Backup saved to: ${backupPath}`,
      data: backup 
    });

  } catch (error) {
    console.error("Error creating backup:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}