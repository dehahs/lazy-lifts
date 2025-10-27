import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { 
  getFirestore, 
  doc, 
  setDoc, 
  DocumentData, 
  getDocs,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  deleteDoc
} from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Helper function to ensure all documents include ownerUid
export const createDocumentWithOwner = async (
  path: string,
  data: DocumentData,
  ownerUid: string
) => {
  const docRef = doc(db, path)
  await setDoc(docRef, {
    ...data,
    ownerUid
  })
  return docRef
}

// Helper function to create documents in user-specific collections
export const createUserDocument = async (
  userId: string,
  collectionPath: string,
  subCollection: string,
  documentId: string,
  data: DocumentData
) => {
  const docRef = doc(db, collectionPath, userId, subCollection, documentId)
  await setDoc(docRef, {
    ...data,
    ownerUid: userId
  })
  return docRef
}

// Fallback function for document creation if helper fails
export const createDocumentFallback = async (
  userId: string,
  collectionPath: string,
  subCollection: string,
  documentId: string,
  data: DocumentData
) => {
  try {
    // Try the helper function first
    return await createUserDocument(userId, collectionPath, subCollection, documentId, data)
  } catch (error) {
    console.log("Helper function failed, trying fallback...")
    
    // Fallback to direct document creation
    const docRef = doc(db, collectionPath, userId, subCollection, documentId)
    await setDoc(docRef, {
      ...data,
      ownerUid: userId
    })
    return docRef
  }
}

// Temporary function to handle reading documents that might not have ownerUid yet
export const safeGetDocs = async (collectionRef: any) => {
  try {
    return await getDocs(collectionRef)
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("Permission denied - documents may not have ownerUid field yet")
      console.warn("Please run the migration or temporarily relax security rules")
      return { docs: [], empty: true }
    }
    throw error
  }
}

// Meal-specific functions
export interface MealEntry {
  id: string
  timestamp: Date
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  ownerUid: string
}

export const saveMeal = async (userId: string, meal: Omit<MealEntry, 'ownerUid'>) => {
  return await createUserDocument(
    userId,
    'users',
    'meals',
    meal.id,
    {
      ...meal,
      timestamp: Timestamp.fromDate(meal.timestamp)
    }
  )
}

export const getMeals = async (userId: string) => {
  const mealsRef = collection(db, 'users', userId, 'meals')
  const q = query(mealsRef, orderBy('timestamp', 'desc'))
  const snapshot = await getDocs(q)
  
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
    timestamp: doc.data().timestamp.toDate()
  })) as MealEntry[]
}

export const subscribeToMeals = (userId: string, callback: (meals: MealEntry[]) => void) => {
  const mealsRef = collection(db, 'users', userId, 'meals')
  const q = query(mealsRef, orderBy('timestamp', 'desc'))
  
  return onSnapshot(q, (snapshot) => {
    const meals = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      timestamp: doc.data().timestamp.toDate()
    })) as MealEntry[]
    callback(meals)
  })
}

export const deleteMeal = async (userId: string, mealId: string) => {
  const mealRef = doc(db, 'users', userId, 'meals', mealId)
  await deleteDoc(mealRef)
}


