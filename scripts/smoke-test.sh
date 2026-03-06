#!/usr/bin/env bash
# smoke-test.sh — End-to-end smoke suite for the incident command API
# Usage: ./scripts/smoke-test.sh
set -euo pipefail

# ── Colors & helpers ─────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0
SERVER_PID=""
SSE_PID=""
BASE_URL="http://localhost:3001"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$PROJECT_ROOT/incidents.db"

# ── Cleanup ──────────────────────────────────────────────
cleanup() {
  if [[ -n "$SSE_PID" ]] && kill -0 "$SSE_PID" 2>/dev/null; then
    kill "$SSE_PID" 2>/dev/null || true
    wait "$SSE_PID" 2>/dev/null || true
  fi
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Check helpers ────────────────────────────────────────
check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  if [[ "$actual" == "$expected" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "${GREEN}  PASS${NC} [%02d] %s (expected=%s, got=%s)\n" "$TOTAL_COUNT" "$name" "$expected" "$actual"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "${RED}  FAIL${NC} [%02d] %s (expected=%s, got=%s)\n" "$TOTAL_COUNT" "$name" "$expected" "$actual"
  fi
}

check_contains() {
  local name="$1"
  local needle="$2"
  local haystack="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  if echo "$haystack" | grep -q "$needle"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "${GREEN}  PASS${NC} [%02d] %s (contains '%s')\n" "$TOTAL_COUNT" "$name" "$needle"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "${RED}  FAIL${NC} [%02d] %s (missing '%s' in response)\n" "$TOTAL_COUNT" "$name" "$needle"
  fi
}

check_not_null() {
  local name="$1"
  local value="$2"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  if [[ -n "$value" && "$value" != "null" && "$value" != "" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "${GREEN}  PASS${NC} [%02d] %s (value=%s)\n" "$TOTAL_COUNT" "$name" "$value"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "${RED}  FAIL${NC} [%02d] %s (value was null or empty)\n" "$TOTAL_COUNT" "$name"
  fi
}

# ── JSON extraction (portable, no jq dependency) ─────────
json_val() {
  # Extract a top-level string/number value from JSON by key
  local key="$1"
  local json="$2"
  echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key',''))" 2>/dev/null
}

json_nested() {
  # Extract nested value via dot path: e.g. "incident.id"
  local path="$1"
  local json="$2"
  echo "$json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
keys = '$path'.split('.')
for k in keys:
    if isinstance(d, dict):
        d = d.get(k, '')
    elif isinstance(d, list) and k.isdigit():
        d = d[int(k)] if int(k) < len(d) else ''
    else:
        d = ''
print(d if d is not None else 'null')
" 2>/dev/null
}

# ── Start ────────────────────────────────────────────────
printf "\n${BOLD}${CYAN}=== Incident Command Smoke Test ===${NC}\n\n"

# ── 0. Clean DB ─────────────────────────────────────────
printf "${YELLOW}Cleaning database...${NC}\n"
rm -f "$DB_PATH"

# ── 1. Start server ─────────────────────────────────────
printf "${YELLOW}Starting server...${NC}\n"
cd "$PROJECT_ROOT/server"
PORT=3001 npx tsx src/index.ts > /tmp/smoke-server.log 2>&1 &
SERVER_PID=$!
cd "$PROJECT_ROOT"

# Wait for health check
printf "${YELLOW}Waiting for server health...${NC}"
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    printf " ${GREEN}ready${NC} (${i}s)\n\n"
    break
  fi
  if [[ $i -eq 30 ]]; then
    printf " ${RED}TIMEOUT${NC}\n"
    echo "Server failed to start. Log:"
    cat /tmp/smoke-server.log
    exit 1
  fi
  printf "."
  sleep 1
done

# ═══════════════════════════════════════════════════════════
# SECTION 1: Authentication
# ═══════════════════════════════════════════════════════════
printf "${BOLD}--- Auth ---${NC}\n"

# Login reporter1
REPORTER_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"reporter1","password":"pass123"}')
REPORTER_TOKEN=$(json_val "token" "$REPORTER_RESP")
check "Login reporter1" "reporter1" "$(json_nested 'user.username' "$REPORTER_RESP")"

# Login coord1
COORD_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"coord1","password":"pass123"}')
COORD_TOKEN=$(json_val "token" "$COORD_RESP")
check "Login coord1" "coord1" "$(json_nested 'user.username' "$COORD_RESP")"

# Login resp1
RESP_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"resp1","password":"pass123"}')
RESP_TOKEN=$(json_val "token" "$RESP_RESP")
check "Login resp1" "resp1" "$(json_nested 'user.username' "$RESP_RESP")"

# ═══════════════════════════════════════════════════════════
# SECTION 2: Incident Lifecycle (Happy Path)
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- Lifecycle ---${NC}\n"

# Create incident as reporter
CREATE_RESP=$(curl -sf -X POST "$BASE_URL/api/incidents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REPORTER_TOKEN" \
  -d '{"title":"Flood on EDSA","description":"Heavy flooding near Guadalupe","latitude":14.5995,"longitude":120.9842}')
INCIDENT_ID=$(json_nested "incident.id" "$CREATE_RESP")
check "Create incident (status=PING)" "PING" "$(json_nested 'incident.status' "$CREATE_RESP")"

# Verify as coordinator (version=1)
VERIFY_RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$INCIDENT_ID/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":1}')
check "Verify incident (status=VERIFIED)" "VERIFIED" "$(json_nested 'incident.status' "$VERIFY_RESP")"

# Prioritize as coordinator (version=2, priority=85)
PRIO_RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$INCIDENT_ID/prioritize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":2,"priority":85}')
check "Prioritize incident (priority=85)" "PRIORITIZED" "$(json_nested 'incident.status' "$PRIO_RESP")"

# Assign to resp1 as coordinator (version=3)
ASSIGN_RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$INCIDENT_ID/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":3,"responderId":"user-resp-01"}')
check "Assign incident to resp1 (status=ASSIGNED)" "ASSIGNED" "$(json_nested 'incident.status' "$ASSIGN_RESP")"

# Resolve as responder (version=4)
RESOLVE_RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$INCIDENT_ID/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RESP_TOKEN" \
  -d '{"version":4,"note":"Water receded, road clear"}')
check "Resolve incident (status=RESOLVED)" "RESOLVED" "$(json_nested 'incident.status' "$RESOLVE_RESP")"

# ═══════════════════════════════════════════════════════════
# SECTION 3: Role Rejection
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- Role Rejection ---${NC}\n"

# Create another incident for negative tests
CREATE2_RESP=$(curl -sf -X POST "$BASE_URL/api/incidents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REPORTER_TOKEN" \
  -d '{"title":"Landslide in Marikina","description":"Mudslide near river","latitude":14.6507,"longitude":121.1029}')
INCIDENT2_ID=$(json_nested "incident.id" "$CREATE2_RESP")

# Reporter tries to verify → 403
ROLE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/api/incidents/$INCIDENT2_ID/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REPORTER_TOKEN" \
  -d '{"version":1}')
check "Reporter verify → 403 forbidden" "403" "$ROLE_CODE"

# ═══════════════════════════════════════════════════════════
# SECTION 4: Version Conflict (409)
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- Version Conflict ---${NC}\n"

# Verify incident2 first (valid, version=1)
curl -sf -X PATCH "$BASE_URL/api/incidents/$INCIDENT2_ID/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":1}' > /dev/null

