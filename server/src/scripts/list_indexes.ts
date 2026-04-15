
import mongoose from 'mongoose';
import { config } from '../config/env.js';

const listIndexes = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database.');

        const collection = mongoose.connection.collection('projects');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (error: unknown) {
        console.error('Error listing indexes:', error);
        process.exit(1);
    }
};

listIndexes();
