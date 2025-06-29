#!/bin/bash

# Firebase Hosting Fix Script
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID=${1:-"insieme-463312"}

echo -e "${BLUE}🔧 Fixing Firebase Hosting setup for ${PROJECT_ID}${NC}"

echo -e "${YELLOW}📋 Step 1: Manual Firebase Console Setup Required${NC}"
echo -e "${YELLOW}Please follow these steps manually:${NC}"
echo ""
echo -e "${YELLOW}1. Open Firebase Console:${NC}"
echo -e "   https://console.firebase.google.com/project/${PROJECT_ID}"
echo ""
echo -e "${YELLOW}2. Navigate to Hosting:${NC}"
echo -e "   - Click 'Hosting' in the left sidebar"
echo -e "   - Click 'Get started'"
echo ""
echo -e "${YELLOW}3. Initialize Hosting:${NC}"
echo -e "   - Follow the setup wizard"
echo -e "   - When asked for site ID, use: ${PROJECT_ID}-web"
echo -e "   - Complete the setup"
echo ""
read -p "Press Enter after completing the Firebase Console setup..."

echo -e "${YELLOW}📋 Step 2: Verifying Firebase setup...${NC}"

# Check if we can list sites now
if firebase hosting:sites:list --project ${PROJECT_ID}; then
    echo -e "${GREEN}✅ Firebase Hosting sites found${NC}"
else
    echo -e "${RED}❌ Still no sites found. Please ensure you completed the console setup.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Step 3: Creating firebase.json with default site...${NC}"

cd frontend

# Get the first available site
SITE_ID=$(firebase hosting:sites:list --project ${PROJECT_ID} --json | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4 | cut -d'/' -f4)

if [ -z "$SITE_ID" ]; then
    echo -e "${RED}❌ Could not determine site ID${NC}"
    exit 1
fi

echo -e "${GREEN}Using site ID: ${SITE_ID}${NC}"

# Create firebase.json with specific site
cat > firebase.json << EOF
{
  "hosting": {
    "site": "${SITE_ID}",
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

echo -e "${GREEN}✅ firebase.json updated with site ID: ${SITE_ID}${NC}"

echo -e "${YELLOW}📋 Step 4: Testing deployment...${NC}"

# Build and deploy
npm run build

if [ ! -d "out" ]; then
    echo -e "${RED}❌ Build output directory 'out' not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Deploying to Firebase Hosting...${NC}"
firebase deploy --only hosting --project ${PROJECT_ID}

echo -e "${GREEN}🎉 Firebase Hosting setup complete!${NC}"
echo -e "${GREEN}Your site URL: https://${SITE_ID}.web.app${NC}"

cd ..
echo -e "${YELLOW}📋 Don't forget to update your GitHub Secrets if needed.${NC}"