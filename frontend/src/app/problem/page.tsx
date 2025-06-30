"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "../../components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";

interface Problem {
  id: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
  subject: string;
  difficulty: string;
  topic: string;
  createdAt: string;
  createdBy: string;
}

interface Submission {
  id: string;
  problemId: string;
  userId: string;
  answer: string;
  submittedAt: string;
  isCorrect?: boolean;
}

function ProblemPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const problemId = searchParams.get('id');
  
  const [problem, setProblem] = useState<Problem | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [problemLoading, setProblemLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && problemId) {
      loadProblem();
      loadSubmission();
    }
  }, [user, problemId]);

  const loadProblem = async () => {
    if (!problemId) return;
    
    try {
      const problemDoc = await getDoc(doc(db, 'problems', problemId));
      if (problemDoc.exists()) {
        setProblem({ id: problemDoc.id, ...problemDoc.data() } as Problem);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error loading problem:', error);
    } finally {
      setProblemLoading(false);
    }
  };

  const loadSubmission = async () => {
    if (!problemId) return;
    
    try {
      const submissionDoc = await getDoc(doc(db, 'submissions', `${problemId}_${user?.uid}`));
      if (submissionDoc.exists()) {
        const submissionData = { id: submissionDoc.id, ...submissionDoc.data() } as Submission;
        setSubmission(submissionData);
        setUserAnswer(submissionData.answer);
        setSelectedOption(submissionData.answer);
      }
    } catch (error) {
      console.error('Error loading submission:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || !problem) return;

    const answer = problem.options ? selectedOption : userAnswer;
    if (!answer.trim()) {
      alert('回答を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionData: Omit<Submission, 'id'> = {
        problemId: problem.id,
        userId: user.uid,
        answer: answer.trim(),
        submittedAt: new Date().toISOString(),
        isCorrect: problem.options ? 
          answer.trim() === problem.correctAnswer.trim() : undefined
      };

      await setDoc(doc(db, 'submissions', `${problem.id}_${user.uid}`), submissionData);
      
      setSubmission({ id: `${problem.id}_${user.uid}`, ...submissionData });
      alert('回答を提出しました！');
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('提出に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || problemLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !problem) {
    return null;
  }

  const hasSubmitted = !!submission;
  const isCorrect = submission?.isCorrect;

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
              <h1 className="text-2xl font-bold text-gray-900">問題</h1>
              <div className="flex space-x-2">
                <span className={`px-2 py-1 text-xs rounded ${
                  problem.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  problem.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {problem.difficulty === 'easy' ? '簡単' : 
                   problem.difficulty === 'medium' ? '普通' : '難しい'}
                </span>
                <span className={`px-2 py-1 text-xs rounded ${
                  problem.options ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {problem.options ? '選択問題' : '記述問題'}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              トピック: {problem.topic}
            </p>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">問題文</h2>
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {problem.question}
              </p>
            </div>

            {problem.options && (
              <div className="mb-6">
                <h3 className="font-medium mb-3">選択肢:</h3>
                <div className="space-y-2">
                  {problem.options.map((option, index) => (
                    <label
                      key={index}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedOption === option
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${hasSubmitted ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={option}
                        checked={selectedOption === option}
                        onChange={(e) => setSelectedOption(e.target.value)}
                        disabled={hasSubmitted}
                        className="mr-3"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!problem.options && (
              <div className="mb-6">
                <h3 className="font-medium mb-3">回答:</h3>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={hasSubmitted}
                  placeholder="こちらに回答を入力してください..."
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 ${hasSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  rows={4}
                />
              </div>
            )}

            {!hasSubmitted && (
              <div className="mb-6">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md"
                >
                  {isSubmitting ? '提出中...' : '回答を提出する'}
                </button>
              </div>
            )}

            {hasSubmitted && (
              <div className="border-t pt-6">
                <div className={`p-4 rounded-lg mb-4 ${
                  isCorrect === true ? 'bg-green-50 border border-green-200' :
                  isCorrect === false ? 'bg-red-50 border border-red-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    {isCorrect === true ? '✅ 正解です！' :
                     isCorrect === false ? '❌ 不正解です' :
                     '📝 回答を提出しました'}
                  </h3>
                  <p className="text-sm">
                    提出日時: {new Date(submission.submittedAt).toLocaleString('ja-JP')}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">模範解答:</h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{problem.correctAnswer}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mt-4">
                  <h3 className="font-semibold mb-2">解説:</h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{problem.explanation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProblemPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ProblemPageContent />
    </Suspense>
  );
}