# Try to verify again with stale version=1 (now version=2) → 409
CONFLICT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/api/incidents/$INCIDENT2_ID/prioritize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":1,"priority":50}')
check "Stale version → 409 conflict" "409" "$CONFLICT_CODE"

# ═══════════════════════════════════════════════════════════
# SECTION 5: Invalid Transition (422)
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- Invalid Transition ---${NC}\n"

# Create another incident (PING state)
CREATE3_RESP=$(curl -sf -X POST "$BASE_URL/api/incidents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REPORTER_TOKEN" \
  -d '{"title":"Fire in Tondo","description":"Building fire","latitude":14.6042,"longitude":120.9667}')
INCIDENT3_ID=$(json_nested "incident.id" "$CREATE3_RESP")

# Try PING → ASSIGNED (invalid, must go PING → VERIFIED → PRIORITIZED → ASSIGNED) → 422
INVALID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/api/incidents/$INCIDENT3_ID/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":1,"responderId":"user-resp-01"}')
check "PING → ASSIGNED (invalid) → 422" "422" "$INVALID_CODE"

# ═══════════════════════════════════════════════════════════
# SECTION 6: Evac Centers
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- Evac Centers ---${NC}\n"

EVAC_RESP=$(curl -sf "$BASE_URL/api/evac-centers/nearest?lat=14.5995&lng=120.9842&limit=3")
EVAC_COUNT=$(echo "$EVAC_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('centers',[])))" 2>/dev/null)
check_not_null "Nearest evac centers returned" "$EVAC_COUNT"

