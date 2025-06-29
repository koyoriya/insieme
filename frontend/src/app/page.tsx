import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Welcome to Insieme
        </h1>
        
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
      </div>
    </div>
  );
}