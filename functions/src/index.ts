import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

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

// CORS middleware
const corsHandler = (request: any, response: any, next: any) => {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }
  
  next();
};

// API endpoint with CORS
export const api = onRequest(async (request, response) => {
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
  });
});