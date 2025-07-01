"use client";

import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWorksheets } from "../../hooks/useWorksheets";
import { useWorksheetSubmissions } from "../../hooks/useWorksheetSubmissions";
import { WorksheetStatus, Worksheet, WorksheetSubmission } from "../../types";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// WorksheetItem component for displaying individual worksheets
function WorksheetItem({ 
  worksheet, 
  status, 
  submission, 
  getStatusColor, 
  getStatusText 
}: {
  worksheet: Worksheet;
  status: WorksheetStatus;
  submission?: WorksheetSubmission;
  getStatusColor: (status: WorksheetStatus) => string;
  getStatusText: (status: WorksheetStatus) => string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{worksheet.title}</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
            {getStatusText(status)}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2">{worksheet.description}</p>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>📚 {worksheet.problems.length}問</span>
          <span>📊 {worksheet.difficulty === 'easy' ? '簡単' : worksheet.difficulty === 'medium' ? '普通' : '難しい'}</span>
          <span>📅 {new Date(worksheet.createdAt).toLocaleDateString('ja-JP')}</span>
          {submission && (
            <span>✅ スコア: {submission.score}/{submission.totalProblems}</span>
          )}
        </div>
      </div>
      <div className="text-gray-400">
        {status === 'ready' || status === 'submitted' ? '→' : ''}
      </div>
    </div>
  );
}


export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { worksheets, loading: worksheetsLoading } = useWorksheets();
  const { submissions } = useWorksheetSubmissions();
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
    if (!user) return;
    
    setIsGenerating(true);
    
    // Create temporary worksheet with 'creating' status
    const tempWorksheetId = `temp_${Date.now()}`;
    const tempWorksheet = {
      title: `${topic} - 問題作成中...`,
      description: `${topic}に関する${numQuestions}問の練習問題`,
      subject: "general",
      topic,
      difficulty,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      problems: [],
      status: 'creating' as WorksheetStatus,
    };
    
    try {
      // Save temporary worksheet
      await setDoc(doc(db, 'worksheets', tempWorksheetId), tempWorksheet);
      
      const requestBody = {
        subject: "general",
        difficulty,
        questionType: "mixed",
        topic,
        numQuestions,
        userId: user.uid,
        tempWorksheetId, // Pass temp worksheet ID to update it
      };
      
      const response = await fetch("https://generateproblems-ixkypuxz6a-uc.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Update worksheet status to error
        await setDoc(doc(db, 'worksheets', tempWorksheetId), {
          ...tempWorksheet,
          status: 'error' as WorksheetStatus,
          title: `${topic} - 作成エラー`,
        });
        
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Function response:", data);
      
      if (data.success && data.worksheet) {
        // Always delete temporary worksheet after successful generation
        // This handles both cases: updated temp worksheet and newly created worksheet
        try {
          await deleteDoc(doc(db, 'worksheets', tempWorksheetId));
          console.log("Deleted temporary worksheet:", tempWorksheetId);
        } catch (deleteError) {
          console.warn("Failed to delete temporary worksheet (may already be updated):", deleteError);
        }
        alert(`${data.count}問のワークシートが生成されました！`);
      } else {
        // Update worksheet status to error
        await setDoc(doc(db, 'worksheets', tempWorksheetId), {
          ...tempWorksheet,
          status: 'error' as WorksheetStatus,
          title: `${topic} - 作成エラー`,
        });
        
        console.error("Function error:", data);
        throw new Error(data.error || "ワークシート生成に失敗しました");
      }
    } catch (error) {
      console.error("Problem generation failed:", error);
      
      // Update worksheet status to error if it wasn't already updated
      try {
        await setDoc(doc(db, 'worksheets', tempWorksheetId), {
          ...tempWorksheet,
          status: 'error' as WorksheetStatus,
          title: `${topic} - 作成エラー`,
        });
      } catch (updateError) {
        console.error("Failed to update worksheet status:", updateError);
      }
      
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
                  <p><strong>総ワークシート数:</strong> {worksheets.length}個</p>
                  <p><strong>総問題数:</strong> {worksheets.reduce((total, ws) => total + ws.problems.length, 0)}問</p>
                  <p><strong>今月作成:</strong> {worksheets.filter(ws => {
                    const createdDate = new Date(ws.createdAt);
                    const now = new Date();
                    return createdDate.getMonth() === now.getMonth() && 
                           createdDate.getFullYear() === now.getFullYear();
                  }).length}個</p>
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

            {/* ワークシート一覧セクション */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">📚 作成したワークシート一覧</h2>
              </div>
              
              <div className="p-6">
                {worksheetsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">ワークシートを読み込み中...</p>
                  </div>
                ) : worksheets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg mb-2">まだワークシートが作成されていません</p>
                    <p className="text-sm">「問題を生成する」から最初のワークシートを作成してみましょう</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {worksheets.map((worksheet) => {
                      const submission = submissions[worksheet.id];
                      const status: WorksheetStatus = worksheet.status || (submission ? 'submitted' : 'ready');
                      
                      const getStatusColor = (status: WorksheetStatus) => {
                        switch (status) {
                          case 'creating': return 'bg-blue-100 text-blue-800';
                          case 'error': return 'bg-red-100 text-red-800';
                          case 'ready': return 'bg-green-100 text-green-800';
                          case 'submitted': return 'bg-purple-100 text-purple-800';
                          default: return 'bg-gray-100 text-gray-800';
                        }
                      };
                      
                      const getStatusText = (status: WorksheetStatus) => {
                        switch (status) {
                          case 'creating': return '作成中';
                          case 'error': return 'エラー';
                          case 'ready': return '未回答';
                          case 'submitted': return '提出済';
                          default: return '不明';
                        }
                      };
                      
                      const isClickable = status === 'ready' || status === 'submitted';
                      
                      return isClickable ? (
                        <Link
                          key={worksheet.id}
                          href={`/worksheet?id=${worksheet.id}`}
                          className="block p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          <WorksheetItem worksheet={worksheet} status={status} submission={submission} getStatusColor={getStatusColor} getStatusText={getStatusText} />
                        </Link>
                      ) : (
                        <div
                          key={worksheet.id}
                          className="block p-4 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed"
                        >
                          <WorksheetItem worksheet={worksheet} status={status} submission={submission} getStatusColor={getStatusColor} getStatusText={getStatusText} />
                        </div>
                      );
                    })}
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