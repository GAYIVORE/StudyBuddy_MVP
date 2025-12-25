"""
Simple RAG (Retrieval-Augmented Generation) system for academic content
"""

import os
from typing import List, Dict, Any, Optional
import PyPDF2
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Import settings
from config import settings

class SimpleRAG:
    def __init__(self, persist_directory: str = None):
        """Initialize the RAG system with Google Gemini"""
        self.persist_directory = persist_directory or settings.RAG_PERSIST_DIR
        
        # Use Google Gemini Embeddings
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001",
            google_api_key=settings.GEMINI_API_KEY
        )
        
        # Initialize or load ChromaDB
        self.vectorstore = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings,
            collection_name="academic_knowledge"
        )
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text content from PDF file"""
        text = ""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return ""
    
    def add_document(self, file_path: str, metadata: Optional[Dict[str, Any]] = None):
        """Add a document to the knowledge base"""
        print(f"📄 Processing document: {file_path}")
        
        if file_path.endswith('.pdf'):
            text = self.extract_text_from_pdf(file_path)
        elif file_path.endswith('.txt') or file_path.endswith('.md'):
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            return {"error": "Unsupported file format"}
        
        if not text or len(text.strip()) < 50:
            return {"error": "Document too short or could not extract text"}
        
        # Split text into chunks
        chunks = self.text_splitter.split_text(text)
        print(f"   Created {len(chunks)} chunks from document")
        
        # Create documents with metadata
        documents = []
        for i, chunk in enumerate(chunks):
            doc_metadata = {
                "source": file_path,
                "chunk_id": i,
                "total_chunks": len(chunks),
                "chunk_size": len(chunk),
                "original_filename": metadata.get("filename", "unknown") if metadata else os.path.basename(file_path)
            }
            if metadata:
                doc_metadata.update(metadata)
            
            documents.append(Document(
                page_content=chunk,
                metadata=doc_metadata
            ))
        
        # Add to vectorstore
        try:
            self.vectorstore.add_documents(documents)
            print(f"   ✅ Successfully embedded {len(chunks)} chunks")
            
            return {
                "success": True,
                "chunks_added": len(chunks),
                "source": file_path,
                "embedding_model": "Google Gemini embedding-001",
                "total_chars": len(text)
            }
        except Exception as e:
            print(f"❌ Error adding documents to vectorstore: {e}")
            return {
                "success": False,
                "error": f"Failed to embed documents: {str(e)}"
            }
    
    def search(self, query: str, k: int = None) -> List[Dict]:
        """Search for relevant document chunks"""
        k = k or settings.SEARCH_RESULTS
        
        try:
            results = self.vectorstore.similarity_search_with_relevance_scores(
                query, 
                k=k
            )
            
            formatted_results = []
            for doc, score in results:
                formatted_results.append({
                    "content": doc.page_content,
                    "source": doc.metadata.get("source", "unknown"),
                    "filename": doc.metadata.get("original_filename", "unknown"),
                    "relevance_score": float(score),
                    "chunk_id": doc.metadata.get("chunk_id", 0),
                    "total_chunks": doc.metadata.get("total_chunks", 1),
                    "metadata": doc.metadata
                })
            
            return formatted_results
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    def query_with_context(self, query: str, k: int = None) -> str:
        """Get relevant context for a query"""
        try:
            results = self.search(query, k)
            
            if not results:
                return "No relevant context found in knowledge base."
            
            context_parts = []
            for i, result in enumerate(results):
                context_parts.append(
                    f"[Source: {result.get('filename', 'Unknown')}, "
                    f"Relevance: {result['relevance_score']:.2f}]\n"
                    f"{result['content']}\n"
                )
            
            return "\n---\n".join(context_parts)
        except Exception as e:
            print(f"Error in query_with_context: {e}")
            return "Unable to retrieve context at this time."
    
    def clear_database(self):
        """Clear all documents from the vectorstore"""
        try:
            self.vectorstore.delete_collection()
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings,
                collection_name="academic_knowledge"
            )
            return {"success": True, "message": "Database cleared successfully"}
        except Exception as e:
            print(f"Error clearing database: {e}")
            return {"success": False, "error": str(e)}
    
    def get_stats(self):
        """Get statistics about the RAG system"""
        try:
            # Try to get collection count (this is a simplified approach)
            # Note: Chroma doesn't have a direct count method in this version
            return {
                "status": "active",
                "persist_directory": self.persist_directory,
                "embedding_model": "Google Gemini embedding-001",
                "collection_name": "academic_knowledge"
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

# Singleton instance
rag_system = SimpleRAG()