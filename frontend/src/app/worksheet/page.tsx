"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "../../components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";
import { Worksheet, WorksheetSubmission, ProblemAnswer } from "../../types";
import { MathRenderer } from "../../components/MathRenderer";
import { useWorksheetPDF } from "../../hooks/usePDF";

function WorksheetPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const worksheetId = searchParams.get('id');
  
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [submission, setSubmission] = useState<WorksheetSubmission | null>(null);
  const [answers, setAnswers] = useState<{[problemId: string]: string}>({});
  const [selectedOptions, setSelectedOptions] = useState<{[problemId: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [worksheetLoading, setWorksheetLoading] = useState(true);

  // PDF generation hook
  const { isGenerating, error: pdfError, generateProblemsPDF, generateAnswersPDF, clearError } = useWorksheetPDF();

  const loadWorksheet = useCallback(async () => {
    if (!worksheetId) return;
    
    try {
      const worksheetDoc = await getDoc(doc(db, 'worksheets', worksheetId));
      if (worksheetDoc.exists()) {
        setWorksheet({ id: worksheetDoc.id, ...worksheetDoc.data() } as Worksheet);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error loading worksheet:', error);
    } finally {
      setWorksheetLoading(false);
    }
  }, [worksheetId, router]);

  const loadSubmission = useCallback(async () => {
    if (!worksheetId || !user) return;
    
    try {
      const submissionDoc = await getDoc(doc(db, 'worksheet_submissions', `${worksheetId}_${user.uid}`));
      if (submissionDoc.exists()) {
        const submissionData = { id: submissionDoc.id, ...submissionDoc.data() } as WorksheetSubmission;
        setSubmission(submissionData);
        
        // Load existing answers
        const answerMap: {[problemId: string]: string} = {};
        const optionMap: {[problemId: string]: string} = {};
        submissionData.answers.forEach(answer => {
          answerMap[answer.problemId] = answer.answer;
          optionMap[answer.problemId] = answer.answer;
        });
        setAnswers(answerMap);
        setSelectedOptions(optionMap);
      }
    } catch (error) {
      console.error('Error loading submission:', error);
    }
  }, [worksheetId, user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && worksheetId) {
      loadWorksheet();
      loadSubmission();
    }
  }, [user, worksheetId, loadWorksheet, loadSubmission]);

  const handleAnswerChange = (problemId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [problemId]: answer }));
  };

  const handleOptionChange = (problemId: string, option: string) => {
    setSelectedOptions(prev => ({ ...prev, [problemId]: option }));
    setAnswers(prev => ({ ...prev, [problemId]: option }));
  };

  const handleSubmit = async () => {
    if (!user || !worksheet || !worksheetId) return;

    // Validate all questions are answered
    const unansweredProblems = worksheet.problems.filter(problem => 
      !answers[problem.id] || answers[problem.id].trim() === ''
    );
    
    if (unansweredProblems.length > 0) {
      alert(`まだ回答されていない問題があります: 問題 ${unansweredProblems.map((_, i) => i + 1).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const problemAnswers: ProblemAnswer[] = worksheet.problems.map(problem => {
        const answer = answers[problem.id];
        return {
          problemId: problem.id,
          answer: answer.trim(),
          isCorrect: problem.options ? 
            answer.trim() === problem.correctAnswer.trim() : undefined
        };
      });

      const score = problemAnswers.filter(answer => answer.isCorrect === true).length;

      const submissionData: Omit<WorksheetSubmission, 'id'> = {
        worksheetId,
        userId: user.uid,
        answers: problemAnswers,
        submittedAt: new Date().toISOString(),
        score,
        totalProblems: worksheet.problems.length
      };

      const submissionId = `${worksheetId}_${user.uid}`;
      await setDoc(doc(db, 'worksheet_submissions', submissionId), submissionData);
      
      setSubmission({ id: submissionId, ...submissionData });
      alert(`ワークシートを提出しました！ 得点: ${score}/${worksheet.problems.length}`);
    } catch (error) {
      console.error('Error submitting worksheet:', error);
      alert('提出に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PDF export handlers
  const handleExportPDF = async (includeAnswers: boolean = false) => {
    if (!worksheet) return;
    
    try {
      clearError();
      const worksheetData = {
        title: worksheet.title,
        description: worksheet.description,
        problems: worksheet.problems,
        createdAt: worksheet.createdAt,
        difficulty: worksheet.difficulty,
        topic: worksheet.topic
      };

      if (includeAnswers) {
        await generateAnswersPDF(worksheetData, `${worksheet.title}_解答付き.pdf`);
      } else {
        await generateProblemsPDF(worksheetData, `${worksheet.title}_問題のみ.pdf`);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF出力に失敗しました。もう一度お試しください。');
    }
  };

  if (loading || worksheetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !worksheet) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">{worksheet.title}</h1>
              <div className="flex items-center space-x-2">
                {/* PDF Export Buttons */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleExportPDF(false)}
                    disabled={isGenerating}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md transition-colors"
                  >
                    {isGenerating ? '生成中...' : 'PDF出力'}
                  </button>
                  {submission && (
                    <button
                      onClick={() => handleExportPDF(true)}
                      disabled={isGenerating}
                      className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md transition-colors"
                    >
                      {isGenerating ? '生成中...' : '解答付きPDF'}
                    </button>
                  )}
                </div>
                
                <span className={`px-2 py-1 text-xs rounded ${
                  worksheet.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  worksheet.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {worksheet.difficulty === 'easy' ? '簡単' : 
                   worksheet.difficulty === 'medium' ? '普通' : '難しい'}
                </span>
                <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                  {worksheet.problems.length}問
                </span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                トピック: {worksheet.topic}
              </p>
              {worksheet.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {worksheet.description}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                作成日: {new Date(worksheet.createdAt).toLocaleDateString('ja-JP')}
              </p>
            </div>
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

            {!submission ? (
              <>
                <h2 className="text-lg font-semibold mb-4">問題一覧と解答</h2>
                <div className="space-y-6">
                  {worksheet.problems.map((problem, index) => (
                    <div key={problem.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded mr-2">
                          問題 {index + 1}
                        </span>
                        <span className={`inline-block px-2 py-1 text-xs rounded ${
                          problem.options ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {problem.options ? '選択問題' : '記述問題'}
                        </span>
                      </div>
                      
                      <h3 className="font-medium text-gray-900 mb-4">
                        <MathRenderer>{problem.question}</MathRenderer>
                      </h3>
                      
                      {problem.options ? (
                        <div className="space-y-2">
                          <p className="font-medium mb-3">選択肢:</p>
                          {problem.options.map((option, optIndex) => (
                            <label
                              key={optIndex}
                              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedOptions[problem.id] === option
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`problem-${problem.id}`}
                                value={option}
                                checked={selectedOptions[problem.id] === option}
                                onChange={(e) => handleOptionChange(problem.id, e.target.value)}
                                className="mr-3"
                              />
                              <span className="text-gray-700">
                                <MathRenderer>{option}</MathRenderer>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium mb-3">回答:</p>
                          <textarea
                            value={answers[problem.id] || ''}
                            onChange={(e) => handleAnswerChange(problem.id, e.target.value)}
                            placeholder="こちらに回答を入力してください..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                            rows={4}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 pt-6 border-t">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md"
                  >
                    {isSubmitting ? '提出中...' : 'ワークシートを提出する'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className={`p-4 rounded-lg border ${
                    submission.score === submission.totalProblems ? 'bg-green-50 border-green-200' :
                    submission.score! >= submission.totalProblems * 0.7 ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <h3 className="font-semibold text-lg mb-2">
                      提出完了 - 得点: {submission.score}/{submission.totalProblems}
                    </h3>
                    <p className="text-sm">
                      提出日時: {new Date(submission.submittedAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>
                
                <h2 className="text-lg font-semibold mb-4">問題と解答結果</h2>
                <div className="space-y-6">
                  {worksheet.problems.map((problem, index) => {
                    const userAnswer = submission.answers.find(a => a.problemId === problem.id);
                    const isCorrect = userAnswer?.isCorrect;
                    
                    return (
                      <div key={problem.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded mr-2">
                            問題 {index + 1}
                          </span>
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            problem.options ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {problem.options ? '選択問題' : '記述問題'}
                          </span>
                          {isCorrect !== undefined && (
                            <span className={`inline-block ml-2 px-2 py-1 text-xs rounded ${
                              isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {isCorrect ? '✓ 正解' : '× 不正解'}
                            </span>
                          )}
                        </div>
                        
                        <h3 className="font-medium text-gray-900 mb-4">
                          <MathRenderer>{problem.question}</MathRenderer>
                        </h3>
                        
                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                          <h4 className="font-medium mb-2">あなたの回答:</h4>
                          <p className="text-gray-800">
                            <MathRenderer>{userAnswer?.answer || ''}</MathRenderer>
                          </p>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                          <h4 className="font-medium mb-2">模範解答:</h4>
                          <p className="text-gray-800">
                            <MathRenderer>{problem.correctAnswer}</MathRenderer>
                          </p>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h4 className="font-medium mb-2">解説:</h4>
                          <p className="text-gray-800">
                            <MathRenderer>{problem.explanation}</MathRenderer>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorksheetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <WorksheetPageContent />
    </Suspense>
  );
}