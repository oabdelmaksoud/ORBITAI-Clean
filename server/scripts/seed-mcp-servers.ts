/**
 * Script to seed system MCP servers to database
 * Usage: npm run seed-mcp-servers
 * 
 * This is optional - system servers work without being in the database,
 * but seeding them provides consistency and easier management.
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { MCPServer } from '../src/models/MCPServer.model.js';
import { DEFAULT_MCP_SERVERS } from '../../../constants.js';

async function seedMCPServers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || config.mongodbUri;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Seed each system MCP server
    for (const serverData of DEFAULT_MCP_SERVERS) {
      const existing = await MCPServer.findOne({ id: serverData.id });
      
      if (existing) {
        // Update existing server
        existing.name = serverData.name;
        existing.description = serverData.description;
        existing.status = serverData.status;
        existing.source = 'system';
        existing.tools = serverData.tools;
        existing.config = {
          type: 'custom', // System servers use custom config
          endpoint: undefined,
          command: undefined,
          args: undefined,
          headers: undefined,
          apiKey: undefined
        };
        await existing.save();
        console.log(`✅ Updated system MCP server: ${serverData.name} (${serverData.id})`);
      } else {
        // Create new server
        const server = new MCPServer({
          id: serverData.id,
          name: serverData.name,
          description: serverData.description,
          status: serverData.status,
          source: 'system',
          tools: serverData.tools,
          config: {
            type: 'custom',
            endpoint: undefined,
            command: undefined,
            args: undefined,
            headers: undefined,
            apiKey: undefined
          },
          metadata: {
            createdBy: 'system',
            tags: ['system', 'default']
          }
        });
        await server.save();
        console.log(`✅ Created system MCP server: ${serverData.name} (${serverData.id})`);
      }
    }

    console.log(`\n✅ Successfully seeded ${DEFAULT_MCP_SERVERS.length} system MCP servers!`);
    console.log('\n📋 System MCP Servers:');
    DEFAULT_MCP_SERVERS.forEach(server => {
      console.log(`   - ${server.name} (${server.id}): ${server.tools.length} tools`);
    });

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to seed MCP servers:', error);
    process.exit(1);
  }
}

seedMCPServers();













