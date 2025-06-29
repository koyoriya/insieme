#!/bin/bash

# GCP Setup Script for Insieme
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_ID=${1:-"insieme-app"}
REGION=${2:-"asia-northeast1"}
DB_INSTANCE=${3:-"insieme-db"}
DB_NAME=${4:-"insieme"}
BILLING_ACCOUNT_ID=${5:-""}
SKIP_SQL=${6:-"false"}
ARTIFACT_REPO="insieme"
SERVICE_ACCOUNT="github-actions"

echo -e "${BLUE}🚀 Setting up GCP resources for Insieme${NC}"
echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install Google Cloud SDK first.${NC}"
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo -e "${YELLOW}⚠️  Not logged in to gcloud. Please login first.${NC}"
    gcloud auth login
fi

# Check if user has proper permissions
CURRENT_USER=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
echo -e "${BLUE}Current user: ${CURRENT_USER}${NC}"

echo -e "${YELLOW}📋 Creating/configuring GCP project...${NC}"

# Create project (will fail if already exists, but that's ok)
gcloud projects create ${PROJECT_ID} --name="Insieme App" 2>/dev/null || echo -e "${YELLOW}Project ${PROJECT_ID} already exists${NC}"

# Set the project
gcloud config set project ${PROJECT_ID}

# Setup billing
echo -e "${YELLOW}💳 Setting up billing...${NC}"

# Check if project already has billing enabled
BILLING_ENABLED=$(gcloud beta billing projects describe ${PROJECT_ID} --format="value(billingEnabled)" 2>/dev/null || echo "false")

if [ "$BILLING_ENABLED" = "true" ]; then
    echo -e "${GREEN}✅ Billing already enabled for project${NC}"
else
    echo -e "${YELLOW}🔍 Available billing accounts:${NC}"
    gcloud beta billing accounts list --filter="open:true"
    echo ""
    
    # If billing account ID was provided as argument, use it
    if [ -n "$BILLING_ACCOUNT_ID" ]; then
        echo -e "${YELLOW}Using provided billing account: ${BILLING_ACCOUNT_ID}${NC}"
    else
        # Prompt for billing account ID
        echo -e "${YELLOW}Please enter your billing account ID from the list above:${NC}"
        echo -e "${YELLOW}(Format: XXXXXX-XXXXXX-XXXXXX)${NC}"
        read -p "Billing Account ID: " BILLING_ACCOUNT_ID
        
        if [ -z "$BILLING_ACCOUNT_ID" ]; then
            echo -e "${RED}❌ Billing account ID is required${NC}"
            exit 1
        fi
    fi
    
    # Validate billing account exists and is active
    echo -e "${YELLOW}🔍 Validating billing account ${BILLING_ACCOUNT_ID}...${NC}"
    
    # Debug: Show current user
    CURRENT_USER=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
    echo -e "${BLUE}Current authenticated user: ${CURRENT_USER}${NC}"
    
    # Debug: List available billing accounts first
    echo -e "${YELLOW}Available billing accounts for ${CURRENT_USER}:${NC}"
    gcloud beta billing accounts list 2>&1
    echo ""
    
    # First check if the account exists at all
    echo -e "${YELLOW}Attempting to describe billing account ${BILLING_ACCOUNT_ID}...${NC}"
    BILLING_ACCOUNT_INFO=$(gcloud beta billing accounts describe ${BILLING_ACCOUNT_ID} 2>&1)
    BILLING_DESCRIBE_EXIT_CODE=$?
    
    echo -e "${YELLOW}Command exit code: ${BILLING_DESCRIBE_EXIT_CODE}${NC}"
    echo -e "${YELLOW}Full output:${NC}"
    echo "$BILLING_ACCOUNT_INFO"
    echo ""
    
    if [ $BILLING_DESCRIBE_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}❌ Cannot access billing account ${BILLING_ACCOUNT_ID}${NC}"
        echo ""
        echo -e "${YELLOW}Possible causes:${NC}"
        echo -e "${YELLOW}1. Billing account ID format issue (should be: XXXXXX-XXXXXX-XXXXXX)${NC}"
        echo -e "${YELLOW}2. No permission to access this billing account${NC}"
        echo -e "${YELLOW}3. Billing account doesn't exist or is in a different organization${NC}"
        echo -e "${YELLOW}4. You need 'Billing Account User' or 'Billing Account Administrator' role${NC}"
        echo ""
        echo -e "${YELLOW}Please verify:${NC}"
        echo -e "${YELLOW}- Check the billing account ID in: https://console.cloud.google.com/billing${NC}"
        echo -e "${YELLOW}- Ensure you have the correct permissions${NC}"
        echo -e "${YELLOW}- Try a different billing account from the list above${NC}"
        exit 1
    fi
    
    # Check if the account is open/active
    BILLING_OPEN=$(echo "$BILLING_ACCOUNT_INFO" | grep "open:" | awk '{print $2}')
    echo -e "${YELLOW}Billing account status: ${BILLING_OPEN}${NC}"
    
    if [ "$BILLING_OPEN" != "true" ]; then
        echo -e "${RED}❌ Billing account ${BILLING_ACCOUNT_ID} is not active${NC}"
        echo -e "${YELLOW}Please activate the billing account in GCP Console${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Billing account validated successfully${NC}"
    
    echo -e "${YELLOW}Linking billing account ${BILLING_ACCOUNT_ID} to project ${PROJECT_ID}...${NC}"
    if gcloud beta billing projects link ${PROJECT_ID} --billing-account=${BILLING_ACCOUNT_ID}; then
        echo -e "${GREEN}✅ Billing account linked successfully${NC}"
    else
        echo -e "${RED}❌ Failed to link billing account${NC}"
        echo -e "${YELLOW}Please check your permissions and try again${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}🔌 Enabling required APIs...${NC}"

