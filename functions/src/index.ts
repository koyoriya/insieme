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
  cors: true,
  invoker: "public"
}, async (request, response) => {
  try {
    logger.info("generateProblems called", {
      method: request.method,
      contentType: request.headers['content-type'],
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
      questionType,
      topic,
      numQuestions,
      userId,
    } = request.body;
    
    logger.info("Parsed request body", {subject, difficulty, topic, numQuestions, userId});

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
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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

      // Add metadata to each problem
      const problems = problemData.problems.map((problem: any, index: number) => ({
        ...problem,
        id: `${Date.now()}_${index}`,
        subject,
        difficulty,
        topic,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      }));

      // Save to Firestore
      const batch = db.batch();
      problems.forEach((problem: any) => {
        const docRef = db.collection("problems").doc();
        batch.set(docRef, problem);
      });
      await batch.commit();

    response.json({
      success: true,
      problems,
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