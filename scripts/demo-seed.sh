#!/usr/bin/env bash
# demo-seed.sh — Deterministic demo runner for hackathon presentation
# Seeds 5 Metro Manila flood incidents, drives 3 through full lifecycle
# Usage: ./scripts/demo-seed.sh
set -euo pipefail

# ── Colors & helpers ─────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SERVER_PID=""
BASE_URL="http://localhost:3001"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$PROJECT_ROOT/incidents.db"
DEMO_DATA="$PROJECT_ROOT/data/demo-incidents.json"
STEP=0

# ── Cleanup ──────────────────────────────────────────────
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    printf "\n${DIM}Stopping server (PID %s)...${NC}\n" "$SERVER_PID"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Helpers ──────────────────────────────────────────────
step() {
  STEP=$((STEP + 1))
  printf "${BOLD}${CYAN}[%02d]${NC} %s" "$STEP" "$1"
}

ok() {
  printf " ${GREEN}✓${NC}\n"
}

fail() {
  printf " ${RED}✗ %s${NC}\n" "${1:-}"
  exit 1
}

info() {
  printf "${DIM}     %s${NC}\n" "$1"
}

# JSON extraction (portable, no jq dependency)
json_val() {
  local key="$1"
  local json="$2"
  echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key',''))" 2>/dev/null
}

json_nested() {
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

# Read demo incident field from JSON array
demo_field() {
  local index="$1"
  local field="$2"
  python3 -c "
import json
with open('$DEMO_DATA') as f:
    data = json.load(f)
val = data[$index].get('$field')
print('' if val is None else val)
" 2>/dev/null
}

demo_create_body() {
  local index="$1"
  python3 -c "
import json
with open('$DEMO_DATA') as f:
    inc = json.load(f)[$index]
print(json.dumps({
    'title': inc['title'],
    'description': inc['description'],
    'latitude': inc['latitude'],
    'longitude': inc['longitude']
}))
" 2>/dev/null
}

demo_resolve_body() {
  local index="$1"
  local version="$2"
  python3 -c "
import json
with open('$DEMO_DATA') as f:
    inc = json.load(f)[$index]
print(json.dumps({'version': $version, 'note': inc['resolve_note']}))
" 2>/dev/null
}

# ═══════════════════════════════════════════════════════════
# DEMO START
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}${CYAN}║   ROBERTO — Incident Command Demo (Metro Manila Flood)   ║${NC}\n"
printf "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}\n\n"

# ── 0. Clean slate ───────────────────────────────────────
step "Cleaning database..."
rm -f "$DB_PATH" "$DB_PATH-shm" "$DB_PATH-wal"
ok

# ── 1. Start server ─────────────────────────────────────
step "Starting server..."
cd "$PROJECT_ROOT/server"
PORT=3001 npx tsx src/index.ts > /tmp/demo-server.log 2>&1 &
SERVER_PID=$!
cd "$PROJECT_ROOT"

# Wait for health
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    ok
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "Server failed to start within 30s"
  fi
  sleep 1
done

# ═══════════════════════════════════════════════════════════
# PHASE 1: Authentication
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}── Phase 1: Authentication ─────────────────────────────${NC}\n\n"

step "Logging in reporter1 (field reporter)..."
REPORTER_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"reporter1","password":"pass123"}')
REPORTER_TOKEN=$(json_val "token" "$REPORTER_RESP")
[[ -n "$REPORTER_TOKEN" ]] && ok || fail "No token"

step "Logging in coord1 (incident coordinator)..."
COORD_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"coord1","password":"pass123"}')
COORD_TOKEN=$(json_val "token" "$COORD_RESP")
[[ -n "$COORD_TOKEN" ]] && ok || fail "No token"

step "Logging in resp1 (field responder)..."
RESP_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"resp1","password":"pass123"}')
RESP_TOKEN=$(json_val "token" "$RESP_RESP")
[[ -n "$RESP_TOKEN" ]] && ok || fail "No token"

