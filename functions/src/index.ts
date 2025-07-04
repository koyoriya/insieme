import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {GoogleAIFileManager} from "@google/generative-ai/server";
import * as cors from "cors";
import * as puppeteer from "puppeteer";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize file manager for PDF uploads
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");

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

// ✅ プロンプト生成ロジックの切り出し
function buildPrompt(options: {
  numQuestions: number;
  difficulty: string;
  topic?: string;
  pdfIncluded: boolean;
}): string {
  const map: {[key: string]: string} = {easy: "簡単", medium: "普通", hard: "難しい"};
  const diff = map[options.difficulty] || "普通";
  let p = `あなたは教育問題作成の専門家です。以下の条件に従って学習問題を${options.numQuestions}問作成してください。\n\n【条件】\n- 難易度: ${diff}\n`;
  if (options.pdfIncluded) {
    p += "- 資料: 提供されたPDFファイルの内容\n";
    if (options.topic) p += `- 追加指示: ${options.topic}\n`;
    p += "【指示】\nPDFの内容を理解し、全ての情報を活用して問題を作成してください。\n";
  } else {
    p += `- トピック: ${options.topic}\n`;
  }
  p += `\n【出力形式】\nJSON形式で次の構造を純粋に返してください。
{
  "problems": [
    {
      "question": string,
      "options": string[] | null,
      "correctAnswer": string,
      "explanation": string,
      "type": "multiple-choice" | "short-answer" | "essay"
    }
  ]
}
- 選択肢問題は正答＋誤答3つ
- 記述・論述問題は模範解答付き
- 日本語
- コードブロック禁止、純JSONのみ
`;
  return p;
}

// Generate problems using Gemini AI
export const generateProblems = onRequest({
  invoker: "public",
  timeoutSeconds: 300
}, async (request, response): Promise<void> => {
  return new Promise((resolve) => {
    corsHandler(request, response, async () => {
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
          pdfData,
        } = request.body || {};

        if (!subject || !numQuestions || !userId) {
          response.status(400).json({error: "subject, numQuestions, userId は必須です"});
          return;
        }
        if (!topic && !pdfData) {
          response.status(400).json({error: "topic または pdfData のどちらかが必要です"});
          return;
        }
        if (!process.env.GEMINI_API_KEY) {
          response.status(500).json({error: "Gemini API key 未設定です"});
          return;
        }

        let fileId: string | null = null;
        if (pdfData) {
          try {
            const base64 = pdfData.split(",")[1];
            if (!base64) throw new Error("base64抽出失敗");
            const buffer = Buffer.from(base64, "base64");
            const upload = await fileManager.uploadFile(buffer, {
              mimeType: "application/pdf",
              displayName: "uploaded_document.pdf"
            });
            fileId = upload.file.name;
            logger.info("PDFアップロード成功", {fileId});
          } catch (e) {
            logger.error("PDFアップロード失敗", e);
            response.status(500).json({error: "PDF処理に失敗しました"});
            return;
          }
        }

        const prompt = buildPrompt({
          numQuestions,
          difficulty,
          topic,
          pdfIncluded: !!fileId,
        });

        let responseText: string;
        if (fileId) {
          const model = genAI.getGenerativeModel({model: "gemini-2.5-pro"});
          const result = await model.generateContent([
            {
              fileData: {
                mimeType: "application/pdf",
                fileUri: `https://generativelanguage.googleapis.com/v1beta/${fileId}`
              }
            },
            {text: prompt}
          ]);
          responseText = result.response.text();
        } else {
          const model = genAI.getGenerativeModel({model: "gemini-2.5-pro"});
          responseText = (await model.generateContent(prompt)).response.text();
        }

        responseText = responseText.replace(/```json\n?|```/g, "").trim();
        let problemData;
        try {
          problemData = JSON.parse(responseText);
        } catch {
          logger.error("JSON解析失敗", responseText.substring(0,200));
          response.status(500).json({error: "AI応答がJSONではありません"});
          return;
        }

        if (!Array.isArray(problemData.problems)) {
          response.status(500).json({error: "problems配列がありません"});
          return;
        }

        // Create worksheet with problems
        const problems = problemData.problems.map((problem: any, index: number) => ({
          ...problem,
          id: `problem_${Date.now()}_${index}`,
        }));

        // Create worksheet title and description
        let title: string;
        let description: string;

        if (fileId && topic) {
          title = `PDF資料 + ${topic} - ${difficulty === "easy" ? "簡単" : difficulty === "medium" ? "普通" : "難しい"}`;
          description = `PDFファイルの内容と「${topic}」に関する${numQuestions}問の練習問題`;
        } else if (fileId) {
          title = `PDF資料 - ${difficulty === "easy" ? "簡単" : difficulty === "medium" ? "普通" : "難しい"}`;
          description = `PDFファイルの内容に基づく${numQuestions}問の練習問題`;
        } else {
          title = `${topic} - ${difficulty === "easy" ? "簡単" : difficulty === "medium" ? "普通" : "難しい"}`;
          description = `${topic}に関する${numQuestions}問の練習問題`;
        }

        const worksheet = {
          title,
          description,
          subject,
          topic: topic || "PDF資料",
          difficulty,
          createdAt: new Date().toISOString(),
          createdBy: userId,
          problems,
          status: "ready",
          hasPDF: !!fileId,
          pdfFileId: fileId,
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
      resolve(undefined);
    });
  });
});

