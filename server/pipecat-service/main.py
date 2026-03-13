"""
Pipecat Voice Service - Main Entry Point
FastAPI server with WebSocket support for real-time voice conversations
"""
import asyncio
import logging
import json
import base64
from typing import Dict, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from config import settings
from pipecat_bridge import PipecatBridge

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Pipecat Voice Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active sessions
active_sessions: Dict[str, PipecatBridge] = {}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "pipecat-voice"}

@app.get("/sessions")
async def list_sessions():
    """List active sessions"""
    return {
        "sessions": list(active_sessions.keys()),
        "count": len(active_sessions)
    }

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id in active_sessions:
        bridge = active_sessions[session_id]
        await bridge.stop()
        del active_sessions[session_id]
        return {"status": "deleted", "session_id": session_id}
    raise HTTPException(status_code=404, detail="Session not found")

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for voice conversations
    
    Expected query parameters:
    - api_key: API key for STT/TTS services (optional if session_id is valid)
    - conversation_id: Optional conversation ID
    - user_id: Optional user ID
    - backend_url: Optional backend URL override
    """
    await websocket.accept()
    
    try:
        # Get query parameters
        api_key = websocket.query_params.get("api_key")
        conversation_id = websocket.query_params.get("conversation_id")
        user_id = websocket.query_params.get("user_id")
        backend_url = websocket.query_params.get("backend_url") or settings.backend_url
        
        # If no API key provided, try to get it from backend using session_id
        if not api_key:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    # Call backend to get session info and API key
                    response = await client.get(
                        f"{backend_url}/api/pipecat/session/{session_id}",
                        timeout=5.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        api_key = data.get("api_key")
                        logger.info(f"Retrieved API key from backend for session {session_id}")
            except Exception as e:
                logger.warning(f"Could not fetch API key from backend: {e}")
        
        if not api_key:
            await websocket.close(code=1008, reason="Missing API key")
            return
        
        # Create bridge
        bridge = PipecatBridge(
            websocket=websocket,
            api_key=api_key,
            stt_provider=settings.stt_provider,
            tts_provider=settings.tts_provider,
            conversation_id=conversation_id,
            user_id=user_id,
            backend_url=backend_url
        )
        
        # Store session
        active_sessions[session_id] = bridge
        
        # Setup pipeline
        try:
            await bridge.setup()
            logger.info(f"Pipeline setup successful for session {session_id}")
        except Exception as e:
            logger.error(f"Error setting up pipeline for session {session_id}: {e}", exc_info=True)
            await websocket.close(code=1011, reason=f"Pipeline setup failed: {str(e)}")
            return
        
        # Start pipeline in background (non-blocking)
        pipeline_task = asyncio.create_task(bridge.start())
        logger.info(f"Pipeline started for session {session_id}")
        
        # Send initial ready message in RTVI format
        try:
            # Send RTVI bot-ready message
            await websocket.send_json({
                "label": "rtvi-ai",
                "type": "bot-ready",
                "data": {
                    "version": "1.0.0"
                },
                "id": f"ready-{session_id}"
            })
            # Also send our format for compatibility
            await websocket.send_json({
                "type": "ready",
                "message": "Voice session ready"
            })
        except Exception as e:
            logger.warning(f"Could not send ready message: {e}")
        
        logger.info(f"Session {session_id} fully initialized and ready")
        
        # Handle WebSocket messages
        try:
            while True:
                # Receive message from client (with timeout to check connection)
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                    message = json.loads(data)
                    msg_type = message.get("type")
                    
                    if msg_type == "pong":
                        # Respond to ping - connection is alive
                        continue
                    elif msg_type == "audio_chunk":
                        # Handle audio chunk from client
                        audio_base64 = message.get("audio", "")
                        mime_type = message.get("mimeType", "audio/pcm")
                        sample_rate = message.get("sampleRate", 16000)
                        channels = message.get("channels", 1)
                        
                        if audio_base64:
                            try:
                                audio_data = base64.b64decode(audio_base64)
                                logger.debug(f"🎤 Received audio chunk: {len(audio_data)} bytes, format: {mime_type}, rate: {sample_rate}Hz, channels: {channels}")
                                
                                # Queue audio for processing (new queue-based approach)
                                await bridge.queue_audio(audio_data, sample_rate, channels)
                            except Exception as e:
                                logger.error(f"Error processing audio chunk: {e}", exc_info=True)
                        else:
                            logger.warning("Received audio_chunk message but audio data is empty")
                    
                except asyncio.TimeoutError:
                    # Check if connection is still alive
                    try:
                        # Ping the connection to check if it's still open
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        # Connection is closed
                        break
                    continue
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for session {session_id}")
        except Exception as e:
            logger.error(f"Error in WebSocket handler for session {session_id}: {e}", exc_info=True)
        finally:
            # Cleanup
            try:
                pipeline_task.cancel()
                await asyncio.wait_for(pipeline_task, timeout=2.0)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Error cancelling pipeline: {e}")
            
            if session_id in active_sessions:
                try:
                    await bridge.stop()
                except Exception as e:
                    logger.error(f"Error stopping bridge: {e}")
                del active_sessions[session_id]
                logger.info(f"Session {session_id} cleaned up")
                
    except Exception as e:
        logger.error(f"Error setting up WebSocket: {e}")
        await websocket.close(code=1011, reason=f"Server error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )
