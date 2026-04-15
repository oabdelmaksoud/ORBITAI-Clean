
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const fixIndexes = async () => {
    try {
        logger.info('Connecting to database...');
        await mongoose.connect(config.mongodbUri);
        logger.info('Connected to database.');

        const collection = mongoose.connection.collection('projects');
        const indexes = await collection.indexes();

        logger.info('Current indexes:', indexes);

        const idIndex = indexes.find(idx => idx.name === 'id_1');

        if (idIndex) {
            logger.info("Found problematic index 'id_1'. Dropping it...");
            await collection.dropIndex('id_1');
            logger.info("Successfully dropped 'id_1' index.");
        } else {
            logger.info("Index 'id_1' not found. No action needed.");
        }

    } catch (error) {
        logger.error('Error fixing indexes:', error);
    } finally {
        await mongoose.disconnect();
        logger.info('Disconnected from database.');
        process.exit(0);
    }
};

fixIndexes();