# Enable required APIs
echo -e "${YELLOW}Enabling Cloud Build API...${NC}"
gcloud services enable cloudbuild.googleapis.com

echo -e "${YELLOW}Enabling Cloud Run API...${NC}"
gcloud services enable run.googleapis.com

echo -e "${YELLOW}Enabling Artifact Registry API...${NC}"
gcloud services enable artifactregistry.googleapis.com

echo -e "${YELLOW}Enabling Cloud SQL Admin API...${NC}"
gcloud services enable sqladmin.googleapis.com

# Try to enable Vertex AI API (may not be available in all regions/accounts)
echo -e "${YELLOW}Enabling Vertex AI API...${NC}"
if ! gcloud services enable aiplatform.googleapis.com 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Vertex AI API not available or permission denied. Skipping...${NC}"
    echo -e "${YELLOW}   You can enable it manually later if needed.${NC}"
fi

echo -e "${YELLOW}📦 Creating Artifact Registry repository...${NC}"

# Create Artifact Registry repository
if ! gcloud artifacts repositories describe ${ARTIFACT_REPO} --location=${REGION} &> /dev/null; then
    gcloud artifacts repositories create ${ARTIFACT_REPO} \
        --repository-format=docker \
        --location=${REGION} \
        --description="Docker repository for Insieme app"
    echo -e "${GREEN}✅ Artifact Registry repository created${NC}"
else
    echo -e "${YELLOW}Artifact Registry repository already exists${NC}"
fi

echo -e "${YELLOW}👤 Creating service account...${NC}"

# Create service account
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} &> /dev/null; then
    echo -e "${YELLOW}Creating service account: ${SERVICE_ACCOUNT_EMAIL}${NC}"
    if gcloud iam service-accounts create ${SERVICE_ACCOUNT} \
        --display-name="GitHub Actions Service Account" \
        --description="Service account for GitHub Actions CI/CD"; then
        echo -e "${GREEN}✅ Service account created${NC}"
        
        # Wait a moment for the service account to be fully created
        echo -e "${YELLOW}⏳ Waiting for service account to be ready...${NC}"
        sleep 3
    else
        echo -e "${RED}❌ Failed to create service account${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Service account already exists${NC}"
fi

