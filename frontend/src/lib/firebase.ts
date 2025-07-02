import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Connect to Firebase Emulators if in development mode
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  // Connect to Firestore Emulator
  if (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST) {
    try {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      console.log('🔧 Connected to Firestore Emulator');
    } catch (error) {
      console.warn('Firestore Emulator already connected');
    }
  }
  
  // Connect to Auth Emulator
  if (process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      console.log('🔧 Connected to Auth Emulator');
    } catch (error) {
      console.warn('Auth Emulator already connected');
    }
  }
}

export default app;