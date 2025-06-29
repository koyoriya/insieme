.PHONY: help setup-dev setup-firebase install-frontend test-frontend dev-frontend dev-functions clean

# Default project settings
PROJECT_ID ?= insieme-app

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup-dev: install-frontend ## Setup development environment
	@chmod +x scripts/setup-dev.sh
	@echo "✅ Development environment setup complete!"
	@echo "Frontend: cd frontend && npm run dev"
	@echo "Functions: firebase emulators:start"

install-frontend: ## Install frontend dependencies
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install

setup-firebase: check-firebase ## Setup Firebase hosting
	@echo "🔥 Setting up Firebase..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make setup-firebase PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@chmod +x scripts/setup-firebase.sh
	./scripts/setup-firebase.sh $(PROJECT_ID)

get-firebase-token: check-firebase ## Get Firebase CI token for GitHub Actions
	@echo "🔑 Getting Firebase CI token..."
	@echo "📋 This token will be used for GitHub Actions deployment"
	@echo ""
	@echo "🔑 Generating Firebase CI token..."
	@firebase login:ci
	@echo ""
	@echo "📋 Add this token to your GitHub Secrets as 'FIREBASE_TOKEN'"
	@echo "📋 Repository Settings > Secrets and variables > Actions > New repository secret"

test-frontend: ## Run frontend tests
	@echo "🧪 Running frontend tests..."
	cd frontend && npm run lint && npm run type-check && npm run test

test: test-frontend ## Run all tests

dev-frontend: ## Start frontend development server
	cd frontend && npm run dev

dev-functions: ## Start Firebase Functions emulator
	firebase emulators:start --only functions

dev-all: ## Start all development servers
	@echo "🚀 Starting development environment..."
	@echo "Starting Firebase emulators..."
	firebase emulators:start &
	@echo "Starting frontend development server..."
	cd frontend && npm run dev

clean: ## Clean up build artifacts and dependencies
	@echo "🧹 Cleaning up..."
	rm -rf frontend/node_modules frontend/.next frontend/out
	rm -rf functions/node_modules functions/lib
	find . -name "*.tsbuildinfo" -delete

check-firebase: ## Check if firebase CLI is installed
	@which firebase >/dev/null || (echo "❌ firebase CLI not found. Install with:" && \
		echo "   npm install -g firebase-tools" && \
		exit 1)
	@echo "✅ firebase CLI found"

validate-env: check-firebase ## Validate required tools are installed
	@echo "✅ Environment validation complete!"