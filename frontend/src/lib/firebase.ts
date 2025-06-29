import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCK4Q0I1in15yFALZDmLqsU0KeaIg6QYWY",
  authDomain: "insieme-463312.firebaseapp.com",
  projectId: "insieme-463312",
  storageBucket: "insieme-463312.firebasestorage.app",
  messagingSenderId: "458047990900",
  appId: "1:458047990900:web:b5ca8f9395a77446983521",
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

export default app;