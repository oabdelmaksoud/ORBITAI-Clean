// Simple script to add Gemini API key to MongoDB
const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption configuration (matching server/src/config/index.ts)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here';
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf-8').slice(0, 32), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function addApiKey() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/orbitai';
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected');

        const ApiKey = mongoose.model('ApiKey', new mongoose.Schema({
            provider: String,
            key: String,
            scope: { type: String, enum: ['platform', 'user'], default: 'platform' },
            isActive: { type: Boolean, default: true },
            userId: mongoose.Schema.Types.ObjectId,
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        }), 'apikeys');

        const encryptedKey = encrypt('AIzaSyDuSVgFxc6fNY7kU__tOJT6is9Vg6svNVE');

        // Remove existing Gemini key if any
        await ApiKey.deleteMany({ provider: 'gemini', scope: 'platform' });

        // Add new key
        await ApiKey.create({
            provider: 'gemini',
            key: encryptedKey,
            scope: 'platform',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log('✅ Gemini API key added successfully!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addApiKey();
