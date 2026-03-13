# Pipecat Voice Service

Real-time voice conversation service for brainstorming using Pipecat framework.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

Or using uv (recommended):
```bash
uv pip install -r requirements.txt
```

2. Set environment variables (optional, defaults provided):
```bash
export PIPECAT_HOST=0.0.0.0
export PIPECAT_PORT=8000
export BACKEND_URL=http://localhost:3001
export STT_PROVIDER=openai
export TTS_PROVIDER=openai
```

3. Run the service:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Health Check
```
GET /health
```

### List Sessions
```
GET /sessions
```

### Delete Session
```
DELETE /sessions/{session_id}
```

### WebSocket Connection
```
WS /ws/{session_id}?api_key=xxx&conversation_id=xxx&user_id=xxx
```

## Architecture

The service uses Pipecat to create a pipeline:
- **STT (Speech-to-Text)**: Converts audio to text
- **LLM**: Processes text via Node.js backend LLMRouter
- **TTS (Text-to-Speech)**: Converts response to audio

## Integration

The service integrates with the Node.js backend:
- Calls `/api/llm/chat` for LLM responses
- Uses existing LLMRouter for intelligent model selection
- Retrieves API keys from Node.js backend (passed via WebSocket)


