.PHONY: help setup-dev setup-gcp setup-firebase install-frontend install-backend test-frontend test-backend test clean

# Default project settings
PROJECT_ID ?= insieme-app
REGION ?= asia-northeast1
DB_INSTANCE ?= insieme-db
DB_NAME ?= insieme
BILLING_ACCOUNT_ID ?=
SKIP_SQL ?= false

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup-dev: install-frontend install-backend ## Setup development environment
	@chmod +x scripts/setup-dev.sh
	@echo "✅ Development environment setup complete!"
	@echo "Frontend: cd frontend && npm run dev"
	@echo "Backend: cd backend && source venv/bin/activate && uvicorn main:app --reload"

install-frontend: ## Install frontend dependencies
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install

install-backend: ## Install backend dependencies and setup virtual environment
	@echo "📦 Setting up backend virtual environment..."
	cd backend && python3 -m venv venv
	@echo "📦 Installing backend dependencies..."
	cd backend && source venv/bin/activate && pip install -r requirements.txt

setup-gcp: check-gcloud ## Setup Google Cloud Platform resources
	@echo "🚀 Setting up GCP resources..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make setup-gcp PROJECT_ID=your-project-id [BILLING_ACCOUNT_ID=your-billing-id]"; \
		exit 1; \
	fi
	@chmod +x scripts/setup-gcp.sh
	./scripts/setup-gcp.sh $(PROJECT_ID) $(REGION) $(DB_INSTANCE) $(DB_NAME) $(BILLING_ACCOUNT_ID) $(SKIP_SQL)

setup-firebase: check-firebase ## Setup Firebase hosting
	@echo "🔥 Setting up Firebase..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make setup-firebase PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@chmod +x scripts/setup-firebase.sh
	./scripts/setup-firebase.sh $(PROJECT_ID)

generate-secrets: ## Generate secret key for JWT
	@echo "🔑 Generating JWT secret key..."
	@echo "SECRET_KEY=$(shell openssl rand -hex 32)"
	@echo "Add this to your GitHub Secrets and .env file"

setup-sql: check-gcloud ## Setup only Cloud SQL (if skipped during initial setup)
	@echo "🗄️ Setting up Cloud SQL..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make setup-sql PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@chmod +x scripts/setup-gcp.sh
	./scripts/setup-gcp.sh $(PROJECT_ID) $(REGION) $(DB_INSTANCE) $(DB_NAME) "" false

change-db-password: check-gcloud ## Change Cloud SQL user password
	@echo "🔑 Changing Cloud SQL user password..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make change-db-password PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@echo "📋 Current project: $(PROJECT_ID)"
	@echo "📋 Database instance: $(DB_INSTANCE)"
	@echo "📋 Database user: insieme_user"
	@echo ""
	@read -s -p "Enter new password for insieme_user: " NEW_PASSWORD && \
	echo "" && \
	if [ -z "$$NEW_PASSWORD" ]; then \
		echo "❌ Password cannot be empty"; \
		exit 1; \
	fi && \
	gcloud sql users set-password insieme_user \
		--instance=$(DB_INSTANCE) \
		--password="$$NEW_PASSWORD" && \
	echo "✅ Password updated successfully" && \
	echo "" && \
	echo "📋 Updated DATABASE_URL:" && \
	SQL_CONNECTION_NAME=$$(gcloud sql instances describe $(DB_INSTANCE) --format="value(connectionName)" 2>/dev/null) && \
	echo "postgresql://insieme_user:$$NEW_PASSWORD@/insieme?host=/cloudsql/$$SQL_CONNECTION_NAME"

check-db-status: check-gcloud ## Check Cloud SQL instance status
	@echo "🔍 Checking Cloud SQL status..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make check-db-status PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@echo "📋 Instance details:"
	@gcloud sql instances describe $(DB_INSTANCE) --format="table(name,state,databaseVersion,region,tier)"
	@echo ""
	@echo "📋 Database users:"
	@gcloud sql users list --instance=$(DB_INSTANCE)
	@echo ""
	@echo "📋 Databases:"
	@gcloud sql databases list --instance=$(DB_INSTANCE)
	@echo ""
	@echo "📋 Connection name:"
	@gcloud sql instances describe $(DB_INSTANCE) --format="value(connectionName)"

connect-db: check-gcloud ## Get database connection command
	@echo "🔗 Database connection information..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make connect-db PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@echo "📋 To connect via Cloud SQL Proxy:"
	@echo "1. Install Cloud SQL Proxy:"
	@echo "   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64"
	@echo "   chmod +x cloud-sql-proxy"
	@echo ""
	@echo "2. Start the proxy:"
	@SQL_CONNECTION_NAME=$$(gcloud sql instances describe $(DB_INSTANCE) --format="value(connectionName)" 2>/dev/null) && \
	echo "   ./cloud-sql-proxy $$SQL_CONNECTION_NAME"
	@echo ""
	@echo "3. Connect with psql:"
	@echo "   psql \"host=127.0.0.1 port=5432 sslmode=disable dbname=insieme user=insieme_user\""

