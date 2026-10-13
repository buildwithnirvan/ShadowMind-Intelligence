.PHONY: help dev backend frontend install seed test docker-up docker-down clean

help:
	@echo ""
	@echo "  ███████╗██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗    ██╗"
	@echo "  ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔═══██╗██║    ██║"
	@echo "  ███████╗███████║███████║██║  ██║██║   ██║██║ █╗ ██║"
	@echo "  ╚════██║██╔══██║██╔══██║██║  ██║██║   ██║██║███╗██║"
	@echo "  ███████║██║  ██║██║  ██║██████╔╝╚██████╔╝╚███╔███╔╝"
	@echo "  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚══╝╚══╝"
	@echo ""
	@echo "  ShadowMind v3 — Available Commands:"
	@echo ""
	@echo "  make install      Install all dependencies (backend + frontend)"
	@echo "  make dev          Run backend + frontend in development mode"
	@echo "  make backend      Run backend only (port 8000)"
	@echo "  make frontend     Run frontend only (port 5173)"
	@echo "  make seed         Seed database with demo data"
	@echo "  make test         Run backend test suite"
	@echo "  make docker-up    Start full stack with Docker Compose"
	@echo "  make docker-down  Stop Docker Compose services"
	@echo "  make clean        Remove build artifacts and cache"
	@echo ""

install:
	@echo "[1/2] Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "[2/2] Installing frontend dependencies..."
	cd frontend && npm install

backend:
	cd backend && uvicorn main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	@bash start.sh

seed:
	cd backend && python seed.py

test:
	cd backend && pytest tests/ -v --tb=short

docker-up:
	docker compose up --build -d
	@echo ""
	@echo "  Services running:"
	@echo "  → Frontend:  http://localhost"
	@echo "  → API:       http://localhost:8000/api/docs"
	@echo "  → DB:        localhost:27017"

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name "*.db" -delete 2>/dev/null || true
	rm -rf frontend/dist frontend/node_modules/.vite
	@echo "Clean complete."
