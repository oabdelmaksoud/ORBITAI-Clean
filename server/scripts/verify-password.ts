
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

async function verifyPassword() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/orbitai';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB at', mongoUri);

        const email = 'admin@orbitai.com';
        const password = 'password123';

        console.log(`Searching for user: ${email}`);
        // Explicitly select password since it's select: false in schema
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            console.error('❌ User not found!');
            const allUsers = await User.find({}, 'email role plan');
            console.log('Available users:', allUsers);
        } else {
            console.log('✅ User found:', { id: user._id, email: user.email, hasPassword: !!user.password });

            console.log('Testing password comparison...');
            const isMatch = await user.comparePassword(password);

            if (isMatch) {
                console.log('✅ Password match: SUCCESS');
            } else {
                console.error('❌ Password match: FAILED');
                console.log('Stored hash:', user.password.substring(0, 20) + '...');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyPassword();
