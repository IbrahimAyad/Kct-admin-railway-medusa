#!/bin/bash

# KCT Menswear Backend - Railway Deployment Script

echo "================================================"
echo "KCT Menswear Backend - Railway Deployment"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Railway CLI is not installed${NC}"
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo -e "${GREEN}✓ Railway CLI is installed${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "medusa-config.js" ]; then
    echo -e "${RED}Error: Not in the backend directory${NC}"
    echo "Please run this script from the backend directory"
    exit 1
fi

echo -e "${GREEN}✓ In correct backend directory${NC}"
echo ""

# Step-by-step deployment guide
echo -e "${YELLOW}DEPLOYMENT STEPS:${NC}"
echo ""
echo "1. First, login to Railway:"
echo "   ${GREEN}railway login${NC}"
echo ""
echo "2. Link to existing project or create new:"
echo "   For new project: ${GREEN}railway link${NC}"
echo "   Then select 'Create New Project'"
echo ""
echo "3. Add database services:"
echo "   ${GREEN}railway add${NC}"
echo "   Select PostgreSQL when prompted"
echo "   ${GREEN}railway add${NC}"
echo "   Select Redis when prompted"
echo ""
echo "4. Set environment variables:"
echo "   Open Railway dashboard in browser:"
echo "   ${GREEN}railway open${NC}"
echo ""
echo "   Go to Variables tab and add all variables from:"
echo "   ${YELLOW}railway-env-vars.txt${NC}"
echo ""
echo "5. Deploy the application:"
echo "   ${GREEN}railway up${NC}"
echo ""
echo "6. After deployment, run migrations:"
echo "   ${GREEN}railway run npm run migrate${NC}"
echo ""
echo "7. (Optional) Seed initial data:"
echo "   ${GREEN}railway run npm run seed${NC}"
echo ""
echo "8. View deployment logs:"
echo "   ${GREEN}railway logs${NC}"
echo ""
echo "================================================"
echo ""

# Interactive deployment
read -p "Do you want to start the deployment process now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Starting interactive deployment...${NC}"
    echo ""
    
    # Login to Railway
    echo "Step 1: Logging into Railway..."
    echo "This will open your browser for authentication"
    railway login
    
    echo ""
    echo -e "${GREEN}✓ Logged in successfully${NC}"
    echo ""
    
    # Link or create project
    echo "Step 2: Linking Railway project..."
    railway link
    
    echo ""
    echo -e "${GREEN}✓ Project linked${NC}"
    echo ""
    
    # Reminder about database services
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo "Now you need to:"
    echo "1. Add PostgreSQL and Redis services via Railway dashboard"
    echo "2. Set all environment variables from railway-env-vars.txt"
    echo "3. Then run: railway up"
    echo ""
    echo "Opening Railway dashboard..."
    railway open
    
else
    echo ""
    echo "Deployment cancelled. Run this script again when ready."
    echo "You can also manually follow the steps above."
fi

echo ""
echo "================================================"
echo "For support, check the deployment guide:"
echo "DEPLOYMENT_GUIDE.md"
echo "================================================"