get-api-url: check-gcloud ## Get deployed API URL (after deployment)
	@echo "🔗 Getting API URL..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make get-api-url PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@echo "📋 Checking Cloud Run service..."
	@if gcloud run services describe insieme-api --region=$(REGION) &>/dev/null; then \
		API_URL=$$(gcloud run services describe insieme-api --region=$(REGION) --format="value(status.url)") && \
		echo "✅ API URL: $$API_URL" && \
		echo "" && \
		echo "📋 Add this to your GitHub Secrets:" && \
		echo "API_URL=$$API_URL"; \
	else \
		echo "❌ Cloud Run service 'insieme-api' not found in region $(REGION)"; \
		echo "Deploy your backend first with GitHub Actions or manually"; \
	fi

check-deployment-status: check-gcloud ## Check deployment status of all services
	@echo "🔍 Checking deployment status..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make check-deployment-status PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@echo "📋 Cloud Run services:"
	@gcloud run services list --region=$(REGION) || echo "No Cloud Run services found"
	@echo ""
	@echo "📋 Firebase hosting:"
	@firebase projects:list 2>/dev/null | grep $(PROJECT_ID) || echo "Firebase not configured"

fix-firebase: check-firebase ## Fix Firebase hosting setup issues
	@echo "🔧 Fixing Firebase hosting setup..."
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ PROJECT_ID is required. Usage: make fix-firebase PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@chmod +x scripts/fix-firebase.sh
	./scripts/fix-firebase.sh $(PROJECT_ID)

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

test-backend: ## Run backend tests
	@echo "🧪 Running backend tests..."
	cd backend && source venv/bin/activate && \
		pip install pytest pytest-asyncio httpx ruff mypy && \
		ruff check . && \
		mypy . --ignore-missing-imports && \
		pytest

test: test-frontend test-backend ## Run all tests

dev-frontend: ## Start frontend development server
	cd frontend && npm run dev

dev-backend: ## Start backend development server
	cd backend && source venv/bin/activate && uvicorn main:app --reload

clean: ## Clean up build artifacts and dependencies
	@echo "🧹 Cleaning up..."
	rm -rf frontend/node_modules frontend/.next frontend/out
	rm -rf backend/venv backend/__pycache__ backend/.pytest_cache
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

docker-build-backend: ## Build backend Docker image
	@echo "🐳 Building backend Docker image..."
	cd backend && docker build -t insieme-backend .

docker-run-backend: ## Run backend Docker container
	@echo "🐳 Running backend Docker container..."
	docker run -p 8000:8000 insieme-backend

# Environment validation
check-gcloud: ## Check if gcloud CLI is installed
	@which gcloud >/dev/null || (echo "❌ gcloud CLI not found. Please install Google Cloud SDK:" && \
		echo "   macOS: brew install google-cloud-sdk" && \
		echo "   Other: https://cloud.google.com/sdk/docs/install" && \
		exit 1)
	@echo "✅ gcloud CLI found"

check-billing: ## Check available billing accounts
	@echo "🔍 Checking billing accounts..."
	@gcloud beta billing accounts list --filter="open:true" || echo "No billing accounts found. Create one at: https://console.cloud.google.com/billing"

debug-billing: ## Debug billing account access (requires BILLING_ACCOUNT_ID)
	@echo "🔍 Debugging billing account access..."
	@if [ -z "$(BILLING_ACCOUNT_ID)" ]; then \
		echo "❌ BILLING_ACCOUNT_ID is required. Usage: make debug-billing BILLING_ACCOUNT_ID=your-billing-id"; \
		exit 1; \
	fi
	@echo "📋 Current user:"
	@gcloud auth list --filter=status:ACTIVE --format="value(account)"
	@echo ""
	@echo "📋 All available billing accounts:"
	@gcloud beta billing accounts list
	@echo ""
	@echo "📋 Trying to describe billing account $(BILLING_ACCOUNT_ID):"
	@gcloud beta billing accounts describe $(BILLING_ACCOUNT_ID) || echo "❌ Failed to access billing account"
	@echo ""
	@echo "📋 Testing billing API access:"
	@gcloud beta billing accounts list --filter="name:*$(BILLING_ACCOUNT_ID)*" || echo "❌ Cannot filter by this billing account ID"

check-auth: ## Check current authentication and permissions
	@echo "🔍 Checking authentication..."
	@echo "📋 Current user:"
	@gcloud auth list --filter=status:ACTIVE --format="value(account)"
	@echo ""
	@echo "📋 Current project:"
	@gcloud config get-value project
	@echo ""
	@echo "📋 Available projects:"
	@gcloud projects list --limit=10
	@echo ""
	@echo "📋 Your organization info:"
	@gcloud organizations list 2>/dev/null || echo "No organization access or none configured"

check-firebase: ## Check if firebase CLI is installed
	@which firebase >/dev/null || (echo "❌ firebase CLI not found. Install with:" && \
		echo "   npm install -g firebase-tools" && \
		exit 1)
	@echo "✅ firebase CLI found"

check-docker: ## Check if Docker is installed
	@which docker >/dev/null || (echo "❌ Docker not found. Please install Docker" && exit 1)
	@echo "✅ Docker found"

validate-env: check-gcloud check-firebase check-docker check-billing ## Validate required tools are installed