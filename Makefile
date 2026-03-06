.PHONY: install dev build start clean typecheck pipeline validate smoke demo

# ── Install ──────────────────────────────────────────────
install:
	npm --prefix client install
	npm --prefix server install

# ── Development ──────────────────────────────────────────
dev:
	@echo "Starting server (port 3001) + client (port 5173)..."
	@npm --prefix server run dev & \
	 npm --prefix client run dev & \
	 wait

# ── Production ───────────────────────────────────────────
build:
	npm --prefix client install
	npm --prefix client run build
	npm --prefix server install
	npm --prefix server run build

start:
	node server/dist/index.js

# ── Type checking ────────────────────────────────────────
typecheck:
	cd server && npx tsc --noEmit
	cd client && npx tsc --noEmit -p tsconfig.app.json

# ── Data pipeline ────────────────────────────────────────
pipeline:
	cd pipeline && python build.py

validate:
	cd pipeline && python validate.py

# ── Smoke test ───────────────────────────────────────────
smoke: ## Run incident command smoke suite
	./scripts/smoke-test.sh

demo: ## Run deterministic hackathon demo
	./scripts/demo-seed.sh

# ── Cleanup ──────────────────────────────────────────────
clean:
	rm -rf client/dist server/dist
	rm -rf client/node_modules/.tmp
