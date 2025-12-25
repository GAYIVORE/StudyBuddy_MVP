# Student AI Mentor - MVP

An AI-powered tutor and research assistant for students, built with FastAPI and modern web technologies.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js (for frontend, optional - you can open HTML directly)
- OpenAI API key

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env

# Run the backend server
python main.py
# Student AI Mentor v4.0

An intelligent AI tutor for students with RAG (Retrieval-Augmented Generation) capabilities.

## Features

- 🤖 AI-powered tutoring with Google Gemini
- 📚 Multiple modes: General, Study, Research
- 🔍 RAG system for document-based context
- 📁 File upload (PDF, TXT, MD) to knowledge base
- 💬 Conversation history management
- ⭐ Feedback system
- 🔧 Environment-based configuration

## Quick Start

1. **Clone and setup:**
```bash
git clone <repository>
cd student-ai-mentor
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt