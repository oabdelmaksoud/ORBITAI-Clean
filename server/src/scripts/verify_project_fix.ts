
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Project } from '../models/Project.model.js';

const verifyFix = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database.');

        // List indexes first
        const collection = mongoose.connection.collection('projects');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        // Create a test project
        console.log('Attempting to create a test project...');
        const testProject = {
            userId: 'test-user-' + Date.now(),
            name: 'Test Project ' + Date.now(),
            description: 'Test Description',
            currentPhase: 'Initiation',
            currentSprint: 1,
            methodology: 'Agile',
            status: 'draft',
            created_at: new Date(),
            updated_at: new Date()
        };

        const project = await Project.create(testProject);
        console.log('✅ Project created successfully:', project._id);

        // Clean up
        await Project.deleteOne({ _id: project._id });
        console.log('Test project deleted.');

        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (error) {
        console.error('❌ Error verifying fix:', error);
        process.exit(1);
    }
};

verifyFix();