// Grade answers using Gemini AI
export const gradeAnswers = onRequest({
  invoker: "public",
  timeoutSeconds: 300
}, async (request, response) => {
  return new Promise((resolve) => {
    corsHandler(request, response, async () => {
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

        const model = genAI.getGenerativeModel({model: "gemini-2.5-pro"});
        logger.info("Gemini 2.5 Pro model initialized for grading");

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
      resolve(undefined);
    });
  });
});

// Generate PDF from worksheet data using Puppeteer
export const generateWorksheetPDF = onRequest({
  invoker: "public",
  timeoutSeconds: 300,
  memory: "1GiB"
}, async (request, response) => {
  return new Promise((resolve) => {
    corsHandler(request, response, async () => {
      try {
        logger.info("generateWorksheetPDF called", {
          method: request.method,
          contentType: request.headers["content-type"]
        });

        if (request.method !== "POST") {
          response.status(405).json({error: "Method not allowed"});
          return;
        }

        if (!request.body) {
          response.status(400).json({error: "Request body is required"});
          return;
        }

        const {worksheet, options = {}} = request.body;

        if (!worksheet || !worksheet.title || !Array.isArray(worksheet.problems)) {
          response.status(400).json({error: "Invalid worksheet data"});
          return;
        }

        logger.info("Launching Puppeteer browser");
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu"
          ]
        });

        const page = await browser.newPage();
        await page.setViewport({width: 794, height: 1123}); // A4 dimensions

        // Generate HTML content with proper CSS for page breaks and KaTeX
        const html = generateWorksheetHTML(worksheet, options);

        await page.setContent(html, {waitUntil: "networkidle0"});

        // Generate PDF with proper page break support
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: {
            top: "20mm",
            bottom: "20mm",
            left: "20mm",
            right: "20mm"
          }
        });

        await browser.close();

        // Return PDF as base64
        const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

        response.json({
          success: true,
          pdfData: `data:application/pdf;base64,${pdfBase64}`,
          filename: `${worksheet.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "_")}.pdf`
        });

      } catch (error) {
        logger.error("PDF generation failed", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
        response.status(500).json({
          error: error instanceof Error ? error.message : "PDF generation failed"
        });
      }
      resolve(undefined);
    });
  });
});

