#!/bin/bash
# OrbitAI End-to-End Test Suite
# Tests the full user journey from registration to project management

API="${E2E_API_URL:-http://localhost:3002}"
CLIENT="${E2E_CLIENT_URL:-http://localhost:5173}"

# JSON parser helper using node (works in CI without python3)
jval() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);const v=$1;console.log(v===undefined||v===null?'':v)}catch{console.log('')}})"
}
PASS=0
FAIL=0
TOTAL=0

green() { echo -e "\033[32m✓ $1\033[0m"; }
red() { echo -e "\033[31m✗ $1\033[0m"; }

assert() {
  TOTAL=$((TOTAL + 1))
  if [ "$1" = "true" ]; then
    green "$2"
    PASS=$((PASS + 1))
  else
    red "$2 — got: $3"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================"
echo "  OrbitAI E2E Test Suite"
echo "============================================"
echo ""

# ─── INFRASTRUCTURE ───────────────────────────
echo "── Infrastructure ──"

HEALTH=$(curl -s $API/health)
STATUS=$(echo "$HEALTH" | jval "o.status" 2>/dev/null)
assert "$([ "$STATUS" = "ok" ] && echo true)" "Server health check" "$STATUS"

CLIENT_HTML=$(curl -s $CLIENT/)
TITLE=$(echo "$CLIENT_HTML" | grep -o "<title>[^<]*</title>")
assert "$(echo "$TITLE" | grep -q 'OrbitAI' && echo true)" "Client serves frontend" "$TITLE"

SWAGGER=$(curl -s -o /dev/null -w "%{http_code}" $API/api-docs/)
assert "$([ "$SWAGGER" = "200" ] && echo true)" "Swagger API docs available" "HTTP $SWAGGER"

# ─── AUTH FLOW ────────────────────────────────
echo ""
echo "── Authentication ──"

# Register
TIMESTAMP=$(date +%s)
EMAIL="e2e-${TIMESTAMP}@test.com"
REG=$(curl -s -X POST $API/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"password\":\"TestPass123@\"}")
REG_OK=$(echo "$REG" | jval "o.success===true?'True':'False'" 2>/dev/null)
TOKEN=$(echo "$REG" | jval "(o.data||{}).token" 2>/dev/null)
USER_ID=$(echo "$REG" | jval "((o.data||{}).user||{}).id" 2>/dev/null)
assert "$([ "$REG_OK" = "True" ] && echo true)" "User registration" "$REG_OK"

# Duplicate registration blocked
DUP=$(curl -s -X POST $API/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"password\":\"TestPass123@\"}")
DUP_OK=$(echo "$DUP" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$DUP_OK" = "False" ] && echo true)" "Duplicate registration blocked" "$DUP_OK"

# Login
LOGIN=$(curl -s -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123@\"}")
LOGIN_OK=$(echo "$LOGIN" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$LOGIN_OK" = "True" ] && echo true)" "User login" "$LOGIN_OK"

# Wrong password
BAD_LOGIN=$(curl -s -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass999@\"}")
BAD_OK=$(echo "$BAD_LOGIN" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$BAD_OK" = "False" ] && echo true)" "Wrong password rejected" "$BAD_OK"

# Profile
PROFILE=$(curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN")
PROFILE_NAME=$(echo "$PROFILE" | jval "((o.data||{}).user||{}).name" 2>/dev/null)
assert "$([ "$PROFILE_NAME" = "Test User" ] && echo true)" "Get user profile" "$PROFILE_NAME"

# ─── SECURITY GUARDS ─────────────────────────
echo ""
echo "── Security Guards ──"

# No token
NOAUTH=$(curl -s $API/api/project)
NOAUTH_OK=$(echo "$NOAUTH" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$NOAUTH_OK" = "False" ] && echo true)" "Unauthenticated request blocked" "$NOAUTH_OK"

# Invalid token
BADTOKEN=$(curl -s $API/api/project -H "Authorization: Bearer fake-token")
BADTOKEN_OK=$(echo "$BADTOKEN" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$BADTOKEN_OK" = "False" ] && echo true)" "Invalid token rejected" "$BADTOKEN_OK"

# Expired/malformed JWT
MALFORMED=$(curl -s $API/api/project -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoxfQ.invalid")
MALFORMED_OK=$(echo "$MALFORMED" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$MALFORMED_OK" = "False" ] && echo true)" "Malformed JWT rejected" "$MALFORMED_OK"

# ─── INPUT VALIDATION ─────────────────────────
echo ""
echo "── Input Validation ──"

# Short password
SHORT_PW=$(curl -s -X POST $API/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bad","email":"bad@test.com","password":"ab"}')
SHORT_OK=$(echo "$SHORT_PW" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$SHORT_OK" = "False" ] && echo true)" "Short password rejected" "$SHORT_OK"

# Invalid email
BAD_EMAIL=$(curl -s -X POST $API/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bad","email":"not-an-email","password":"TestPass123@"}')
BAD_EMAIL_OK=$(echo "$BAD_EMAIL" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$BAD_EMAIL_OK" = "False" ] && echo true)" "Invalid email rejected" "$BAD_EMAIL_OK"

# Missing required fields
NO_NAME=$(curl -s -X POST $API/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"missing@test.com","password":"TestPass123@"}')
NO_NAME_OK=$(echo "$NO_NAME" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$NO_NAME_OK" = "False" ] && echo true)" "Missing name rejected" "$NO_NAME_OK"

# Invalid methodology
BAD_METHOD=$(curl -s -X POST $API/api/project \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","methodology":"invalid"}')
BAD_METHOD_OK=$(echo "$BAD_METHOD" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$BAD_METHOD_OK" = "False" ] && echo true)" "Invalid methodology rejected" "$BAD_METHOD_OK"

# ─── PROJECT CRUD ─────────────────────────────
echo ""
echo "── Project CRUD ──"

# Create
CREATE=$(curl -s -X POST $API/api/project \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"E2E Test Project","description":"Automated test","methodology":"Agile"}')
CREATE_OK=$(echo "$CREATE" | jval "o.success===true?'True':'False'" 2>/dev/null)
PID=$(echo "$CREATE" | jval "((o.data||{}).project||{})._id" 2>/dev/null)
assert "$([ "$CREATE_OK" = "True" ] && echo true)" "Create project" "$CREATE_OK"

# Read
READ=$(curl -s "$API/api/project/$PID" -H "Authorization: Bearer $TOKEN")
READ_NAME=$(echo "$READ" | jval "((o.data||{}).project||{}).name" 2>/dev/null)
assert "$([ "$READ_NAME" = "E2E Test Project" ] && echo true)" "Read project by ID" "$READ_NAME"

# List
LIST=$(curl -s "$API/api/project" -H "Authorization: Bearer $TOKEN")
LIST_COUNT=$(echo "$LIST" | jval "((o.data||{}).projects||[]).length" 2>/dev/null)
assert "$([ "$LIST_COUNT" -ge 1 ] && echo true)" "List projects (count >= 1)" "$LIST_COUNT"

# Update
UPDATE=$(curl -s -X PUT "$API/api/project/$PID" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated E2E Project"}')
UPDATE_OK=$(echo "$UPDATE" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$UPDATE_OK" = "True" ] && echo true)" "Update project" "$UPDATE_OK"

# Verify update
VERIFY=$(curl -s "$API/api/project/$PID" -H "Authorization: Bearer $TOKEN")
VERIFY_NAME=$(echo "$VERIFY" | jval "((o.data||{}).project||{}).name" 2>/dev/null)
assert "$([ "$VERIFY_NAME" = "Updated E2E Project" ] && echo true)" "Verify update persisted" "$VERIFY_NAME"

# Create second project
CREATE2=$(curl -s -X POST $API/api/project \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Second Project","description":"Another one","methodology":"Scrum"}')
PID2=$(echo "$CREATE2" | jval "((o.data||{}).project||{})._id" 2>/dev/null)
LIST2=$(curl -s "$API/api/project" -H "Authorization: Bearer $TOKEN")
LIST2_COUNT=$(echo "$LIST2" | jval "((o.data||{}).projects||[]).length" 2>/dev/null)
assert "$([ "$LIST2_COUNT" -ge 2 ] && echo true)" "Multiple projects listed" "$LIST2_COUNT"

# Delete
DELETE=$(curl -s -X DELETE "$API/api/project/$PID" -H "Authorization: Bearer $TOKEN")
DELETE_OK=$(echo "$DELETE" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$DELETE_OK" = "True" ] && echo true)" "Delete project" "$DELETE_OK"

# Verify deletion
AFTER_DEL=$(curl -s "$API/api/project" -H "Authorization: Bearer $TOKEN")
AFTER_COUNT=$(echo "$AFTER_DEL" | jval "((o.data||{}).projects||[]).length" 2>/dev/null)
assert "$([ "$AFTER_COUNT" -lt "$LIST2_COUNT" ] && echo true)" "Project deleted from list" "before=$LIST2_COUNT after=$AFTER_COUNT"

# Clean up second project
curl -s -X DELETE "$API/api/project/$PID2" -H "Authorization: Bearer $TOKEN" > /dev/null

# ─── PUBLIC ENDPOINTS ─────────────────────────
echo ""
echo "── Public Endpoints (No Auth) ──"

PUB_PKG=$(curl -s $API/api/publicPackages)
PUB_PKG_OK=$(echo "$PUB_PKG" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$PUB_PKG_OK" = "True" ] && echo true)" "Public packages endpoint" "$PUB_PKG_OK"

PUB_PAGE=$(curl -s $API/api/publicPageContent/homepage)
PUB_PAGE_OK=$(echo "$PUB_PAGE" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$PUB_PAGE_OK" = "True" ] && echo true)" "Public page content" "$PUB_PAGE_OK"

# ─── USER FEATURES ────────────────────────────
echo ""
echo "── User Features ──"

SETTINGS=$(curl -s "$API/api/userSettings" -H "Authorization: Bearer $TOKEN")
SETTINGS_OK=$(echo "$SETTINGS" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$SETTINGS_OK" = "True" ] && echo true)" "User settings" "$SETTINGS_OK"

CONVOS=$(curl -s "$API/api/chat/conversations" -H "Authorization: Bearer $TOKEN")
CONVOS_OK=$(echo "$CONVOS" | jval "o.success===true?'True':'False'" 2>/dev/null)
assert "$([ "$CONVOS_OK" = "True" ] && echo true)" "Chat conversations list" "$CONVOS_OK"

# ─── FRONTEND ROUTES ──────────────────────────
echo ""
echo "── Frontend Routes ──"

for ROUTE in "/" "/login" "/register" "/dashboard"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLIENT$ROUTE")
  assert "$([ "$CODE" = "200" ] && echo true)" "Frontend route $ROUTE" "HTTP $CODE"
done

# ─── RESULTS ──────────────────────────────────
echo ""
echo "============================================"
echo "  Results: $PASS passed / $FAIL failed / $TOTAL total"
echo "============================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
