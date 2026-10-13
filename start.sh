#!/usr/bin/env bash
# ── ShadowMind v3 Quick Start ─────────────────────────────────────────────────
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}"
echo "  ███████╗██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗    ██╗"
echo "  ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔═══██╗██║    ██║"
echo "  ███████╗███████║███████║██║  ██║██║   ██║██║ █╗ ██║"
echo "  ╚════██║██╔══██║██╔══██║██║  ██║██║   ██║██║███╗██║"
echo "  ███████║██║  ██║██║  ██║██████╔╝╚██████╔╝╚███╔███╔╝"
echo "  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚══╝╚══╝ "
echo -e "${NC}"
echo -e "${CYAN}  ShadowMind v3 — AI Mental Wellness Platform${NC}"
echo ""

# Check for .env
if [ ! -f backend/.env ]; then
  echo -e "${RED}[!]${NC} backend/.env not found. Copying from .env.example..."
  cp backend/.env.example backend/.env
  echo -e "${RED}[!]${NC} Please edit backend/.env and add your ANTHROPIC_API_KEY, then re-run."
  exit 1
fi

echo -e "${GREEN}[1/3]${NC} Installing backend dependencies..."
cd backend
pip install -r requirements.txt -q
cd ..

echo -e "${GREEN}[2/3]${NC} Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

echo -e "${GREEN}[3/3]${NC} Starting services..."
echo ""
echo -e "  Backend  → ${CYAN}http://localhost:8000${NC}  (API docs: /api/docs)"
echo -e "  Frontend → ${CYAN}http://localhost:5173${NC}"
echo ""

# Run backend in background
cd backend && uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Run frontend
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'ShadowMind stopped.'" EXIT
wait
