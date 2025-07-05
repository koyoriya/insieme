import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Check if we're in build time (server-side) or runtime (client-side)
const isBuildTime = typeof window === 'undefined';

// Get environment type
const env = process.env.NEXT_PUBLIC_ENV || 'LOCAL';

// Environment-based Firebase configuration
const getFirebaseConfig = () => {
  if (isBuildTime) {
    // Build-time placeholders - these won't be used in actual Firebase calls
    return {
      apiKey: "build-placeholder",
      authDomain: "build-placeholder.firebaseapp.com", 
      projectId: "build-placeholder",
      storageBucket: "build-placeholder.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:build-placeholder",
    };
  }

  switch (env) {
    case 'LOCAL':
      // Local emulator environment - placeholder values are acceptable
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:demo-app-id",
      };

    case 'DEV':
    case 'PROD':
      // Development and Production environments - require actual environment variables
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
        console.error(`Missing required Firebase environment variables for ${env}:`, missingVars);
        console.error('Available environment variables:', Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_')));
        throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}. Please ensure these are set in your environment or GitHub Actions secrets.`);
      }

      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      };

    default:
      throw new Error(`Unknown environment: ${env}. Expected LOCAL, DEV, or PROD.`);
  }
};

const firebaseConfig = getFirebaseConfig();

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

// Connect to Firebase Emulators in LOCAL environment
if (env === 'LOCAL' && !isBuildTime) {
  // Connect to Firestore Emulator
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('🔧 Connected to Firestore Emulator');
  } catch {
    console.warn('Firestore Emulator already connected');
  }
  
  // Connect to Auth Emulator
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    console.log('🔧 Connected to Auth Emulator');
  } catch {
    console.warn('Auth Emulator already connected');
  }
}

// Log current environment
if (!isBuildTime) {
  console.log(`🌍 Firebase initialized for environment: ${env}`);
}

export default app;