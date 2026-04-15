
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Project } from '../models/Project.model.js';

const syncIndexes = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(config.mongodbUri);
        console.log(`Connected to database: ${mongoose.connection.name} at ${mongoose.connection.host}`);

        // Log what Mongoose thinks the indexes should be
        console.log('Schema Indexes:', JSON.stringify(Project.schema.indexes(), null, 2));

        // Log actual indexes before sync
        const collection = mongoose.connection.collection('projects');
        const indexesBefore = await collection.indexes();
        console.log('Actual Indexes (Before):', JSON.stringify(indexesBefore, null, 2));

        // Sync indexes
        console.log('Syncing indexes...');
        const result = await Project.syncIndexes();
        console.log('Sync Result (Dropped/Created):', JSON.stringify(result, null, 2));

        // Log actual indexes after sync
        const indexesAfter = await collection.indexes();
        console.log('Actual Indexes (After):', JSON.stringify(indexesAfter, null, 2));

        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (error: unknown) {
        console.error('Error syncing indexes:', error);
        process.exit(1);
    }
};

syncIndexes();
