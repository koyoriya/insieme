import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Check if we're in build time (server-side) or runtime (client-side)
const isBuildTime = typeof window === 'undefined';

// For build time, use placeholder values to prevent build errors
// For runtime, use environment variables and validate them
const firebaseConfig = isBuildTime ? {
  // Build-time placeholders - these won't be used in actual Firebase calls
  apiKey: "build-placeholder",
  authDomain: "build-placeholder.firebaseapp.com", 
  projectId: "build-placeholder",
  storageBucket: "build-placeholder.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:build-placeholder",
} : {
  // Runtime configuration - validate required environment variables
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Validate environment variables at runtime
if (!isBuildTime) {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('Missing required Firebase environment variables:', missingVars);
    throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
  }
}

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
    } catch {
      console.warn('Firestore Emulator already connected');
    }
  }
  
  // Connect to Auth Emulator
  if (process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      console.log('🔧 Connected to Auth Emulator');
    } catch {
      console.warn('Auth Emulator already connected');
    }
  }
}

export default app;