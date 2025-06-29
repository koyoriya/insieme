#!/bin/bash

# Development Environment Setup Script
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Insieme development environment${NC}"

# Check if required tools are installed
echo -e "${YELLOW}🔍 Checking required tools...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18 or later.${NC}"
    exit 1
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js found: ${NODE_VERSION}${NC}"
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.11 or later.${NC}"
    exit 1
else
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python found: ${PYTHON_VERSION}${NC}"
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Setting up frontend...${NC}"

# Setup frontend
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}Frontend dependencies already installed${NC}"
fi
cd ..

echo -e "${YELLOW}🐍 Setting up backend...${NC}"

# Setup backend
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${YELLOW}Virtual environment already exists${NC}"
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

# Install development dependencies
pip install pytest pytest-asyncio httpx ruff mypy
echo -e "${GREEN}✅ Development dependencies installed${NC}"

cd ..

# Create .env file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ Created .env file from example${NC}"
    echo -e "${YELLOW}⚠️  Please update backend/.env with your actual values${NC}"
else
    echo -e "${YELLOW}.env file already exists${NC}"
fi

# Run tests to make sure everything is working
echo -e "${YELLOW}🧪 Running tests...${NC}"

# Test frontend
echo -e "${YELLOW}Testing frontend...${NC}"
cd frontend
npm run lint
npm run type-check
echo -e "${GREEN}✅ Frontend tests passed${NC}"
cd ..

# Test backend
echo -e "${YELLOW}Testing backend...${NC}"
cd backend
source venv/bin/activate
ruff check . || echo -e "${YELLOW}⚠️  Some linting issues found${NC}"
pytest
echo -e "${GREEN}✅ Backend tests passed${NC}"
cd ..

echo -e "${BLUE}🎉 Development environment setup complete!${NC}"
echo -e "\n${YELLOW}🚀 To start development:${NC}"
echo -e "${GREEN}Frontend:${NC} cd frontend && npm run dev"
echo -e "${GREEN}Backend:${NC}  cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo -e "\n${YELLOW}📝 Don't forget to:${NC}"
echo -e "- Update backend/.env with your database URL and other secrets"
echo -e "- Set up your Google Cloud project: make setup-gcp PROJECT_ID=your-project-id"
echo -e "- Set up Firebase hosting: make setup-firebase PROJECT_ID=your-project-id"