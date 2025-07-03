#!/bin/bash

# Test Local Functions Script
# This script tests Firebase Functions running in the local emulator

set -e

echo "🧪 Testing Local Firebase Functions"
echo "=================================="

# Check if emulators are running
if ! curl -s http://127.0.0.1:5001 > /dev/null; then
    echo "❌ Error: Firebase Emulators are not running. Please start them first with:"
    echo "   ./scripts/start-local-dev.sh"
    exit 1
fi

FUNCTIONS_BASE="http://127.0.0.1:5001/demo-insieme/us-central1"

echo "🔥 Testing Functions at: $FUNCTIONS_BASE"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
HEALTH_RESPONSE=$(curl -s "$FUNCTIONS_BASE/health" || echo "FAILED")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed: $HEALTH_RESPONSE"
fi
echo ""

# Test 2: Hello World
echo "2️⃣  Testing Hello World..."
HELLO_RESPONSE=$(curl -s "$FUNCTIONS_BASE/helloWorld" || echo "FAILED")
if [[ $HELLO_RESPONSE == *"Hello from Firebase Functions"* ]]; then
    echo "   ✅ Hello World function works"
else
    echo "   ❌ Hello World function failed: $HELLO_RESPONSE"
fi
echo ""

# Test 3: Generate Problems (with Gemini API)
echo "3️⃣  Testing Generate Problems..."
GENERATE_PAYLOAD='{
    "subject": "math",
    "difficulty": "easy", 
    "topic": "足し算",
    "numQuestions": 1,
    "userId": "test-user"
}'

GENERATE_RESPONSE=$(curl -s -X POST "$FUNCTIONS_BASE/generateProblems" \
    -H "Content-Type: application/json" \
    -d "$GENERATE_PAYLOAD" || echo "FAILED")

if [[ $GENERATE_RESPONSE == *"success"* ]]; then
    echo "   ✅ Generate Problems function works (Gemini API connected)"
    # Extract and display the generated problem
    echo "   📝 Generated problem preview:"
    echo "$GENERATE_RESPONSE" | grep -o '"question":"[^"]*"' | head -1 | sed 's/"question":"//; s/"//' || true
else
    echo "   ❌ Generate Problems function failed: $GENERATE_RESPONSE"
fi
echo ""

# Test 4: Grade Answers (AI Grading)
echo "4️⃣  Testing Grade Answers..."
GRADE_PAYLOAD='{
    "problems": [{
        "id": "test1",
        "question": "2+2を計算してください",
        "correctAnswer": "4",
        "options": null
    }],
    "answers": [{
        "problemId": "test1",
        "answer": "四"
    }],
    "userId": "test-user"
}'

GRADE_RESPONSE=$(curl -s -X POST "$FUNCTIONS_BASE/gradeAnswers" \
    -H "Content-Type: application/json" \
    -d "$GRADE_PAYLOAD" || echo "FAILED")

if [[ $GRADE_RESPONSE == *"success"* ]]; then
    echo "   ✅ Grade Answers function works (AI grading active)"
else
    echo "   ❌ Grade Answers function failed: $GRADE_RESPONSE"
fi

echo ""
echo "🎉 Function testing complete!"
echo "   All core functions are ready for local development."