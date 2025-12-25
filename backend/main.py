"""
Student AI Mentor - Enhanced Version with .env support
"""

import os
import sys
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
import uvicorn
import httpx
import json
from datetime import datetime

# Import local modules
from config import settings
from prompts import SYSTEM_PROMPT, STUDY_TUTOR_PROMPT, RESEARCH_ASSISTANT_PROMPT
from rag import SimpleRAG, rag_system

# ===== Initialize FastAPI =====
app = FastAPI(
    title="Student AI Mentor API",
    description="An intelligent AI tutor for students with RAG capabilities",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ===== CORS Configuration =====
# Get CORS origins from settings
cors_origins = settings.get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# ===== Pydantic Models =====
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    mode: str = Field("general", pattern="^(general|study|research)$")
    use_rag: bool = Field(False, description="Whether to use RAG for context")
    
class DocumentUpload(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = []

class Feedback(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    message_id: Optional[int] = None

# ===== Global State =====
conversation_history: List[Dict[str, Any]] = []
feedback_store: List[Dict[str, Any]] = []

# ===== Helper Functions =====
def build_system_prompt(mode: str) -> str:
    """Build system prompt based on mode"""
    mode_prompts = {
        "study": f"{SYSTEM_PROMPT}\n\n{STUDY_TUTOR_PROMPT}",
        "research": f"{SYSTEM_PROMPT}\n\n{RESEARCH_ASSISTANT_PROMPT}",
        "general": SYSTEM_PROMPT
    }
    return mode_prompts.get(mode, SYSTEM_PROMPT)

def format_conversation_history(messages: List[Dict], max_messages: int = 4) -> str:
    """Format conversation history for context"""
    if not messages:
        return ""
    
    formatted = []
    for msg in messages[-max_messages:]:
        role = "Student" if msg["role"] == "user" else "Tutor"
        formatted.append(f"{role}: {msg['message']}")
    
    return "\n".join(formatted)

async def call_gemini_api(prompt: str, use_streaming: bool = False) -> str:
    """Call Gemini API with proper error handling"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.MODEL_NAME}:generateContent"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    params = {"key": settings.GEMINI_API_KEY}
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": settings.MODEL_TEMPERATURE,
            "maxOutputTokens": settings.MAX_TOKENS,
            "topP": 0.95,
            "topK": 40
        },
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers=headers,
                params=params,
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            else:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Gemini API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API call failed: {str(e)}")

def get_fallback_response(mode: str) -> str:
    """Get fallback responses when API fails"""
    fallbacks = {
        "study": """I'm here to help you study! Try these techniques:

📚 **Active Learning Strategies:**
1. **Spaced Repetition**: Review material at increasing intervals
2. **Interleaving**: Mix different subjects/topics in a study session
3. **Elaboration**: Explain concepts in your own words
4. **Retrieval Practice**: Test yourself without looking at notes

What specific topic would you like help with?""",
        
        "research": """**Academic Research Assistance:**

🔍 **Research Process:**
1. **Question Formulation**: Start with a clear, focused research question
2. **Literature Review**: Use databases like Google Scholar, PubMed, IEEE Xplore
3. **Source Evaluation**: Consider credibility, relevance, and currency
4. **Citation Management**: Use tools like Zotero or Mendeley

📝 **Need help with:**
- Finding relevant sources?
- Understanding methodology?
- Writing literature review?
- Proper citation formatting?""",
        
        "general": """Hello! I'm your AI StudyBuddy. I can help you with:

🎯 **Learning Support:**
- Understanding complex concepts
- Solving problems step-by-step
- Creating study plans
- Generating practice questions
- Research assistance

💡 **How to get the best help:**
1. Be specific about what you're working on
2. Share what you've tried so far
3. Ask about particular concepts you find challenging
4. Request examples or analogies

What would you like to learn today?"""
    }
    return fallbacks.get(mode, fallbacks["general"])

# ===== API Routes =====
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Student AI Mentor",
        "version": "4.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "features": [
            "Chat with AI tutor",
            "Multiple modes (general/study/research)",
            "RAG integration for document context",
            "File upload for knowledge base",
            "Conversation history",
            "Feedback system"
        ],
        "model": settings.MODEL_NAME,
        "cors_origins": cors_origins,
        "endpoints": {
            "GET /": "API information",
            "GET /health": "Health check",
            "POST /chat": "Chat with AI",
            "GET /history": "Get conversation history",
            "DELETE /history": "Clear history",
            "POST /upload": "Upload document to RAG",
            "GET /rag/stats": "RAG system statistics",
            "POST /feedback": "Submit feedback"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Gemini API connectivity
        test_url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.MODEL_NAME}:generateContent"
        params = {"key": settings.GEMINI_API_KEY}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                test_url,
                params=params,
                json={"contents": [{"parts": [{"text": "test"}]}]},
                timeout=5.0
            )
            api_status = "connected" if response.status_code == 200 else "disconnected"
            
    except Exception:
        api_status = "disconnected"
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "api_connection": api_status,
        "model": settings.MODEL_NAME,
        "rag_available": True,
        "conversation_messages": len(conversation_history),
        "settings_loaded": bool(settings.GEMINI_API_KEY)
    }

@app.post("/chat")
async def chat(chat_data: ChatMessage):
    """Main chat endpoint with RAG support"""
    global conversation_history
    
    # Validate input
    if not chat_data.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Check if API key is available
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key not configured. Please set GEMINI_API_KEY in .env file."
        )
    
    # Add user message to history
    user_message = {
        "id": len(conversation_history) + 1,
        "role": "user",
        "message": chat_data.message,
        "mode": chat_data.mode,
        "timestamp": datetime.now().isoformat(),
        "use_rag": chat_data.use_rag
    }
    conversation_history.append(user_message)
    
    try:
        # Build the prompt
        system_prompt = build_system_prompt(chat_data.mode)
        history_context = format_conversation_history(conversation_history)
        
        # Add RAG context if enabled
        rag_context = ""
        if chat_data.use_rag and rag_system:
            rag_context = rag_system.query_with_context(
                chat_data.message, 
                k=settings.SEARCH_RESULTS
            )
            if rag_context and rag_context != "No relevant context found in knowledge base.":
                rag_context = f"\n\n[Relevant context from uploaded documents]:\n{rag_context}\n"
        
        # Construct final prompt
        final_prompt = f"""{system_prompt}

{rag_context}

{history_context}

Student: {chat_data.message}

Tutor:"""
        
        # Call Gemini API
        ai_response = await call_gemini_api(final_prompt)
        
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
    except Exception as e:
        # Use fallback if API fails
        print(f"⚠️ API call failed: {e}")
        ai_response = get_fallback_response(chat_data.mode)
    
    # Add AI response to history
    ai_message = {
        "id": len(conversation_history) + 1,
        "role": "assistant",
        "message": ai_response,
        "mode": chat_data.mode,
        "timestamp": datetime.now().isoformat(),
        "model": settings.MODEL_NAME
    }
    conversation_history.append(ai_message)
    
    # Trim history if too long
    if len(conversation_history) > settings.MAX_HISTORY_LENGTH:
        conversation_history = conversation_history[-settings.MAX_HISTORY_LENGTH:]
    
    return {
        "response": ai_response,
        "message_id": ai_message["id"],
        "mode": chat_data.mode,
        "model": settings.MODEL_NAME,
        "timestamp": ai_message["timestamp"],
        "conversation_length": len(conversation_history),
        "rag_used": chat_data.use_rag
    }

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None)
):
    """Upload document to RAG knowledge base"""
    # Validate file type
    allowed_extensions = {'.pdf', '.txt', '.md'}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save file temporarily
    temp_dir = "./temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    
    temp_path = os.path.join(temp_dir, file.filename)
    
    try:
        # Save uploaded file
        contents = await file.read()
        if len(contents) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE // (1024*1024)}MB"
            )
        
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        # Prepare metadata
        metadata = {
            "filename": file.filename,
            "uploaded_at": datetime.now().isoformat(),
            "description": description,
            "tags": tags.split(",") if tags else [],
            "file_type": file_extension,
            "file_size": len(contents)
        }
        
        # Add to RAG system
        result = rag_system.add_document(temp_path, metadata)
        
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        if result.get("success", False):
            return {
                "success": True,
                "filename": file.filename,
                "chunks_added": result.get("chunks_added", 0),
                "message": "Document successfully added to knowledge base",
                "metadata": metadata
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to process document")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        # Clean up temp file if it exists
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/rag/stats")
async def rag_stats():
    """Get RAG system statistics"""
    try:
        stats = rag_system.get_stats()
        return {
            **stats,
            "persist_directory": settings.RAG_PERSIST_DIR,
            "chunk_size": settings.CHUNK_SIZE,
            "search_results": settings.SEARCH_RESULTS
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get RAG stats: {str(e)}")

@app.post("/feedback")
async def submit_feedback(feedback: Feedback):
    """Submit feedback about a response"""
    feedback_entry = {
        **feedback.dict(),
        "timestamp": datetime.now().isoformat(),
        "conversation_length": len(conversation_history)
    }
    
    feedback_store.append(feedback_entry)
    
    # Keep only last 100 feedback entries
    if len(feedback_store) > 100:
        feedback_store = feedback_store[-100:]
    
    return {
        "success": True,
        "message": "Thank you for your feedback!",
        "feedback_id": len(feedback_store)
    }

@app.get("/history")
async def get_history(
    limit: Optional[int] = 20,
    offset: Optional[int] = 0,
    mode: Optional[str] = None
):
    """Get conversation history with filtering"""
    filtered_history = conversation_history
    
    if mode:
        filtered_history = [msg for msg in filtered_history if msg.get("mode") == mode]
    
    paginated_history = filtered_history[offset:offset + limit]
    
    return {
        "messages": paginated_history,
        "total": len(filtered_history),
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < len(filtered_history)
    }

@app.delete("/history")
async def clear_history(confirm: bool = False):
    """Clear conversation history"""
    global conversation_history
    
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must confirm deletion by adding ?confirm=true to URL"
        )
    
    cleared_count = len(conversation_history)
    conversation_history = []
    
    return {
        "success": True,
        "message": f"Cleared {cleared_count} messages from history",
        "cleared_count": cleared_count
    }

# ===== Error Handlers =====
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred",
            "timestamp": datetime.now().isoformat()
        }
    )

# ===== Main Entry Point =====
def main():
    """Main entry point"""
    print("=" * 60)
    print("🎓 STUDENT AI MENTOR - ENHANCED VERSION")
    print("=" * 60)
    print(f"🔐 API Key loaded: {'Yes' if settings.GEMINI_API_KEY else 'No'}")
    print(f"🏠 Host: {settings.HOST}")
    print(f"🚪 Port: {settings.PORT}")
    print(f"🤖 Model: {settings.MODEL_NAME}")
    print(f"🌐 CORS Origins: {cors_origins}")
    print(f"📚 RAG: {'Enabled' if rag_system else 'Disabled'}")
    print("")
    print("✅ ENDPOINTS:")
    print("   GET  /              - API information")
    print("   GET  /health        - Health check")
    print("   POST /chat          - Chat with AI tutor")
    print("   POST /upload        - Upload documents")
    print("   GET  /rag/stats     - RAG statistics")
    print("   GET  /history       - Get conversation")
    print("   DELETE /history     - Clear conversation")
    print("   POST /feedback      - Submit feedback")
    print("=" * 60)
    print(f"\n📡 Server starting at http://{settings.HOST}:{settings.PORT}")
    print("📖 Documentation at http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )

if __name__ == "__main__":
    main()