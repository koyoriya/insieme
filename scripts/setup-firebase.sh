#!/bin/bash

# Firebase Setup Script for Insieme
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID=${1:-"insieme-app"}

echo -e "${BLUE}🔥 Setting up Firebase for Insieme${NC}"
echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI is not installed.${NC}"
    echo -e "${YELLOW}Installing Firebase CLI...${NC}"
    npm install -g firebase-tools
fi

echo -e "${YELLOW}🔌 Enabling Firebase APIs...${NC}"

# Enable Firebase APIs in GCP
gcloud services enable firebase.googleapis.com
gcloud services enable firebasehosting.googleapis.com

echo -e "${YELLOW}🔑 Authenticating with Firebase...${NC}"

# Login to Firebase
firebase login --no-localhost

echo -e "${YELLOW}📁 Initializing Firebase project...${NC}"

# Check if Firebase project has hosting enabled
echo -e "${YELLOW}🔍 Checking Firebase Hosting configuration...${NC}"

# First, try to list existing sites
EXISTING_SITES=$(firebase hosting:sites:list --project ${PROJECT_ID} 2>/dev/null || echo "")

if [ -z "$EXISTING_SITES" ] || ! echo "$EXISTING_SITES" | grep -q "${PROJECT_ID}"; then
    echo -e "${YELLOW}📋 No hosting sites found. Creating Firebase Hosting site...${NC}"
    
    # Try to create a site
    if firebase hosting:sites:create ${PROJECT_ID} --project ${PROJECT_ID} 2>/dev/null; then
        echo -e "${GREEN}✅ Firebase Hosting site created${NC}"
    else
        echo -e "${YELLOW}⚠️  Automatic site creation failed. You may need to:${NC}"
        echo -e "${YELLOW}1. Visit https://console.firebase.google.com/project/${PROJECT_ID}/hosting${NC}"
        echo -e "${YELLOW}2. Click 'Get started' to enable Firebase Hosting${NC}"
        echo -e "${YELLOW}3. Or run: firebase hosting:sites:create ${PROJECT_ID} --project ${PROJECT_ID}${NC}"
        echo -e "${YELLOW}Continuing with configuration...${NC}"
    fi
else
    echo -e "${GREEN}✅ Firebase Hosting sites already configured${NC}"
fi

# Change to frontend directory
cd frontend

# Initialize Firebase with non-interactive setup
echo -e "${YELLOW}📁 Setting up Firebase configuration...${NC}"

# Create .firebaserc file
cat > .firebaserc << EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF

# Create firebase.json manually (instead of firebase init)
echo -e "${YELLOW}📋 Creating firebase.json configuration...${NC}"

# Update firebase.json to work with Next.js static export
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
EOF

# Update Next.js config for static export
if [ ! -f next.config.js ]; then
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
EOF
    echo -e "${GREEN}✅ Created next.config.js for static export${NC}"
fi

# Create .firebaserc file
cat > .firebaserc << EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF

echo -e "${YELLOW}🚀 Testing Firebase deployment...${NC}"

# Build the project
echo -e "${YELLOW}Building Next.js project...${NC}"
npm run build

# Check if out directory exists
if [ ! -d "out" ]; then
    echo -e "${RED}❌ Build output directory 'out' not found${NC}"
    echo -e "${YELLOW}Checking build output...${NC}"
    ls -la
    echo -e "${YELLOW}Make sure next.config.js has 'output: export' configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"
echo -e "${YELLOW}Build output:${NC}"
ls -la out/

# Test deployment
echo -e "${YELLOW}Deploying to Firebase Hosting...${NC}"
firebase deploy --only hosting

echo -e "${YELLOW}🔑 Generating CI token...${NC}"

# Generate CI token for GitHub Actions
echo -e "${BLUE}Generating Firebase CI token...${NC}"
echo -e "${YELLOW}Please save this token for GitHub Secrets (FIREBASE_TOKEN):${NC}"
firebase login:ci

# Go back to root directory
cd ..

echo -e "${BLUE}🔥 Firebase Setup Complete!${NC}"
echo -e "${GREEN}✅ Project ID: ${PROJECT_ID}${NC}"
echo -e "${GREEN}✅ Hosting URL: https://${PROJECT_ID}.web.app${NC}"
echo -e "${GREEN}✅ Firebase configuration created${NC}"

echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Add the Firebase CI token to GitHub Secrets as FIREBASE_TOKEN"
echo -e "2. Your app will be automatically deployed when you push to main branch"
echo -e "3. Visit https://console.firebase.google.com/project/${PROJECT_ID}/hosting to manage your hosting"

echo -e "\n${YELLOW}📋 GitHub Secrets to add:${NC}"
echo -e "- FIREBASE_TOKEN: (the token generated above)"
echo -e "- API_URL: (your backend API URL after deployment)"

echo -e "\n${GREEN}🎉 Firebase setup completed successfully!${NC}"