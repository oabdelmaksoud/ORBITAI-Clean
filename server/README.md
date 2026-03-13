# OrbitAI Backend Server

Cloud infrastructure backend for OrbitAI platform.

## Features

- 🔐 JWT-based authentication
- 📦 Project management (CRUD operations)
- 🤖 Agent task execution
- 📝 Task management
- 📎 Artifact/file uploads
- 📊 Health monitoring
- 🛡️ Rate limiting & security middleware
- 🐳 Docker & Docker Compose support
- 📝 MongoDB integration

## Prerequisites

- Node.js 20+
- MongoDB 7.0+ (or use Docker Compose)
- Gemini API key

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `TEST_MONGODB_URI` - Test database connection string (separate from production)
- `JWT_SECRET` - Secret for JWT tokens
- `GEMINI_API_KEY` - Google Gemini API key (optional - can be stored in database via Admin Console)

**Important:** Always use a separate test database (`TEST_MONGODB_URI`) to prevent test data from polluting your production database. See [TEST_DATABASE_SETUP.md](./TEST_DATABASE_SETUP.md) for details.

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This will start:
- MongoDB on port 27017
- Backend API on port 3001

### Environment Variables for Docker

Create a `.env` file in the `server` directory:

```env
NODE_ENV=production
MONGODB_URI=mongodb://admin:password@mongodb:27017/orbitai?authSource=admin
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-api-key
FRONTEND_URL=http://localhost:5173
MONGO_USERNAME=admin
MONGO_PASSWORD=password
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - Get all projects (auth required)
- `GET /api/projects/:id` - Get single project (auth required)
- `POST /api/projects` - Create project (auth required)
- `PUT /api/projects/:id` - Update project (auth required)
- `DELETE /api/projects/:id` - Delete project (auth required)

### Agents
- `POST /api/agents/execute` - Execute agent task (auth required)
- `GET /api/agents/status/:agentId` - Get agent status (auth required)

### Tasks
- `PATCH /api/tasks/:projectId/:taskId` - Update task (auth required)

### Artifacts
- `POST /api/artifacts/upload/:projectId` - Upload artifact (auth required)

### Health
- `GET /api/health` - API health check
- `GET /api/health/detailed` - Detailed health information

## Project Structure

```
server/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── index.ts         # Entry point
├── logs/                # Application logs
├── Dockerfile           # Docker image configuration
├── docker-compose.yml   # Docker Compose configuration
└── package.json
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
```

**Important:** Tests require `TEST_MONGODB_URI` to be set in your `.env` file. Tests will fail if they try to use the production database. See [TEST_DATABASE_SETUP.md](./TEST_DATABASE_SETUP.md) for setup instructions.

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- JWT authentication
- Password hashing with bcrypt
- Input validation

## Logging

Logs are written to:
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

Log level can be configured via `LOG_LEVEL` environment variable.

## License

MIT