// Helper function to generate HTML content for PDF
function generateWorksheetHTML(worksheet: any, options: any = {}): string {
  const renderMath = (text: string): string => {
    // Replace inline math delimited by $ ... $
    text = text.replace(/\$([^$]+)\$/g, (_, math) => {
      return `<span class="katex-inline">\\(${math}\\)</span>`;
    });

    // Replace display math delimited by $$ ... $$
    text = text.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
      return `<div class="katex-display">\\[${math}\\]</div>`;
    });

    return text;
  };

  const problemsHTML = worksheet.problems.map((problem: any, index: number) => `
    <div class="problem-container">
      <div class="problem-header">
        <span class="problem-number">問${index + 1}.</span>
        <span class="problem-question">${renderMath(problem.question)}</span>
      </div>

      ${problem.options && problem.options.length > 0 ? `
        <div class="options-container">
          ${problem.options.map((option: string, optionIndex: number) => `
            <div class="option">
              <span class="option-label">(${String.fromCharCode(65 + optionIndex)})</span>
              <span class="option-text">${renderMath(option)}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${!options.includeAnswers ? `
        <div class="answer-space"></div>
      ` : `
        <div class="answer-section">
          <div class="answer-label">解答:</div>
          <div class="answer-text">${renderMath(problem.correctAnswer)}</div>
          <div class="explanation-label">解説:</div>
          <div class="explanation-text">${renderMath(problem.explanation || "")}</div>
        </div>
      `}
    </div>
  `).join("");

  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${worksheet.title}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #000;
          background: white;
        }

        .worksheet-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
        }

        .worksheet-title {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .worksheet-description {
          font-size: 11pt;
          color: #666;
          margin-bottom: 10px;
        }

        .worksheet-metadata {
          display: flex;
          justify-content: space-between;
          font-size: 10pt;
          color: #666;
        }

        .problem-container {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 25px;
          min-height: 150px;
        }

        .problem-header {
          margin-bottom: 10px;
        }

        .problem-number {
          font-weight: bold;
          margin-right: 10px;
        }

        .problem-question {
          display: inline;
        }

        .options-container {
          margin-left: 20px;
          margin-bottom: 10px;
        }

        .option {
          margin: 5px 0;
        }

        .option-label {
          font-weight: bold;
          margin-right: 8px;
        }

        .option-text {
          display: inline;
        }

        .answer-space {
          margin-top: 20px;
          margin-bottom: 20px;
          min-height: 80px;
        }

        .answer-section {
          margin-top: 15px;
          padding: 10px;
          background: #f0f8ff;
          border-left: 4px solid #007bff;
        }

        .answer-label, .explanation-label {
          font-weight: bold;
          color: #007bff;
          margin-bottom: 5px;
        }

        .answer-text, .explanation-text {
          margin-bottom: 10px;
        }

        /* KaTeX fraction improvements */
        .katex .mfrac .frac-line {
          border-bottom: 1.5px solid #000 !important;
          height: 1.5px !important;
          margin: 6px 0 !important;
          position: relative !important;
          top: 8px !important;
        }

        .katex .mfrac > span > span:first-child {
          padding-bottom: 10px !important;
        }

        .katex .mfrac > span > span:last-child {
          padding-top: 10px !important;
        }

        /* Ensure proper page breaks */
        @media print {
          .problem-container {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="worksheet-header">
        <div class="worksheet-title">${worksheet.title}</div>
        ${worksheet.description ? `<div class="worksheet-description">${worksheet.description}</div>` : ""}
        <div class="worksheet-metadata">
          <span>難易度: ${worksheet.difficulty || "N/A"} | トピック: ${worksheet.topic || "N/A"}</span>
          <span>作成日: ${worksheet.createdAt ? new Date(worksheet.createdAt).toLocaleDateString("ja-JP") : "N/A"}</span>
        </div>
      </div>

      <div class="problems-container">
        ${problemsHTML}
      </div>

      <script>
        document.addEventListener("DOMContentLoaded", function() {
          renderMathInElement(document.body, {
            delimiters: [
              {left: "\\\\(", right: "\\\\)", display: false},
              {left: "\\\\[", right: "\\\\]", display: true}
            ]
          });
        });
      </script>
    </body>
    </html>
  `;
}

// Grade handwritten PDF answers using Gemini Vision API
export const gradeAnswersPDF = onRequest({
  invoker: "public",
  timeoutSeconds: 300
}, async (request, response) => {
  return new Promise((resolve) => {
    corsHandler(request, response, async () => {
      try {
        logger.info("gradeAnswersPDF called", {
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

        const {problems, answerPDFData, userId, worksheetId} = request.body;

        logger.info("Parsed PDF grading request", {
          problems: problems?.length,
          hasPDFData: !!answerPDFData,
          userId,
          worksheetId
        });

        if (!problems || !answerPDFData || !userId || !Array.isArray(problems)) {
          response.status(400).json({error: "Missing required fields: problems, answerPDFData, userId"});
          return;
        }

        if (!process.env.GEMINI_API_KEY) {
          response.status(500).json({error: "Gemini API key not configured"});
          return;
        }

        // Upload PDF to Gemini File Manager
        let fileId: string | null = null;
        try {
          const base64 = answerPDFData.split(",")[1];
          if (!base64) throw new Error("Base64データの抽出に失敗しました");

          const buffer = Buffer.from(base64, "base64");
          const upload = await fileManager.uploadFile(buffer, {
            mimeType: "application/pdf",
            displayName: "handwritten_answers.pdf"
          });
          fileId = upload.file.name;
          logger.info("PDF uploaded to Gemini", {fileId});
        } catch (uploadError) {
          logger.error("Failed to upload PDF to Gemini", uploadError);
          response.status(500).json({error: "PDFのアップロードに失敗しました"});
          return;
        }

        const model = genAI.getGenerativeModel({model: "gemini-2.5-pro"});
        logger.info("Gemini 2.5 Pro model initialized for PDF grading");

        // Create a comprehensive prompt for extracting and grading answers
        const extractionPrompt = `
あなたは教育分野の採点専門家です。提供されたPDFファイルには学習者の手書き解答が含まれています。以下の問題リストに対応する回答を抽出し、各問題を採点してください。

【問題リスト】
${problems.map((problem: any, index: number) => `
問題 ${index + 1}: ${problem.question}
${problem.options ? `選択肢: ${problem.options.join(", ")}` : ""}
模範解答: ${problem.correctAnswer}
解説: ${problem.explanation || "なし"}
`).join("\n")}

【指示】
1. PDFの内容を注意深く分析し、各問題番号に対応する学習者の回答を抽出してください
2. 手書き文字を正確に読み取り、数式や記号も含めて認識してください
3. 各回答を模範解答と比較して採点してください
4. 部分点も考慮して0.0-1.0の範囲で採点してください

【数式記法】
- 数式は必ずLaTeX記法を使用してください
- インライン数式: $数式$ （例: $x^2 + y^2 = 1$）
- ブロック数式: $$数式$$ （例: $$\\frac{d}{dx}f(x) = \\lim_{h \\to 0}\\frac{f(x+h)-f(x)}{h}$$）

【出力形式】
JSON形式で以下の構造で出力してください：

{
  "extractedAnswers": [
    {
      "problemNumber": 1,
      "problemId": "problem_id",
      "extractedAnswer": "学習者の回答（手書きから抽出）",
      "score": 0.85,
      "feedback": "具体的なフィードバック文章",
      "reasoning": "採点の根拠となる理由",
      "confidence": 0.9
    }
  ]
}

【採点基準】
- 0.0-1.0の範囲で部分点を含めて採点
- 内容の正確性、理解度、表現の適切さを総合評価
- 模範解答と完全に一致しなくても、内容が正しければ高得点
- 数学的概念や科学的事実については厳密に評価
- 誤字脱字は大幅な減点対象としない
- 手書き文字の読み取りが困難な場合はその旨を明記

【注意事項】
- scoreは0.0から1.0の数値
- feedbackは学習者に向けた建設的なコメント
- reasoningは採点理由の詳細説明
- confidenceは採点の確信度（0.0-1.0）
- JSONフォーマット以外の文字は一切含めないこと
- マークダウンのコードブロックは使用しないこと
- 純粋なJSONのみを返すこと
`;

        logger.info("Calling Gemini Vision API for PDF analysis");
        const result = await model.generateContent([
          {
            fileData: {
              mimeType: "application/pdf",
              fileUri: `https://generativelanguage.googleapis.com/v1beta/${fileId}`
            }
          },
          {text: extractionPrompt}
        ]);

        let responseText = result.response.text();
        logger.info("Gemini PDF analysis response received", {
          responseLength: responseText.length
        });

        // Clean response
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let extractionResult;
        try {
          extractionResult = JSON.parse(responseText);
        } catch (parseError) {
          logger.error("Failed to parse Gemini PDF analysis response", {
            originalResponse: responseText.substring(0, 500),
            error: parseError
          });
          response.status(500).json({error: "AI応答の解析に失敗しました"});
          return;
        }

        if (!extractionResult.extractedAnswers || !Array.isArray(extractionResult.extractedAnswers)) {
          logger.error("Invalid response structure from Gemini", extractionResult);
          response.status(500).json({error: "AI応答の形式が不正です"});
          return;
        }

        // Process the extracted answers and format them for compatibility with existing system
        const gradedAnswers = [];
        let totalScore = 0;

        for (const problem of problems) {
          const extractedAnswer = extractionResult.extractedAnswers.find(
            (ans: any) => ans.problemId === problem.id || ans.problemNumber === (problems.indexOf(problem) + 1)
          );

          if (!extractedAnswer) {
            // No answer found in PDF
            gradedAnswers.push({
              problemId: problem.id,
              answer: "",
              isCorrect: false,
              partialScore: 0,
              maxScore: 1,
              feedback: "PDFから回答を読み取ることができませんでした。",
              reasoning: "手書き文字の認識失敗または回答なし",
              confidence: 1.0
            });
            continue;
          }

          // Validate and normalize score
          const score = Math.max(0, Math.min(1, extractedAnswer.score || 0));
          const isCorrect = score >= 0.7; // Consider 70%+ as correct

          gradedAnswers.push({
            problemId: problem.id,
            answer: extractedAnswer.extractedAnswer || "",
            isCorrect,
            partialScore: score,
            maxScore: 1,
            feedback: extractedAnswer.feedback || "採点が完了しました。",
            reasoning: extractedAnswer.reasoning || "",
            confidence: extractedAnswer.confidence || 0.5
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
          gradingMethod: "llm-vision-assisted",
          gradingVersion: "v1.0",
          submissionType: "handwritten-pdf"
        };

        // Save to Firestore if worksheetId is provided
        let submissionId = null;
        if (worksheetId) {
          try {
            const submissionRef = await db.collection("worksheet_submissions").add(submission);
            submissionId = submissionRef.id;
            logger.info("PDF submission saved to Firestore", {submissionId, worksheetId, userId});
          } catch (firestoreError) {
            logger.error("Failed to save PDF submission to Firestore", {
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
          },
          extractionDetails: {
            recognizedAnswers: extractionResult.extractedAnswers.length,
            totalProblems: problems.length
          }
        });

      } catch (error) {
        logger.error("PDF answer grading failed", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
        response.status(500).json({
          error: error instanceof Error ? error.message : "PDF answer grading failed",
        });
      }
      resolve(undefined);
    });
  });
});