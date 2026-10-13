# ShadowMind: Local-First AI Assistant & Mental-Wellness Companion

ShadowMind is a fast, intelligent, local-first AI assistant built with React/TypeScript + FastAPI + MongoDB.
It runs completely offline using **Ollama** and a structured **Offline Emotional Engine**—with zero Gemini API dependencies.

## Architecture

| Layer | Component | Details |
|---|---|---|
| **Model A (General)** | `llama3.2:latest` | Everyday conversation, explanations, emotional assistance, summaries. |
| **Model B (Coding)** | `qwen2.5-coder:3b` | Code generation, debugging, error root cause analysis, stack traces. |
| **Model Router** | Deterministic Classifier | Zero-overhead regex/keyword router that routes without calling an auxiliary LLM. |
| **Diagnostics** | Severity & Root Cause Engine | Classifies issues into `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`. |
| **Offline Composer** | In-Memory Emotional Engine | 7,149 verified unique keyword/phrase dataset across 50 categories with negation & crisis safety. |
| **Backend** | FastAPI + Motor (MongoDB) | Progressive SSE streaming, keep-alive persistence, non-blocking fallback. |
| **Frontend** | React 18, TypeScript, Vite | Instant streaming rendering, markdown highlighting, dark/glass UI. |

## 1. Local AI Runtime (Ollama)

Install [Ollama](https://ollama.com) and pull the two primary local models:

```bash
# Model A: Fast General Assistant
ollama pull llama3.2:latest

# Model B: Technical & Coding Assistant (3B fits CPU & 16GB RAM)
ollama pull qwen2.5-coder:3b
```

Ollama runs locally at `http://127.0.0.1:11434`. Models are kept persistent in memory via `OLLAMA_KEEP_ALIVE=30m` to eliminate reload latency.

## 2. Database (MongoDB)

Run MongoDB locally or via Docker:

```bash
docker run -d -p 27017:27017 --name shadowmind-mongo mongo:7
```

## 3. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows (or source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
cp .env.example .env
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```

Run the automated test suite (all 91 tests run fully offline without external network):

```bash
python -m pytest -v
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. The dev server proxies `/api` to the backend on
port 8000 (see `vite.config.ts`).

## Docker Compose

`docker-compose.yml` runs MongoDB, the backend and the frontend together:

```bash
docker compose up --build
```

## Safety

- Crisis language is detected locally (in `ai/analyzer.py`) before anything is
  sent to any AI provider.
- Any reply to acute risk always includes Tele-MANAS (14416, India, free, 24/7)
  and emergency numbers - this is enforced in code (`ai/guard.py`), not left to
  the model.
- A model reply that uses cheerful language in response to distress (the
  "happy to hear you're depressed" bug) is automatically rejected and retried,
  then replaced by the offline composer if it still doesn't pass.

This app offers supportive listening and tools, not therapy or diagnosis.
