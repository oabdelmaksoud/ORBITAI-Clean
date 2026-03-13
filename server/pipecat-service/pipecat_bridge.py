"""
Pipecat Pipeline Bridge
Sets up the STT → LLM → TTS pipeline for voice conversations
Using queue-based input for proper frame injection
"""
import asyncio
import logging
import base64
from typing import Optional, Dict, Any, List
from pipecat.frames.frames import TextFrame, EndFrame, AudioRawFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.services.openai.stt import OpenAISTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.processors.frame_processor import FrameProcessor
from llm_adapter import LLMAdapter

logger = logging.getLogger(__name__)


class AudioInputProcessor(FrameProcessor):
    """
    Input processor that receives audio from an external queue.
    This is the proper way to inject frames into a Pipecat pipeline.
    """
    
    def __init__(self):
        super().__init__()
        self.audio_queue: asyncio.Queue = asyncio.Queue()
        self._running = True
    
    async def process_frame(self, frame, direction):
        """Pass through frames and also check our queue for new audio"""
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)
    
    async def run_input_loop(self):
        """Background task to read from queue and push frames"""
        logger.info("🎧 Audio input loop started")
        frame_count = 0
        while self._running:
            try:
                # Wait for audio with timeout to allow checking _running
                try:
                    audio_data, sample_rate, channels = await asyncio.wait_for(
                        self.audio_queue.get(), 
                        timeout=0.1
                    )
                except asyncio.TimeoutError:
                    continue

                frame = AudioRawFrame(
                    audio=audio_data,
                    sample_rate=sample_rate,
                    num_channels=channels
                )
                frame_count += 1
                if frame_count % 10 == 0:  # Log every 10th frame to reduce spam
                    logger.info(f"🔊 Pushed {frame_count} audio frames, latest: {len(audio_data)} bytes @ {sample_rate}Hz")
                await self.push_frame(frame, "downstream")
            except Exception as e:
                logger.error(f"Error in audio input loop: {e}", exc_info=True)
        
        logger.info(f"🎧 Audio input loop stopped (processed {frame_count} frames)")
    
    def stop(self):
        """Stop the input loop"""
        self._running = False
    
    async def queue_audio(self, audio_data: bytes, sample_rate: int = 16000, channels: int = 1):
        """Add audio to the queue for processing"""
        await self.audio_queue.put((audio_data, sample_rate, channels))


class WebSocketOutputProcessor(FrameProcessor):
    """Output processor that sends frames back to WebSocket"""
    
    def __init__(self, websocket):
        super().__init__()
        self.websocket = websocket
    
    async def process_frame(self, frame, direction):
        """Process frames and send to WebSocket"""
        await super().process_frame(frame, direction)
        
        try:
            from pipecat.frames.frames import TTSAudioRawFrame, TranscriptionFrame
            
            # Handle TTS audio frames - send to client in RTVI format
            if isinstance(frame, TTSAudioRawFrame) and frame.audio:
                try:
                    audio_base64 = base64.b64encode(frame.audio).decode('utf-8')
                    # Send RTVI-compatible message
                    await self.websocket.send_json({
                        "label": "rtvi-ai",
                        "type": "bot-output",
                        "data": {
                            "text": "",  # TTS doesn't have text
                            "spoken": True
                        },
                        "id": f"tts-{hash(frame.audio) % 1000000}"
                    })
                    # Also send audio in our format for compatibility
                    await self.websocket.send_json({
                        "type": "audio_response",
                        "audio": audio_base64,
                        "sampleRate": frame.sample_rate if hasattr(frame, 'sample_rate') else 24000,
                        "mimeType": "audio/pcm"
                    })
                    logger.info(f"🔈 Sent TTS audio: {len(frame.audio)} bytes")
                except Exception as e:
                    logger.error(f"Error sending audio: {e}")
            
            # Handle transcription frames - send in RTVI format
            if isinstance(frame, TranscriptionFrame):
                try:
                    # Send RTVI user-transcription message
                    await self.websocket.send_json({
                        "label": "rtvi-ai",
                        "type": "user-transcription",
                        "data": {
                            "text": frame.text,
                            "final": True,
                            "timestamp": __import__('datetime').datetime.utcnow().isoformat() + "Z",
                            "user_id": "user"
                        },
                        "id": f"trans-{hash(frame.text) % 1000000}"
                    })
                    # Also send in our format for compatibility
                    await self.websocket.send_json({
                        "type": "transcription",
                        "text": frame.text,
                        "isUser": True
                    })
                    logger.info(f"📝 Sent transcription: {frame.text[:50]}...")
                except Exception as e:
                    logger.error(f"Error sending transcription: {e}")
            
            # Handle text frames from LLM - send in RTVI format
            if isinstance(frame, TextFrame) and frame.text:
                try:
                    # Send RTVI bot-llm-text message
                    await self.websocket.send_json({
                        "label": "rtvi-ai",
                        "type": "bot-llm-text",
                        "data": {
                            "text": frame.text
                        },
                        "id": f"llm-{hash(frame.text) % 1000000}"
                    })
                    # Also send in our format
                    await self.websocket.send_json({
                        "type": "llm_response",
                        "text": frame.text
                    })
                    logger.info(f"💬 Sent LLM response: {frame.text[:50]}...")
                except Exception as e:
                    logger.error(f"Error sending LLM response: {e}")
        
        except Exception as e:
            logger.error(f"Error in output process_frame: {e}")
        
        # Always pass frame downstream
        await self.push_frame(frame, direction)


class CustomLLMProcessor(FrameProcessor):
    """
    Custom LLM processor that calls Node.js backend via LLMAdapter
    This replaces OpenAILLMService to use Gemini API from database
    """
    
    def __init__(
        self,
        llm_adapter: LLMAdapter,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
        api_key: Optional[str] = None,
        backend_url: Optional[str] = None
    ):
        super().__init__()
        self.llm_adapter = llm_adapter
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.api_key = api_key
        self.backend_url = backend_url
        
        # Conversation history for context
        self.conversation_history: List[Dict[str, str]] = []
    
    async def process_frame(self, frame, direction):
        """Process frames - handle user text and generate LLM response"""
        await super().process_frame(frame, direction)
        
        # Handle user text frames (from STT)
        if isinstance(frame, TextFrame) and frame.text:
            user_message = frame.text.strip()
            if user_message:
                logger.info(f"💬 User message: {user_message[:50]}...")
                
                # Add to conversation history
                self.conversation_history.append({
                    "role": "user",
                    "content": user_message
                })
                
                # Call LLM adapter
                try:
                    response = await self.llm_adapter.chat(
                        message=user_message,
                        history=self.conversation_history[:-1],  # Exclude current message
                        context_type="neural-chat",  # For brainstorming
                        conversation_id=self.conversation_id,
                        user_id=self.user_id,
                        api_key=self.api_key
                    )
                    
                    # Add assistant response to history
                    self.conversation_history.append({
                        "role": "assistant",
                        "content": response
                    })
                    
                    # Send response as TextFrame downstream
                    response_frame = TextFrame(text=response)
                    await self.push_frame(response_frame, direction)
                    logger.info(f"🤖 LLM response: {response[:50]}...")
                    
                except Exception as e:
                    logger.error(f"Error calling LLM adapter: {e}", exc_info=True)
                    # Send error message
                    error_frame = TextFrame(text="I'm sorry, I encountered an error. Please try again.")
                    await self.push_frame(error_frame, direction)
        
        # Pass all frames downstream
        await self.push_frame(frame, direction)


