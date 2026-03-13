#!/bin/bash

# OrbitAI Integration Verification Script
# Run this to verify all new features are properly integrated

echo "🔍 OrbitAI Integration Verification"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PASS=0
FAIL=0

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        ((PASS++))
    else
        echo -e "${RED}❌${NC} $1 ${RED}(MISSING)${NC}"
        ((FAIL++))
    fi
}

# Function to check if directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $1/"
        ((PASS++))
    else
        echo -e "${RED}❌${NC} $1/ ${RED}(MISSING)${NC}"
        ((FAIL++))
    fi
}

echo "1. Checking Backend Files..."
echo "-----------------------------"
check_file "server/src/models/Workspace.model.ts"
check_file "server/src/models/WorkspaceInvite.model.ts"
check_file "server/src/models/Comment.model.ts"
check_file "server/src/models/Notification.model.ts"
check_file "server/src/models/TimeEntry.model.ts"
check_file "server/src/routes/workspace.routes.ts"
check_file "server/src/routes/invitation.routes.ts"
check_file "server/src/routes/comment.routes.ts"
check_file "server/src/routes/notification.routes.ts"
check_file "server/src/routes/time-tracking.routes.ts"
check_file "server/src/routes/github-repo.routes.ts"
check_file "server/src/services/github.service.ts"
check_file "server/src/utils/routeLoader.ts"
echo ""

echo "2. Checking Frontend Files..."
echo "-----------------------------"
check_file "client/src/components/workspace/WorkspaceSelector.tsx"
check_file "client/src/components/workspace/WorkspaceSettings.tsx"
check_file "client/src/components/comments/CommentThread.tsx"
check_file "client/src/components/notifications/NotificationCenter.tsx"
check_file "client/src/components/time-tracking/TimerWidget.tsx"
check_file "client/src/components/chat/ChatInput.tsx"
check_file "client/src/components/project/ProjectDashboard.tsx"
check_file "client/src/components/integrations/IntegrationDashboard.tsx"
check_file "client/src/hooks/useWorkspaces.ts"
check_file "client/src/hooks/useComments.ts"
check_file "client/src/hooks/useNotifications.ts"
check_file "client/src/hooks/useTimeTracking.ts"
check_file "client/src/contexts/WorkspaceContext.tsx"
check_file "client/src/utils/mentionParser.ts"
check_file "client/src/integration/index.tsx"
check_file "client/src/views/EnhancedWorkspaceView.tsx"
echo ""

echo "3. Checking Test Files..."
echo "-----------------------------"
check_dir "tests/e2e"
check_dir "tests/integration"
check_file "tests/e2e/auth/login.spec.ts"
check_file "tests/e2e/project/projects.spec.ts"
check_file "tests/e2e/chat/chat.spec.ts"
check_file "tests/e2e/workspace/workspace.spec.ts"
check_file "tests/e2e/comments/comments.spec.ts"
check_file "tests/e2e/notifications/notifications.spec.ts"
check_file "tests/e2e/time-tracking/time-tracking.spec.ts"
check_file "tests/integration/workspace.test.ts"
check_file "tests/integration/github.test.ts"
check_file "client/src/__tests__/mentionParser.test.ts"
check_file "client/src/__tests__/useWorkspaces.test.ts"
check_file "client/src/__tests__/useComments.test.ts"
check_file "client/src/__tests__/useNotifications.test.ts"
check_file "client/src/__tests__/useTimeTracking.test.ts"
check_file "playwright.config.ts"
check_file "jest.config.js"
echo ""

echo "4. Checking Infrastructure Files..."
echo "-----------------------------"
check_file "docker/Dockerfile"
check_file "docker/docker-compose.yml"
check_file "healthcheck.js"
check_file ".github/workflows/ci-cd.yml"
check_file "DEPLOYMENT.md"
check_file ".env.example"
echo ""

echo "5. Checking Documentation..."
echo "-----------------------------"
check_file "../OrbitAI-Integration-Guide.md"
check_file "../OrbitAI-Integration-Checklist.md"
check_file "../OrbitAI-Ultimate-Implementation-Report.md"
check_file "../OrbitAI-Final-Implementation-Report.md"
check_file "../OrbitAI-Maturity-Assessment-Updated.md"
echo ""

echo "6. Checking Integration Points..."
echo "-----------------------------"
# Check if routeLoader is imported in index.ts
if grep -q "loadRoutes" server/src/index.ts 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Backend routes loader imported"
    ((PASS++))
else
    echo -e "${RED}❌${NC} Backend routes loader not imported"
    ((FAIL++))
fi

# Check if EnhancedWorkspaceView is used
if grep -q "EnhancedWorkspaceView" client/src/components/AppRouter.tsx 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Enhanced workspace view integrated"
    ((PASS++))
else
    echo -e "${RED}❌${NC} Enhanced workspace view not integrated"
    ((FAIL++))
fi

# Check if WorkspaceProvider exists
if grep -q "WorkspaceProvider" client/src/views/EnhancedWorkspaceView.tsx 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Workspace context provider configured"
    ((PASS++))
else
    echo -e "${RED}❌${NC} Workspace context provider not configured"
    ((FAIL++))
fi
echo ""

echo "=================================="
echo "📊 Verification Results"
echo "=================================="
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. cd server && npm run dev  # Start backend"
    echo "2. cd client && npm run dev  # Start frontend"
    echo "3. Open http://localhost:5173"
    echo "4. Test the new features:"
    echo "   - Workspace selector in header"
    echo "   - Notification bell in header"
    echo "   - Timer widget (floating, bottom-right)"
    echo "   - Comments on project pages"
    echo "   - @mentions in chat"
    echo ""
    echo "5. Run E2E tests: npx playwright test"
    echo "6. Deploy to staging: cd docker && docker-compose up -d"
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED${NC}"
    echo ""
    echo "Please review the failed checks above and ensure all files are in place."
    exit 1
fi
