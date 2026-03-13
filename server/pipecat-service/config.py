"""
Configuration for Pipecat Voice Service
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Server configuration
    host: str = os.getenv("PIPECAT_HOST", "0.0.0.0")
    port: int = int(os.getenv("PIPECAT_PORT", "8000"))
    
    # Node.js backend URL
    backend_url: str = os.getenv("BACKEND_URL", "http://localhost:3001")
    
    # API Keys (will be retrieved from Node.js backend via apiKeyProvider)
    # These are optional as we'll fetch them from the backend
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY", None)
    deepgram_api_key: Optional[str] = os.getenv("DEEPGRAM_API_KEY", None)
    
    # Audio configuration
    sample_rate: int = 16000
    channels: int = 1
    
    # STT/TTS provider selection
    stt_provider: str = os.getenv("STT_PROVIDER", "openai")  # openai, deepgram
    tts_provider: str = os.getenv("TTS_PROVIDER", "openai")  # openai, google
    
    # Gemini API configuration (retrieved from Node.js backend)
    # API keys are stored in database and retrieved via backend
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()

