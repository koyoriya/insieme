"use client";

import Link from "next/link";
import { useAuth } from "../components/AuthProvider";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Welcome to Insieme
        </h1>
        
        {user ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Hello, {user.displayName || user.email}!
            </p>
            <div className="space-y-2">
              <Link
                href="/dashboard"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              LLMによる問題作成&添削アプリ
            </p>
            <Link
              href="/auth/signin"
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}