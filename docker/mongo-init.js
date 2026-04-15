// MongoDB initialization script
// Runs once on first startup to create the application database user
// Environment variables are injected by Docker Compose
db = db.getSiblingDB('orbitai');

db.createUser({
  user: process.env.MONGO_USERNAME,
  pwd: process.env.MONGO_PASSWORD,
  roles: [{ role: 'readWrite', db: 'orbitai' }],
});

// Create initial indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.projects.createIndex({ userId: 1, createdAt: -1 });
db.tasks.createIndex({ projectId: 1, status: 1 });
db.agents.createIndex({ projectId: 1 });
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
