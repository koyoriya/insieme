import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {GoogleGenerativeAI} from "@google/generative-ai";
import * as cors from "cors";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize CORS
const corsHandler = cors({origin: true});

// Hello World function
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.json({message: "Hello from Firebase Functions!"});
});

// Health check endpoint
export const health = onRequest(async (request, response) => {
  try {
    // Test Firestore connection
    await db.collection("health").doc("check").set({
      timestamp: new Date(),
      status: "healthy",
    });

    response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "Insieme API",
    });
  } catch (error) {
    logger.error("Health check failed", error);
    response.status(500).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});


// API endpoint with CORS
export const api = onRequest(async (request, response) => {
  return new Promise((resolve) => {
    corsHandler(request, response, async () => {
      const {method, path} = request;

      try {
        switch (method) {
        case "GET":
          if (path === "/users") {
            // Get users from Firestore
            const usersSnapshot = await db.collection("users").get();
            const users = usersSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            response.json({users});
          } else {
            response.status(404).json({error: "Endpoint not found"});
          }
          break;

        case "POST":
          if (path === "/users") {
            // Create user in Firestore
            const userData = request.body;
            const docRef = await db.collection("users").add({
              ...userData,
              createdAt: new Date(),
            });
            response.json({id: docRef.id, ...userData});
          } else {
            response.status(404).json({error: "Endpoint not found"});
          }
          break;

        default:
          response.status(405).json({error: "Method not allowed"});
        }
      } catch (error) {
        logger.error("API error", error);
        response.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
      resolve(undefined);
    });
  });
});

// Generate problems using Gemini AI
export const generateProblems = onRequest({
  invoker: "public"
}, async (request, response) => {
  // Set CORS headers for all requests
  const allowedOrigins = ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000"];
  const origin = request.headers.origin as string;

  if (allowedOrigins.includes(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
  } else {
    response.set("Access-Control-Allow-Origin", "http://localhost:3001");
  }
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.set("Access-Control-Max-Age", "3600");
  response.set("Access-Control-Allow-Credentials", "false");

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    logger.info("CORS preflight request received", {
      origin: request.headers.origin,
      method: request.method,
      headers: request.headers
    });
    response.status(204).send("");
    return;
  }
  try {
    logger.info("generateProblems called", {
      method: request.method,
      contentType: request.headers["content-type"],
      rawBody: request.rawBody?.toString(),
      body: request.body
    });

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed"});
      return;
    }

    if (!request.body) {
      response.status(400).json({error: "Request body is required"});
      return;
    }

    const {
      subject,
      difficulty,
      topic,
      numQuestions,
      userId,
      tempWorksheetId,
    } = request.body;

    logger.info("Parsed request body", {subject, difficulty, topic, numQuestions, userId, tempWorksheetId});

    if (!subject || !topic || !numQuestions || !userId) {
      response.status(400).json({error: "Missing required fields"});
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      response.status(500).json({error: "Gemini API key not configured"});
      return;
    }

    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash-exp"});
    logger.info("Gemini model initialized");

    // Create prompt for problem generation
    const difficultyMap: {[key: string]: string} = {
      easy: "簡単",
      medium: "普通",
      hard: "難しい",
    };
    const difficultyText = difficultyMap[difficulty] || "普通";

    const prompt = `
あなたは教育問題作成の専門家です。以下の条件に従って学習問題を${numQuestions}問作成してください。

【条件】
- 難易度: ${difficultyText}
- トピック: ${topic}

【自動判定してください】
- トピックに最適な科目を自動判定
- トピックに適した問題形式（選択問題、記述問題、論述問題）を自動判定し、バランスよく組み合わせ

【出力形式】
JSON形式で以下の構造で出力してください：

{
  "problems": [
    {
      "question": "問題文",
      "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"] または null（記述・論述問題の場合）,
      "correctAnswer": "正答",
      "explanation": "解説文",
      "type": "multiple-choice" または "short-answer" または "essay"
    }
  ]
}

【注意事項】
- 問題は教育的価値があり、適切な難易度であること
- 解説は理解しやすく、学習に役立つこと
- 選択問題の場合、1つの正答と3つの適切な誤答を作成すること
- 記述・論述問題の場合は、模範解答を提示すること
- トピックに最も適した問題形式を選択し、多様性を持たせること
- 日本語で出力すること
- JSONフォーマット以外の文字は一切含めないこと
- マークダウンのコードブロックは使用しないこと
- 純粋なJSONのみを返すこと
`;

    logger.info("Calling Gemini API");
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    logger.info("Gemini API response received", {responseLength: responseText.length});

    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    logger.info("Cleaned response text", {cleanedText: responseText.substring(0, 200) + "..."});

    let problemData;
    try {
      problemData = JSON.parse(responseText);
    } catch (parseError) {
      logger.error("Failed to parse Gemini response as JSON", {
        originalResponse: responseText.substring(0, 500),
        error: parseError,
      });
      response.status(500).json({
        error: "Failed to parse AI response",
        details: "Response was not valid JSON",
      });
      return;
    }

    if (!problemData.problems || !Array.isArray(problemData.problems)) {
      response.status(500).json({
        error: "Invalid response structure from AI",
      });
      return;
    }

    // Create worksheet with problems
    const problems = problemData.problems.map((problem: any, index: number) => ({
      ...problem,
      id: `problem_${Date.now()}_${index}`,
    }));

    const worksheet = {
      title: `${topic} - ${difficulty === "easy" ? "簡単" : difficulty === "medium" ? "普通" : "難しい"}`,
      description: `${topic}に関する${numQuestions}問の練習問題`,
      subject,
      topic,
      difficulty,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      problems,
      status: "ready",
    };

    // Save worksheet to Firestore
    let worksheetId: string;
    if (tempWorksheetId) {
      try {
        // Check if temporary worksheet exists before updating
        const tempDoc = await db.collection("worksheets").doc(tempWorksheetId).get();
        if (tempDoc.exists) {
          // Update existing temporary worksheet
          logger.info("Updating existing temporary worksheet", {tempWorksheetId});
          await db.collection("worksheets").doc(tempWorksheetId).update({
            ...worksheet,
            status: "ready",
          });
          worksheetId = tempWorksheetId;
        } else {
          // Temporary worksheet doesn't exist, create new one with the provided ID
          logger.info("Temporary worksheet not found, creating new worksheet with provided ID", {tempWorksheetId});
          await db.collection("worksheets").doc(tempWorksheetId).set(worksheet);
          worksheetId = tempWorksheetId;
        }
      } catch (error) {
        // If any error occurs with temp worksheet, create a new one
        logger.warn("Error handling temporary worksheet, creating new worksheet", {tempWorksheetId, error});
        const worksheetRef = db.collection("worksheets").doc();
        await worksheetRef.set(worksheet);
        worksheetId = worksheetRef.id;
      }
    } else {
      // Create new worksheet (fallback)
      logger.info("Creating new worksheet");
      const worksheetRef = db.collection("worksheets").doc();
      await worksheetRef.set(worksheet);
      worksheetId = worksheetRef.id;
    }

    // Return success response with worksheet data
    response.json({
      success: true,
      worksheet: {id: worksheetId, ...worksheet},
      count: problems.length,
    });

  } catch (error) {
    logger.error("Problem generation failed", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    response.status(500).json({
      error: error instanceof Error ? error.message : "Problem generation failed",
    });
  }
});

// Grade answers using Gemini AI
export const gradeAnswers = onRequest({
  invoker: "public"
}, async (request, response) => {
  // Set CORS headers for all requests
  const allowedOrigins = ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000"];
  const origin = request.headers.origin as string;

  if (allowedOrigins.includes(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
  } else {
    response.set("Access-Control-Allow-Origin", "http://localhost:3001");
  }

  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.set("Access-Control-Max-Age", "3600");
  response.set("Access-Control-Allow-Credentials", "false");

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    logger.info("CORS preflight request received for gradeAnswers", {
      origin: request.headers.origin,
      method: request.method,
      headers: request.headers
    });
    response.status(204).send("");
    return;
  }

  try {
    logger.info("gradeAnswers called", {
      method: request.method,
      contentType: request.headers["content-type"],
      body: request.body
    });

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed"});
      return;
    }

    if (!request.body) {
      response.status(400).json({error: "Request body is required"});
      return;
    }

    const {problems, answers, userId, worksheetId} = request.body;

    logger.info("Parsed grading request", {problems: problems?.length, answers: answers?.length, userId, worksheetId});

    if (!problems || !answers || !userId || !Array.isArray(problems) || !Array.isArray(answers)) {
      response.status(400).json({error: "Missing required fields: problems, answers, userId"});
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      response.status(500).json({error: "Gemini API key not configured"});
      return;
    }

    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash-exp"});
    logger.info("Gemini model initialized for grading");

    // Grade each answer using LLM
    const gradedAnswers = [];
    let totalScore = 0;

    for (const problem of problems) {
      const userAnswer = answers.find((ans: any) => ans.problemId === problem.id);
      
      if (!userAnswer) {
        // No answer provided
        gradedAnswers.push({
          problemId: problem.id,
          answer: "",
          isCorrect: false,
          partialScore: 0,
          maxScore: 1,
          feedback: "回答が提出されていません。",
          confidence: 1.0
        });
        continue;
      }

      // Handle multiple choice questions with exact matching
      if (problem.options && Array.isArray(problem.options)) {
        const isCorrect = userAnswer.answer.trim() === problem.correctAnswer.trim();
        gradedAnswers.push({
          problemId: problem.id,
          answer: userAnswer.answer,
          isCorrect,
          partialScore: isCorrect ? 1 : 0,
          maxScore: 1,
          feedback: isCorrect ? "正解です！" : `不正解です。正解は「${problem.correctAnswer}」です。`,
          confidence: 1.0
        });
        if (isCorrect) totalScore += 1;
        continue;
      }

      // Use LLM for open-ended questions (short answer, essay)
      const gradingPrompt = `
あなたは教育分野の採点専門家です。以下の条件に従って学習者の回答を採点してください。

【問題】
${problem.question}

【模範解答】
${problem.correctAnswer}

【学習者の回答】
${userAnswer.answer}

【解説】
${problem.explanation || "解説なし"}

【採点基準】
- 0.0-1.0の範囲で部分点を含めて採点してください
- 内容の正確性、理解度、表現の適切さを総合的に評価してください
- 模範解答と完全に一致しなくても、内容が正しければ高得点を与えてください
- 数学的概念や科学的事実については厳密に評価してください
- 誤字脱字は大幅な減点対象としないでください

【出力形式】
JSON形式で以下の構造で出力してください：

{
  "score": 0.85,
  "feedback": "具体的なフィードバック文章",
  "reasoning": "採点の根拠となる理由",
  "confidence": 0.9
}

【注意事項】
- scoreは0.0から1.0の数値
- feedbackは学習者に向けた建設的なコメント
- reasoningは採点理由の詳細説明
- confidenceは採点の確信度（0.0-1.0）
- JSONフォーマット以外の文字は一切含めないこと
- マークダウンのコードブロックは使用しないこと
- 純粋なJSONのみを返すこと
`;

      logger.info("Calling Gemini API for grading", {problemId: problem.id});
      const result = await model.generateContent(gradingPrompt);
      let responseText = result.response.text();
      logger.info("Gemini grading response received", {
        problemId: problem.id,
        responseLength: responseText.length
      });

      // Clean response
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let gradingResult;
      try {
        gradingResult = JSON.parse(responseText);
      } catch (parseError) {
        logger.error("Failed to parse Gemini grading response", {
          problemId: problem.id,
          originalResponse: responseText.substring(0, 500),
          error: parseError
        });
        
        // Fallback: basic text similarity check
        const similarity = userAnswer.answer.toLowerCase().includes(problem.correctAnswer.toLowerCase()) ? 0.7 : 0.1;
        gradingResult = {
          score: similarity,
          feedback: "自動採点でエラーが発生しました。手動での確認をお勧めします。",
          reasoning: "LLM応答の解析に失敗",
          confidence: 0.3
        };
      }

      // Validate and normalize score
      const score = Math.max(0, Math.min(1, gradingResult.score || 0));
      const isCorrect = score >= 0.7; // Consider 70%+ as correct

      gradedAnswers.push({
        problemId: problem.id,
        answer: userAnswer.answer,
        isCorrect,
        partialScore: score,
        maxScore: 1,
        feedback: gradingResult.feedback || "採点が完了しました。",
        reasoning: gradingResult.reasoning || "",
        confidence: gradingResult.confidence || 0.5
      });

      totalScore += score;
    }

    // Calculate final scores
    const maxTotalScore = problems.length;
    const percentageScore = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;

    // Create submission record
    const submission = {
      worksheetId: worksheetId || null,
      userId,
      answers: gradedAnswers,
      score: Math.round(totalScore),
      totalProblems: problems.length,
      partialScore: totalScore,
      percentageScore: Math.round(percentageScore),
      submittedAt: new Date().toISOString(),
      gradingMethod: "llm-assisted",
      gradingVersion: "v1.0"
    };

    // Save to Firestore if worksheetId is provided
    let submissionId = null;
    if (worksheetId) {
      try {
        const submissionRef = await db.collection("worksheet_submissions").add(submission);
        submissionId = submissionRef.id;
        logger.info("Submission saved to Firestore", {submissionId, worksheetId, userId});
      } catch (firestoreError) {
        logger.error("Failed to save submission to Firestore", {
          error: firestoreError,
          worksheetId,
          userId
        });
        // Continue without failing the entire request
      }
    }

    // Return grading results
    response.json({
      success: true,
      submissionId,
      gradedAnswers,
      totalScore,
      maxTotalScore,
      partialScore: totalScore,
      percentageScore: Math.round(percentageScore),
      gradingSummary: {
        correct: gradedAnswers.filter(ans => ans.isCorrect).length,
        total: gradedAnswers.length,
        averageConfidence: gradedAnswers.reduce((sum, ans) => sum + (ans.confidence || 0), 0) / gradedAnswers.length
      }
    });

  } catch (error) {
    logger.error("Answer grading failed", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    response.status(500).json({
      error: error instanceof Error ? error.message : "Answer grading failed",
    });
  }
});