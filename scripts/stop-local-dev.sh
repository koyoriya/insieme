#!/bin/bash

# Stop Local Development Environment Script

echo "🛑 Stopping Local Development Environment..."

# Kill Firebase Emulators
pkill -f "firebase emulators" || true

# Kill Next.js development server
pkill -f "next dev" || true

# Kill any remaining Node processes on development ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true  # Frontend
lsof -ti:5001 | xargs kill -9 2>/dev/null || true  # Functions
lsof -ti:8080 | xargs kill -9 2>/dev/null || true  # Firestore
lsof -ti:9099 | xargs kill -9 2>/dev/null || true  # Auth
lsof -ti:4000 | xargs kill -9 2>/dev/null || true  # Emulator UI

echo "✅ Local Development Environment stopped."