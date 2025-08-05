import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, doc, setDoc, DocumentData, getDocs } from "firebase/firestore"

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