class PipecatBridge:
    """Bridge class to set up and manage Pipecat pipeline"""
    
    def __init__(
        self,
        websocket,
        api_key: str,
        stt_provider: str = "openai",
        tts_provider: str = "openai",
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
        backend_url: Optional[str] = None
    ):
        self.websocket = websocket
        self.api_key = api_key
        self.stt_provider = stt_provider
        self.tts_provider = tts_provider
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.backend_url = backend_url
        
        # Pipeline components
        self.audio_input = None
        self.output_processor = None
        self.stt_service = None
        self.llm_processor = None
        self.tts_service = None
        self.pipeline = None
        self.task = None
        self.runner = None
        self._input_task = None
        
    async def setup(self):
        """Set up the Pipecat pipeline"""
        try:
            # Create audio input processor (receives audio from queue)
            self.audio_input = AudioInputProcessor()
            
            # Create output processor (sends to WebSocket)
            self.output_processor = WebSocketOutputProcessor(self.websocket)
            
            # Initialize STT service (OpenAI Whisper)
            self.stt_service = OpenAISTTService(api_key=self.api_key)
            logger.info("✅ STT service initialized")
            
            # Initialize TTS service (OpenAI TTS)
            self.tts_service = OpenAITTSService(api_key=self.api_key, voice="alloy")
            logger.info("✅ TTS service initialized")
            
            # Initialize LLM adapter (calls Node.js backend for Gemini API)
            llm_adapter = LLMAdapter(backend_url=self.backend_url)
            logger.info("✅ LLM adapter initialized (calls Node.js backend)")
            
            # Create custom LLM processor that uses LLMAdapter
            self.llm_processor = CustomLLMProcessor(
                llm_adapter=llm_adapter,
                conversation_id=self.conversation_id,
                user_id=self.user_id,
                api_key=self.api_key,
                backend_url=self.backend_url
            )
            logger.info("✅ Custom LLM processor initialized (uses Gemini via backend)")
            
            # Build pipeline: AudioInput → STT → CustomLLM → TTS → Output
            self.pipeline = Pipeline([
                self.audio_input,      # Receives audio from queue
                self.stt_service,      # Speech to text (OpenAI Whisper)
                self.llm_processor,    # LLM (calls Node.js backend for Gemini)
                self.tts_service,      # Text to speech (OpenAI TTS)
                self.output_processor  # Send back to WebSocket
            ])
            
            # Create task
            self.task = PipelineTask(
                self.pipeline,
                idle_timeout_secs=None,
                enable_turn_tracking=False
            )
            
            # Create runner
            self.runner = PipelineRunner()
            
            logger.info("✅ Pipecat pipeline setup complete")
            
        except Exception as e:
            logger.error(f"❌ Error setting up Pipecat pipeline: {e}")
            raise
    
    async def start(self):
        """Start the pipeline and input loop"""
        if self.runner and self.task:
            try:
                # Start the input loop in background
                self._input_task = asyncio.create_task(self.audio_input.run_input_loop())
                
                # Run the pipeline (this blocks until pipeline ends)
                await self.runner.run(self.task)
                
            except asyncio.CancelledError:
                logger.info("Pipeline cancelled")
            except Exception as e:
                logger.error(f"Error running pipeline: {e}", exc_info=True)
                raise
    
    async def queue_audio(self, audio_data: bytes, sample_rate: int = 16000, channels: int = 1):
        """Queue audio for processing"""
        if self.audio_input:
            await self.audio_input.queue_audio(audio_data, sample_rate, channels)
    
    async def stop(self):
        """Stop the pipeline and cleanup"""
        # Stop input loop
        if self.audio_input:
            self.audio_input.stop()
        
        if self._input_task:
            self._input_task.cancel()
            try:
                await self._input_task
            except asyncio.CancelledError:
                pass
        
        if self.runner:
            try:
                await self.runner.cancel()
            except Exception as e:
                logger.error(f"Error cancelling runner: {e}")
        
        if self.task:
            try:
                await self.task.cancel()
            except Exception as e:
                logger.error(f"Error cancelling task: {e}")
