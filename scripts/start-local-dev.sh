#!/bin/bash

# Local Development Environment Setup Script
# This script sets up a complete local Firebase emulator environment

set -e

echo "🚀 Starting Local Development Environment for Insieme"
echo "=================================================="

# Check if we're in the correct directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: firebase.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI is not installed. Please install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if Node.js dependencies are installed
if [ ! -d "functions/node_modules" ]; then
    echo "📦 Installing Functions dependencies..."
    cd functions && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing Frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Setup frontend environment for local development
echo "⚙️  Setting up frontend environment for local development..."
cp frontend/.env.emulator frontend/.env.local

# Start Firebase Emulators in the background
echo "🔥 Starting Firebase Emulators..."
firebase emulators:start --only functions,firestore,auth,ui &
EMULATOR_PID=$!

# Wait for emulators to start
echo "⏳ Waiting for emulators to initialize..."
sleep 10

# Check if emulators are running
if ! curl -s http://127.0.0.1:4000 > /dev/null; then
    echo "❌ Error: Firebase Emulators failed to start"
    kill $EMULATOR_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Firebase Emulators are running!"
echo "   - Emulator UI: http://127.0.0.1:4000"
echo "   - Functions: http://127.0.0.1:5001"
echo "   - Firestore: http://127.0.0.1:8080"
echo "   - Auth: http://127.0.0.1:9099"

# Start frontend development server
echo "🌐 Starting Frontend development server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to initialize..."
sleep 5

echo "✅ Local Development Environment is ready!"
echo "=================================================="
echo "🎉 Access your application at: http://localhost:3001"
echo "🔧 Firebase Emulator UI: http://127.0.0.1:4000"
echo ""
echo "To stop the development environment, press Ctrl+C"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping Local Development Environment..."
    kill $EMULATOR_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ Development environment stopped."
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for user to stop the script
wait