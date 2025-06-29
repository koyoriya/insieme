"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      // Use popup for desktop, redirect for mobile
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Handle redirect result (for mobile)
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // User signed in via redirect
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error('Error getting redirect result:', error);
      })
      .finally(() => {
        setLoading(false);
      });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}