echo -e "${YELLOW}🔑 Assigning IAM roles...${NC}"

# Verify service account exists before assigning roles
if ! gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} &> /dev/null; then
    echo -e "${RED}❌ Service account ${SERVICE_ACCOUNT_EMAIL} not found${NC}"
    exit 1
fi

# Assign necessary roles with error handling
echo -e "${YELLOW}Assigning Cloud Run Admin role...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/run.admin"

echo -e "${YELLOW}Assigning Artifact Registry Writer role...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/artifactregistry.writer"

echo -e "${YELLOW}Assigning Cloud SQL Client role...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/cloudsql.client"

echo -e "${YELLOW}Assigning Service Account User role...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

echo -e "${GREEN}✅ IAM roles assigned successfully${NC}"

echo -e "${YELLOW}📄 Creating service account key...${NC}"

# Create service account key
if [ ! -f "gcp-service-account-key.json" ]; then
    echo -e "${YELLOW}Creating service account key...${NC}"
    if gcloud iam service-accounts keys create gcp-service-account-key.json \
        --iam-account=${SERVICE_ACCOUNT_EMAIL}; then
        echo -e "${GREEN}✅ Service account key created: gcp-service-account-key.json${NC}"
        
        # Set appropriate permissions for the key file
        chmod 600 gcp-service-account-key.json
        echo -e "${GREEN}✅ Key file permissions set to 600${NC}"
    else
        echo -e "${RED}❌ Failed to create service account key${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Service account key already exists${NC}"
fi

echo -e "${YELLOW}🗄️  Creating Cloud SQL instance...${NC}"

# Check if we should skip SQL instance creation
if [ "$SKIP_SQL" = "true" ]; then
    echo -e "${YELLOW}⏭️  Skipping Cloud SQL instance creation (SKIP_SQL=true)${NC}"
    echo -e "${YELLOW}You can create it later manually or run the script again without SKIP_SQL${NC}"
elif ! gcloud sql instances describe ${DB_INSTANCE} &> /dev/null; then
    echo -e "${YELLOW}Creating PostgreSQL instance: ${DB_INSTANCE}${NC}"
    
    # Create PostgreSQL instance (binary log is only for MySQL)
    if gcloud sql instances create ${DB_INSTANCE} \
        --database-version=POSTGRES_15 \
        --region=${REGION} \
        --tier=db-f1-micro \
        --storage-size=10GB \
        --storage-type=SSD \
        --backup-start-time=03:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=04 \
        --maintenance-release-channel=production; then
        
        echo -e "${GREEN}✅ Cloud SQL instance created${NC}"
        
        # Wait for instance to be ready
        echo -e "${YELLOW}⏳ Waiting for instance to be ready (this can take 5-15 minutes)...${NC}"
        
        # Wait for the instance to be in RUNNABLE state with timeout
        WAIT_COUNT=0
        MAX_WAIT=90  # 15 minutes (90 * 10 seconds)
        
        while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
            INSTANCE_STATE=$(gcloud sql instances describe ${DB_INSTANCE} --format="value(state)" 2>/dev/null)
            
            if [ "$INSTANCE_STATE" = "RUNNABLE" ]; then
                echo -e "${GREEN}✅ Instance is ready${NC}"
                break
            fi
            
            WAIT_COUNT=$((WAIT_COUNT + 1))
            ELAPSED_TIME=$((WAIT_COUNT * 10))
            echo -e "${YELLOW}Instance state: ${INSTANCE_STATE}. Waiting... (${ELAPSED_TIME}s elapsed)${NC}"
            
            if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
                echo -e "${RED}❌ Timeout waiting for instance to be ready (15 minutes)${NC}"
                echo -e "${YELLOW}The instance might still be creating. Check status with:${NC}"
                echo -e "${YELLOW}gcloud sql instances describe ${DB_INSTANCE}${NC}"
                exit 1
            fi
            
            sleep 10
        done
    else
        echo -e "${RED}❌ Failed to create Cloud SQL instance${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Cloud SQL instance already exists${NC}"
fi

