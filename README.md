# VectorPath 🚀

VectorPath is an autonomous, AI-driven job discovery and application tracking platform. It leverages advanced LLM ensembles (Groq Llama-3 + Google Gemini) to deeply analyze your resume, autonomously scour the web for remote job opportunities, and algorithmically score your exact match probability.

## 🌟 Key Features

1. **Intelligent Resume Vectorization**: Upload your PDF resume, and the LangGraph ensemble extracts your exact skill map and confidence levels.
2. **Autonomous Web Scout Daemon**: A high-speed multi-threaded web scraper that constantly monitors DuckDuckGo for the latest remote jobs. It runs continuously via GitHub Actions or as a local Python daemon.
3. **Dual-Model AI Matchmaker**: Every discovered job is pushed through a dual-LLM pipeline (Gemini + Groq) to calculate a deep semantic `match_score` against your specific skills.
4. **Application Tracking Dashboard**: A beautiful, glassmorphism UI to track your entire job hunt funnel (Applied, Interviews, Offers, Upskilling).

## 🏗️ Architecture

- **Frontend**: Next.js (React), TailwindCSS, TypeScript
- **Backend**: FastAPI (Python), SQLAlchemy, LangGraph
- **Database**: SQLite (Local) / Supabase (Cloud Ready)
- **AI Models**: `llama-3.1-8b-instant` (Groq), `gemini-2.5-flash` (Google)
- **Automation**: GitHub Actions (`scout.yml`)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Groq API Key
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yoyosina/VectorPath.git
   cd VectorPath
   ```

2. **Setup Backend (FastAPI)**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the `backend` directory:
   ```env
   GROQ_API_KEY=your_groq_key
   GEMINI_API_KEY=your_gemini_key
   ```

4. **Run Backend Server**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. **Setup Frontend (Next.js)**
   ```bash
   # Open a new terminal
   npm install
   npm run dev
   ```

6. **Open Dashboard**
   Navigate to `http://localhost:3000` in your browser.

## 🤖 GitHub Actions Setup
To enable the free cloud-based Web Scout, simply add your `GROQ_API_KEY` to your GitHub Repository Secrets. The Action will automatically run every 15 minutes!