# ═══════════════════════════════════════════════════════════
# PHASE 2: Seed Incidents
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}── Phase 2: Reporting Incidents (5 flood reports) ─────${NC}\n\n"

INCIDENT_IDS=()

for idx in 0 1 2 3 4; do
  TITLE=$(demo_field "$idx" "title")
  LAT=$(demo_field "$idx" "latitude")
  LNG=$(demo_field "$idx" "longitude")
  BODY=$(demo_create_body "$idx")

  step "Creating: ${TITLE}..."
  CREATE_RESP=$(curl -sf -X POST "$BASE_URL/api/incidents" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $REPORTER_TOKEN" \
    -d "$BODY")
  INC_ID=$(json_nested "incident.id" "$CREATE_RESP")
  INC_STATUS=$(json_nested "incident.status" "$CREATE_RESP")
  INCIDENT_IDS+=("$INC_ID")

  if [[ "$INC_STATUS" == "PING" ]]; then
    ok
    info "ID: ${INC_ID:0:8}...  Status: PING  Location: ($LAT, $LNG)"
  else
    fail "Expected PING, got $INC_STATUS"
  fi

  sleep 0.5
done

# ═══════════════════════════════════════════════════════════
# PHASE 3: Drive lifecycle — 3 incidents through full cycle
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}── Phase 3: Incident Lifecycle ─────────────────────────${NC}\n"

drive_lifecycle() {
  local idx="$1"
  local inc_id="${INCIDENT_IDS[$idx]}"
  local title=$(demo_field "$idx" "title")
  local priority=$(demo_field "$idx" "priority")

  printf "\n${YELLOW}  ▸ Incident #$((idx+1)): ${title}${NC}\n"

  # PING → VERIFIED (coordinator)
  step "  Verifying (coordinator confirms report)..."
  RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$inc_id/verify" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $COORD_TOKEN" \
    -d '{"version":1}')
  STATUS=$(json_nested "incident.status" "$RESP")
  [[ "$STATUS" == "VERIFIED" ]] && ok || fail "Expected VERIFIED, got $STATUS"
  sleep 1

  # VERIFIED → PRIORITIZED (coordinator)
  step "  Prioritizing (severity score: $priority)..."
  RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$inc_id/prioritize" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $COORD_TOKEN" \
    -d "{\"version\":2,\"priority\":$priority}")
  STATUS=$(json_nested "incident.status" "$RESP")
  [[ "$STATUS" == "PRIORITIZED" ]] && ok || fail "Expected PRIORITIZED, got $STATUS"
  sleep 1

  # PRIORITIZED → ASSIGNED (coordinator assigns to resp1)
  step "  Assigning to resp1 (dispatching responder)..."
  RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$inc_id/assign" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $COORD_TOKEN" \
    -d '{"version":3,"responderId":"user-resp-01"}')
  STATUS=$(json_nested "incident.status" "$RESP")
  [[ "$STATUS" == "ASSIGNED" ]] && ok || fail "Expected ASSIGNED, got $STATUS"
  sleep 1

  # ASSIGNED → RESOLVED (responder)
  step "  Resolving (responder on-site confirms)..."
  local resolve_body=$(demo_resolve_body "$idx" 4)
  RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$inc_id/resolve" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $RESP_TOKEN" \
    -d "$resolve_body")
  STATUS=$(json_nested "incident.status" "$RESP")
  [[ "$STATUS" == "RESOLVED" ]] && ok || fail "Expected RESOLVED, got $STATUS"
  sleep 0.5
}

# Drive incidents 1-3 through full lifecycle
for i in 0 1 2; do
  drive_lifecycle "$i"
done

# ═══════════════════════════════════════════════════════════
# PHASE 4: Partial lifecycle — leave 2 incidents mid-flow
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}── Phase 4: Partial Lifecycle (in-progress incidents) ──${NC}\n"

