"""
LLM Adapter for Pipecat
Calls the Node.js backend LLMRouter API for intelligent model selection
"""
import httpx
import logging
from typing import List, Dict, Any, Optional
from config import settings

logger = logging.getLogger(__name__)

class LLMAdapter:
    """Adapter to integrate with Node.js LLMRouter"""
    
    def __init__(self, backend_url: str = None):
        self.backend_url = backend_url or settings.backend_url
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def chat(
        self,
        message: str,
        history: List[Dict[str, str]] = None,
        context_type: str = "neural-chat",
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
        api_key: Optional[str] = None,
        project_state: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Call Node.js LLMRouter API for chat completion
        
        Args:
            message: User message
            history: Conversation history (list of {role, content})
            context_type: Context type (wizard, workspace, neural-chat, etc.)
            conversation_id: Optional conversation ID
            user_id: Optional user ID for authentication
            api_key: Optional JWT token for authentication
            project_state: Optional project state for context
            metadata: Optional conversation metadata (topic, ideas, etc.)
            
        Returns:
            AI response text
        """
        try:
            url = f"{self.backend_url}/api/llm/chat"
            
            # Format history for backend (convert to array of {role, content})
            formatted_history = []
            if history:
                for item in history:
                    if isinstance(item, dict):
                        formatted_history.append({
                            "role": item.get("role", "user"),
                            "content": item.get("content", str(item))
                        })
            
            payload = {
                "message": message,
                "history": formatted_history,
                "contextType": context_type,
                "preferFastModel": True,  # For real-time voice, prefer faster models
            }
            
            # Add project state if provided
            if project_state:
                payload["projectState"] = project_state
            
            headers = {
                "Content-Type": "application/json"
            }
            
            # Add authentication if provided (JWT token)
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            response = await self.client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("success") and data.get("response"):
                return data["response"]
            else:
                error_msg = data.get("error") or data.get("message") or "Unknown error"
                logger.error(f"LLM API error: {error_msg}")
                return "I'm sorry, I encountered an error processing your request."
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling LLM API: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 401:
                return "I'm sorry, I'm having trouble authenticating. Please try again."
            return "I'm sorry, I'm having trouble connecting to the AI service."
        except httpx.HTTPError as e:
            logger.error(f"HTTP error calling LLM API: {e}")
            return "I'm sorry, I'm having trouble connecting to the AI service."
        except Exception as e:
            logger.error(f"Unexpected error in LLM adapter: {e}", exc_info=True)
            return "I'm sorry, an unexpected error occurred."
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

