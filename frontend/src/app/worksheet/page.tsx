"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "../../components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";
import { Worksheet, WorksheetSubmission, WorksheetStatus } from "../../types";
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
  
  // Handwritten PDF submission states
  const [submissionMode, setSubmissionMode] = useState<'text' | 'pdf'>('text');
  const [answerPDF, setAnswerPDF] = useState<File | null>(null);
  const [answerPDFData, setAnswerPDFData] = useState<string | null>(null);

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

  const handlePDFAnswerUpload = async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      console.error('Invalid file type:', file.type);
      alert('PDFファイルのみアップロード可能です。');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      console.error('File size too large:', file.size);
      alert('ファイルサイズは10MB以下にしてください。');
      return;
    }

    console.log('Processing answer PDF file:', file.name, file.size);
    setAnswerPDF(file);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setAnswerPDFData(base64);
      console.log('Answer PDF converted to base64, size:', base64.length);
    };
    reader.onerror = (e) => {
      console.error('Failed to read answer PDF file:', e);
      alert('PDFファイルの読み込みに失敗しました。');
      setAnswerPDF(null);
    };
    reader.readAsDataURL(file);
  };

  const removeAnswerPDF = () => {
    setAnswerPDF(null);
    setAnswerPDFData(null);
  };

  const handleSubmit = async () => {
    if (!user || !worksheet || !worksheetId) return;

    // Validate based on submission mode
    if (submissionMode === 'text') {
      const unansweredProblems = worksheet.problems.filter(problem => 
        !answers[problem.id] || answers[problem.id].trim() === ''
      );
      
      if (unansweredProblems.length > 0) {
        alert(`まだ回答されていない問題があります: 問題 ${unansweredProblems.map((_, i) => i + 1).join(', ')}`);
        return;
      }
    } else if (submissionMode === 'pdf') {
      if (!answerPDF || !answerPDFData) {
        alert('解答PDFファイルをアップロードしてください。');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const functionsBaseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
      let response;

      if (submissionMode === 'text') {
        // Prepare answer data for LLM grading API
        const answerData = worksheet.problems.map(problem => ({
          problemId: problem.id,
          answer: answers[problem.id].trim()
        }));

        // Call LLM grading API
        response = await fetch(`${functionsBaseUrl}/gradeAnswers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            problems: worksheet.problems,
            answers: answerData,
            userId: user.uid,
            worksheetId
          })
        });
      } else {
        // PDF mode - call new PDF grading API
        response = await fetch(`${functionsBaseUrl}/gradeAnswersPDF`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            problems: worksheet.problems,
            answerPDFData: answerPDFData,
            userId: user.uid,
            worksheetId
          })
        });
      }

      if (!response.ok) {
        throw new Error(`Grading failed: ${response.status}`);
      }

      const gradingResult = await response.json();
      
      if (!gradingResult.success) {
        throw new Error('Grading API returned error');
      }

      // Use LLM grading results
      const gradedAnswers = gradingResult.gradedAnswers;
      const totalScore = gradingResult.totalScore || 0;
      const percentageScore = gradingResult.percentageScore || 0;

      const submissionData: Omit<WorksheetSubmission, 'id'> = {
        worksheetId,
        userId: user.uid,
        answers: gradedAnswers,
        submittedAt: new Date().toISOString(),
        score: Math.round(totalScore),
        totalProblems: worksheet.problems.length,
        partialScore: gradingResult.partialScore,
        percentageScore,
        gradingMethod: 'llm-assisted'
      };

      const submissionId = `${worksheetId}_${user.uid}`;
      await setDoc(doc(db, 'worksheet_submissions', submissionId), submissionData);
      
      // Update worksheet status to 'submitted'
      await setDoc(doc(db, 'worksheets', worksheetId), {
        ...worksheet,
        status: 'submitted' as WorksheetStatus
      });
      
      setSubmission({ id: submissionId, ...submissionData });
      alert(`ワークシートを提出しました！\n得点: ${Math.round(totalScore)}/${worksheet.problems.length}\n正答率: ${percentageScore}%`);
    } catch (error) {
      console.error('Error submitting worksheet:', error);
      alert('提出に失敗しました。もう一度お試しください。\n' + (error instanceof Error ? error.message : ''));
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
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-4">解答方法を選択</h2>
                  <div className="flex space-x-4 mb-6">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="submissionMode"
                        value="text"
                        checked={submissionMode === 'text'}
                        onChange={(e) => setSubmissionMode(e.target.value as 'text' | 'pdf')}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">テキスト入力</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="submissionMode"
                        value="pdf"
                        checked={submissionMode === 'pdf'}
                        onChange={(e) => setSubmissionMode(e.target.value as 'text' | 'pdf')}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">手書きPDF提出</span>
                    </label>
                  </div>
                  
                  {submissionMode === 'pdf' && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2">📝 手書きPDF提出について</h3>
                      <div className="text-sm text-blue-800 space-y-1">
                        <p>1. 上の「PDF出力」ボタンから問題をPDF形式でダウンロード</p>
                        <p>2. 印刷またはタブレットで手書き解答</p>
                        <p>3. 解答をPDFファイルとしてスキャン・保存</p>
                        <p>4. 下のエリアから解答PDFをアップロード</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {submissionMode === 'text' ? (
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
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold mb-4">問題確認</h2>
                    <div className="space-y-6 mb-8">
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
                          
                          {problem.options && (
                            <div className="space-y-2">
                              <p className="font-medium mb-3">選択肢:</p>
                              {problem.options.map((option, optIndex) => (
                                <div key={optIndex} className="p-3 border border-gray-200 rounded-lg">
                                  <span className="text-gray-700">
                                    <MathRenderer>{option}</MathRenderer>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* PDF Upload Section */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">解答PDFアップロード</h3>
                      
                      {!answerPDF ? (
                        <div className="text-center">
                          <div className="mb-4">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                            </svg>
                          </div>
                          <p className="text-gray-600 mb-4">
                            手書き解答をPDFファイルとしてアップロードしてください
                          </p>
                          <div className="mb-4">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handlePDFAnswerUpload(file);
                                }
                              }}
                              className="hidden"
                              id="pdf-upload"
                            />
                            <label
                              htmlFor="pdf-upload"
                              className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              📁 PDFファイルを選択
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            ファイルサイズ: 10MB以下 | 形式: PDF
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="mb-4">
                            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-green-600 font-medium mb-2">
                            ✅ PDFファイルがアップロードされました
                          </p>
                          <p className="text-gray-600 mb-4">
                            ファイル名: {answerPDF.name}
                          </p>
                          <p className="text-gray-500 text-sm mb-4">
                            サイズ: {(answerPDF.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={removeAnswerPDF}
                              className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                            >
                              🗑️ ファイルを削除
                            </button>
                            <label
                              htmlFor="pdf-upload-replace"
                              className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              🔄 ファイルを変更
                            </label>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handlePDFAnswerUpload(file);
                                }
                              }}
                              className="hidden"
                              id="pdf-upload-replace"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
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
                    (submission.percentageScore || 0) >= 90 ? 'bg-green-50 border-green-200' :
                    (submission.percentageScore || 0) >= 70 ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <h3 className="font-semibold text-lg mb-2">
                      提出完了 - 得点: {submission.score}/{submission.totalProblems}
                      {submission.percentageScore !== undefined && (
                        <span className="ml-2 text-sm">({submission.percentageScore}%)</span>
                      )}
                    </h3>
                    {submission.partialScore !== undefined && submission.partialScore !== submission.score && (
                      <p className="text-sm mb-1">
                        部分点込み: {submission.partialScore.toFixed(1)}点
                      </p>
                    )}
                    {submission.gradingMethod && (
                      <p className="text-xs text-gray-600 mb-1">
                        採点方法: {submission.gradingMethod === 'llm-assisted' ? 'AI支援採点' : '基本採点'}
                      </p>
                    )}
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
                    const partialScore = userAnswer?.partialScore;
                    const feedback = userAnswer?.feedback;
                    const reasoning = userAnswer?.reasoning;
                    const confidence = userAnswer?.confidence;
                    
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
                          
                          {/* Score Display */}
                          {partialScore !== undefined ? (
                            <span className={`inline-block ml-2 px-2 py-1 text-xs rounded ${
                              partialScore >= 0.7 ? 'bg-green-100 text-green-800' :
                              partialScore >= 0.4 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(partialScore * 100)}%
                            </span>
                          ) : isCorrect !== undefined ? (
                            <span className={`inline-block ml-2 px-2 py-1 text-xs rounded ${
                              isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {isCorrect ? '✓ 正解' : '× 不正解'}
                            </span>
                          ) : null}
                          
                          {/* Confidence Display */}
                          {confidence !== undefined && (
                            <span className="inline-block ml-2 px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                              信頼度: {Math.round(confidence * 100)}%
                            </span>
                          )}
                        </div>
                        
                        <h3 className="font-medium text-gray-900 mb-4">
                          <MathRenderer>{problem.question}</MathRenderer>
                        </h3>
                        
                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                          <h4 className="font-medium mb-2">あなたの回答:</h4>
                          <div className="text-gray-800">
                            <MathRenderer>{userAnswer?.answer || ''}</MathRenderer>
                          </div>
                        </div>
                        
                        {/* LLM Feedback */}
                        {feedback && (
                          <div className="bg-purple-50 p-4 rounded-lg mb-4">
                            <h4 className="font-medium mb-2 text-purple-800">AIからのフィードバック:</h4>
                            <div className="text-purple-700">
                              <MathRenderer>{feedback}</MathRenderer>
                            </div>
                          </div>
                        )}
                        
                        {/* LLM Reasoning */}
                        {reasoning && (
                          <div className="bg-orange-50 p-4 rounded-lg mb-4">
                            <h4 className="font-medium mb-2 text-orange-800">採点理由:</h4>
                            <div className="text-orange-700 text-sm">
                              <MathRenderer>{reasoning}</MathRenderer>
                            </div>
                          </div>
                        )}
                        
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                          <h4 className="font-medium mb-2">模範解答:</h4>
                          <div className="text-gray-800">
                            <MathRenderer>{problem.correctAnswer}</MathRenderer>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h4 className="font-medium mb-2">解説:</h4>
                          <div className="text-gray-800">
                            <MathRenderer>{problem.explanation}</MathRenderer>
                          </div>
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