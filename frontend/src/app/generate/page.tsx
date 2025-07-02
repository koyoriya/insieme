"use client";

import { useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MathRenderer } from "../../components/MathRenderer";
import { useWorksheetPDF } from "../../hooks/usePDF";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface Problem {
  id: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export default function GenerateProblems() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [difficulty, setDifficulty] = useState("medium");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProblems, setGeneratedProblems] = useState<Problem[]>([]);

  // PDF generation hook
  const { isGenerating: isPDFGenerating, error: pdfError, generateProblemsPDF, generateAnswersPDF, clearError } = useWorksheetPDF();

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
    return null;
  }

  // PDF export handler
  const handleExportPDF = async (includeAnswers: boolean = false) => {
    if (generatedProblems.length === 0) return;
    
    try {
      clearError();
      const worksheetData = {
        title: `${topic} - 生成された問題`,
        description: `${topic}に関する${numQuestions}問の練習問題`,
        problems: generatedProblems,
        createdAt: new Date().toISOString(),
        difficulty,
        topic
      };

      if (includeAnswers) {
        await generateAnswersPDF(worksheetData, `${topic}_解答付き.pdf`);
      } else {
        await generateProblemsPDF(worksheetData, `${topic}_問題のみ.pdf`);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF出力に失敗しました。もう一度お試しください。');
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const requestBody = {
        subject: "general", // 自動で適切な科目を判定
        difficulty,
        questionType: "mixed", // 混合問題形式
        topic,
        numQuestions,
        userId: user?.uid,
      };
      
      console.log("Sending request:", requestBody);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL}/generateProblems`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.problems) {
        setGeneratedProblems(data.problems);
        
        // Auto-save worksheet to Firestore
        const worksheet = {
          title: `${topic} - ${difficulty === "easy" ? "簡単" : difficulty === "medium" ? "普通" : "難しい"}`,
          description: `${topic}に関する${numQuestions}問の練習問題`,
          subject: "general",
          topic,
          difficulty,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid,
          problems: data.problems,
          status: "ready",
        };

        const worksheetRef = doc(db, 'worksheets', `worksheet_${Date.now()}`);
        await setDoc(worksheetRef, worksheet);
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
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">問題生成</h1>
            <p className="mt-1 text-sm text-gray-600">
              LLMを使用して学習問題を自動生成します
            </p>
          </div>

          <div className="p-6">
            {/* PDF Error Display */}
            {pdfError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-red-600">⚠️</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{pdfError}</p>
                    <button
                      onClick={clearError}
                      className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
                    >
                      エラーを閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}

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

        {generatedProblems.length > 0 && (
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">生成された問題</h2>
            </div>
            <div className="p-6 space-y-6">
              {generatedProblems.map((problem, index) => (
                <div key={problem.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">
                    問題 {index + 1}
                  </h3>
                  <div className="text-gray-800 mb-4">
                    <MathRenderer>{problem.question}</MathRenderer>
                  </div>
                  
                  {problem.options && (
                    <div className="mb-4">
                      <p className="font-medium mb-2">選択肢:</p>
                      <ul className="space-y-1">
                        {problem.options.map((option, optIndex) => (
                          <li key={optIndex} className="text-gray-700">
                            {String.fromCharCode(65 + optIndex)}. <MathRenderer>{option}</MathRenderer>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="bg-green-50 p-3 rounded">
                    <p className="font-medium text-green-800">
                      正答: <MathRenderer>{problem.correctAnswer}</MathRenderer>
                    </p>
                    <div className="text-green-700 mt-1">
                      <MathRenderer>{problem.explanation}</MathRenderer>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => handleExportPDF(false)}
                  disabled={isPDFGenerating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
                >
                  {isPDFGenerating ? '生成中...' : 'PDF出力（問題のみ）'}
                </button>
                <button 
                  onClick={() => handleExportPDF(true)}
                  disabled={isPDFGenerating}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
                >
                  {isPDFGenerating ? '生成中...' : 'PDF出力（解答付き）'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}