EVAC_HAS_DISTANCE=$(echo "$EVAC_RESP" | python3 -c "
import sys, json
centers = json.load(sys.stdin).get('centers', [])
print('yes' if centers and 'distance_km' in centers[0] else 'no')
" 2>/dev/null)
check "Evac centers have distance_km" "yes" "$EVAC_HAS_DISTANCE"

# ═══════════════════════════════════════════════════════════
# SECTION 7: KPI Endpoint
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- KPI ---${NC}\n"

KPI_RESP=$(curl -sf "$BASE_URL/api/kpi" \
  -H "Authorization: Bearer $COORD_TOKEN")
KPI_TOTAL=$(json_val "total_incidents" "$KPI_RESP")
check_not_null "KPI total_incidents is non-null" "$KPI_TOTAL"

KPI_RATE=$(json_val "resolution_rate" "$KPI_RESP")
check_not_null "KPI resolution_rate is non-null" "$KPI_RATE"

# ═══════════════════════════════════════════════════════════
# SECTION 8: SSE Delivery
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}--- SSE ---${NC}\n"

SSE_OUTPUT="/tmp/smoke-sse-output.txt"
rm -f "$SSE_OUTPUT"

# Open SSE stream in background
curl -sN "$BASE_URL/api/events" > "$SSE_OUTPUT" 2>/dev/null &
SSE_PID=$!

# Give SSE connection time to establish
sleep 1

# Trigger an event by creating a new incident
CREATE_SSE_RESP=$(curl -sf -X POST "$BASE_URL/api/incidents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REPORTER_TOKEN" \
  -d '{"title":"SSE Test Incident","description":"Testing SSE delivery","latitude":14.5995,"longitude":120.9842}')

# Wait for SSE to receive the event
sleep 2

# Kill SSE curl
kill "$SSE_PID" 2>/dev/null || true
wait "$SSE_PID" 2>/dev/null || true
SSE_PID=""

SSE_CONTENT=$(cat "$SSE_OUTPUT" 2>/dev/null || echo "")
check_contains "SSE received incident_created event" "incident_created" "$SSE_CONTENT"
check_contains "SSE contains incident data" "SSE Test Incident" "$SSE_CONTENT"

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}${CYAN}=== Summary ===${NC}\n"
printf "${BOLD}  %d/%d checks passed${NC}\n" "$PASS_COUNT" "$TOTAL_COUNT"

if [[ $FAIL_COUNT -gt 0 ]]; then
  printf "${RED}  %d checks FAILED${NC}\n\n" "$FAIL_COUNT"
  exit 1
else
  printf "${GREEN}  All checks passed!${NC}\n\n"
  exit 0
fi