# Incident #4: PING → VERIFIED (stop here)
IDX=3
INC_ID="${INCIDENT_IDS[$IDX]}"
TITLE=$(demo_field "$IDX" "title")
printf "\n${YELLOW}  ▸ Incident #4: ${TITLE}${NC}\n"

step "  Verifying (coordinator confirms, awaiting triage)..."
RESP=$(curl -sf -X PATCH "$BASE_URL/api/incidents/$INC_ID/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -d '{"version":1}')
STATUS=$(json_nested "incident.status" "$RESP")
[[ "$STATUS" == "VERIFIED" ]] && ok || fail "Expected VERIFIED, got $STATUS"
info "⏸  Left at VERIFIED — awaiting prioritization"

# Incident #5: stays at PING (no action)
IDX=4
TITLE=$(demo_field "$IDX" "title")
printf "\n${YELLOW}  ▸ Incident #5: ${TITLE}${NC}\n"
step "  No action taken (unverified community report)..."
ok
info "⏸  Left at PING — awaiting coordinator verification"

# ═══════════════════════════════════════════════════════════
# PHASE 5: KPI Dashboard
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}── Phase 5: KPI Summary ────────────────────────────────${NC}\n\n"

step "Querying KPI endpoint..."
KPI_RESP=$(curl -sf "$BASE_URL/api/kpi" \
  -H "Authorization: Bearer $COORD_TOKEN")
ok

# Parse KPI values
KPI_TOTAL=$(json_val "total_incidents" "$KPI_RESP")
KPI_RATE=$(json_val "resolution_rate" "$KPI_RESP")
KPI_ACK=$(json_val "avg_acknowledge_time_ms" "$KPI_RESP")
KPI_ASSIGN=$(json_val "avg_assignment_latency_ms" "$KPI_RESP")
KPI_RESOLVE=$(json_val "avg_resolution_time_ms" "$KPI_RESP")

# Parse by_status
KPI_BY_STATUS=$(echo "$KPI_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin).get('by_status', {})
parts = []
for status in ['PING', 'VERIFIED', 'PRIORITIZED', 'ASSIGNED', 'RESOLVED']:
    count = d.get(status, 0)
    if count > 0:
        parts.append(f'{status}={count}')
print('  '.join(parts))
" 2>/dev/null)

printf "\n${BOLD}${CYAN}┌─────────────────────────────────────────────────┐${NC}\n"
printf "${BOLD}${CYAN}│             📊 Response Metrics                 │${NC}\n"
printf "${BOLD}${CYAN}├─────────────────────────────────────────────────┤${NC}\n"
printf "${CYAN}│${NC}  Total Incidents:       ${BOLD}%-24s${NC}${CYAN}│${NC}\n" "$KPI_TOTAL"
printf "${CYAN}│${NC}  Resolution Rate:       ${BOLD}%-24s${NC}${CYAN}│${NC}\n" "${KPI_RATE}%"
printf "${CYAN}│${NC}  Avg Acknowledge Time:  ${BOLD}%-24s${NC}${CYAN}│${NC}\n" "${KPI_ACK}ms"
printf "${CYAN}│${NC}  Avg Assignment Latency:${BOLD}%-24s${NC}${CYAN}│${NC}\n" " ${KPI_ASSIGN}ms"
printf "${CYAN}│${NC}  Avg Resolution Time:   ${BOLD}%-24s${NC}${CYAN}│${NC}\n" "${KPI_RESOLVE}ms"
printf "${CYAN}│${NC}                                                 ${CYAN}│${NC}\n"
printf "${CYAN}│${NC}  By Status:  %-35s${CYAN}│${NC}\n" "$KPI_BY_STATUS"
printf "${BOLD}${CYAN}└─────────────────────────────────────────────────┘${NC}\n"

# ═══════════════════════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════════════════════
printf "\n${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}${GREEN}║              Demo completed successfully!                 ║${NC}\n"
printf "${BOLD}${GREEN}║  5 incidents seeded · 3 resolved · 1 verified · 1 ping   ║${NC}\n"
printf "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}\n\n"