# Only create database and user if we didn't skip SQL creation
if [ "$SKIP_SQL" != "true" ]; then
    echo -e "${YELLOW}🗃️  Creating database...${NC}"

    # Create database
    if ! gcloud sql databases describe ${DB_NAME} --instance=${DB_INSTANCE} &> /dev/null; then
        gcloud sql databases create ${DB_NAME} --instance=${DB_INSTANCE}
        echo -e "${GREEN}✅ Database created${NC}"
    else
        echo -e "${YELLOW}Database already exists${NC}"
    fi

    echo -e "${YELLOW}👨‍💻 Setting up database user...${NC}"

    # Create database user with password
    DB_USER="insieme_user"
    if ! gcloud sql users describe ${DB_USER} --instance=${DB_INSTANCE} &> /dev/null; then
        echo -e "${YELLOW}Please set a password for the database user '${DB_USER}':${NC}"
        
        # Prompt for password securely
        read -s -p "Enter password for ${DB_USER}: " DB_PASSWORD
        echo ""
        
        if [ -z "$DB_PASSWORD" ]; then
            echo -e "${RED}❌ Password cannot be empty${NC}"
            exit 1
        fi
        
        # Create user with password
        if gcloud sql users create ${DB_USER} --instance=${DB_INSTANCE} --password="${DB_PASSWORD}"; then
            echo -e "${GREEN}✅ Database user created${NC}"
            
            # Clear the password from memory
            unset DB_PASSWORD
        else
            echo -e "${RED}❌ Failed to create database user${NC}"
            unset DB_PASSWORD
            exit 1
        fi
    else
        echo -e "${YELLOW}Database user already exists${NC}"
    fi
fi

# Get connection details
echo -e "${BLUE}📋 GCP Setup Complete!${NC}"
echo -e "${GREEN}✅ Project ID: ${PROJECT_ID}${NC}"
echo -e "${GREEN}✅ Region: ${REGION}${NC}"
echo -e "${GREEN}✅ Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}${NC}"

if [ "$SKIP_SQL" != "true" ]; then
    echo -e "${GREEN}✅ Cloud SQL Instance: ${DB_INSTANCE}${NC}"
    echo -e "${GREEN}✅ Database: ${DB_NAME}${NC}"
    echo -e "${GREEN}✅ Database User: ${DB_USER}${NC}"
fi

echo -e "${GREEN}✅ Service Account Key: gcp-service-account-key.json${NC}"

echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Add the following GitHub Secrets:"
echo -e "   - GCP_PROJECT_ID: ${PROJECT_ID}"
echo -e "   - GCP_SA_KEY: (content of gcp-service-account-key.json)"

if [ "$SKIP_SQL" != "true" ]; then
    # Get the Cloud SQL connection name
    SQL_CONNECTION_NAME=$(gcloud sql instances describe ${DB_INSTANCE} --format="value(connectionName)" 2>/dev/null)
    echo -e "   - DATABASE_URL: postgresql://${DB_USER}:YOUR_PASSWORD@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION_NAME}"
else
    echo -e "   - DATABASE_URL: (create after setting up Cloud SQL with: make setup-sql PROJECT_ID=${PROJECT_ID})"
fi

echo -e "   - SECRET_KEY: (run 'make generate-secrets' to generate)"
echo -e "\n2. Set up Firebase hosting with: make setup-firebase PROJECT_ID=${PROJECT_ID}"
echo -e "\n3. Keep gcp-service-account-key.json secure and never commit it to version control!"

if [ "$SKIP_SQL" = "true" ]; then
    echo -e "\n${YELLOW}⚠️  Cloud SQL was skipped. Run 'make setup-sql PROJECT_ID=${PROJECT_ID}' when ready.${NC}"
fi

# Add to gitignore if not already there
if ! grep -q "gcp-service-account-key.json" .gitignore 2>/dev/null; then
    echo -e "\n# GCP Service Account Key\ngcp-service-account-key.json" >> .gitignore
    echo -e "${GREEN}✅ Added service account key to .gitignore${NC}"
fi