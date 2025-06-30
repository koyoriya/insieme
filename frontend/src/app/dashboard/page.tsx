"use client";

import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useProblems } from "../../hooks/useProblems";


export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { problems, loading: problemsLoading } = useProblems();
  const router = useRouter();
  
  // Problem generation state
  const [difficulty, setDifficulty] = useState("medium");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

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

  if (!user) {
    return null; // Will redirect
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const requestBody = {
        subject: "general",
        difficulty,
        questionType: "mixed",
        topic,
        numQuestions,
        userId: user?.uid,
      };
      
      const response = await fetch("https://generateproblems-ixkypuxz6a-uc.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.problems) {
        alert(`${data.problems.length}問の問題が生成されました！`);
      } else {
        throw new Error(data.error || "問題生成に失敗しました");
      }
    } catch (error) {
      console.error("Problem generation failed:", error);
      alert("問題生成に失敗しました。もう一度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome, {user.displayName || 'User'}!
                </h1>
                <p className="text-gray-600">
                  問題作成&添削システム
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Sign Out
              </button>
            </div>

            {/* 問題作成フォーム - メイン機能 */}
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">📝 問題を生成する</h2>
                <p className="mt-1 text-sm text-gray-600">
                  LLMを使用して学習問題を自動生成します
                </p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      難易度
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="easy">簡単</option>
                      <option value="medium">普通</option>
                      <option value="hard">難しい</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      問題数
                    </label>
                    <select
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={1}>1問</option>
                      <option value={3}>3問</option>
                      <option value={5}>5問</option>
                      <option value={10}>10問</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    トピック・テーマ
                  </label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="例：二次関数、世界史、英文法、プログラミング、物理、化学など学習したいトピックを入力してください"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !topic}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md flex items-center justify-center"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        問題を生成中...
                      </>
                    ) : (
                      "問題を生成する"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 統計情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">📊 統計情報</h3>
                <div className="space-y-2">
                  <p><strong>総問題数:</strong> {problems.length}問</p>
                  <p><strong>今月作成:</strong> {problems.filter(p => {
                    const createdDate = new Date(p.createdAt);
                    const now = new Date();
                    return createdDate.getMonth() === now.getMonth() && 
                           createdDate.getFullYear() === now.getFullYear();
                  }).length}問</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">👤 ユーザー情報</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>名前:</strong> {user.displayName || 'Not provided'}</p>
                  <p><strong>メール:</strong> {user.email}</p>
                  {user.photoURL && (
                    <div className="mt-4">
                      <Image 
                        src={user.photoURL} 
                        alt="Profile" 
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 問題一覧セクション */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">📚 作成した問題一覧</h2>
              </div>
              
              <div className="p-6">
                {problemsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">問題を読み込み中...</p>
                  </div>
                ) : problems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg mb-2">まだ問題が作成されていません</p>
                    <p className="text-sm">「問題を生成する」から最初の問題を作成してみましょう</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {problems.map((problem) => (
                      <Link
                        key={problem.id}
                        href={`/problem?id=${problem.id}`}
                        className="block p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-md transition-all"
                      >
                        <div className="mb-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            problem.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                            problem.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {problem.difficulty === 'easy' ? '簡単' : 
                             problem.difficulty === 'medium' ? '普通' : '難しい'}
                          </span>
                          <span className={`inline-block ml-2 px-2 py-1 text-xs rounded ${
                            problem.options ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {problem.options ? '選択' : '記述'}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                          {problem.question.substring(0, 80)}...
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          トピック: {problem.topic}
                        </p>
                        <p className="text-xs text-gray-500">
                          作成日: {new Date(problem.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}