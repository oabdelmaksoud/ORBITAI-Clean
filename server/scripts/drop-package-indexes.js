const mongoose = require('mongoose');
const { config } = require('../src/config/env.js');

async function dropIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || config.mongodbUri);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('packages');
    
    // Drop old id index
    try {
      await collection.dropIndex('id_1');
      console.log('✅ Dropped id_1 index');
    } catch (e) {
      console.log('ℹ️  id_1 index not found or already dropped');
    }
    
    // Drop old name index if exists
    try {
      await collection.dropIndex('name_1');
      console.log('✅ Dropped name_1 index');
    } catch (e) {
      console.log('ℹ️  name_1 index not found or already dropped');
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

dropIndexes();
