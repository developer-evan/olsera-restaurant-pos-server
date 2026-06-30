import mongoose from 'mongoose';

let usesMemoryServer = false;
let memoryServer: { stop: () => Promise<boolean> } | null = null;

const COLLECTIONS = [
  'users',
  'refresh_tokens',
  'organizations',
  'organization_members',
  'stores',
  'store_memberships',
  'store_invites',
];

export async function setupTestDatabase(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      process.env.MONGODB_URI = memoryServer.getUri();
      usesMemoryServer = true;
    } catch {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/olsera_pos_test';
    }
  }

  await mongoose.connect(process.env.MONGODB_URI);

  for (const collection of COLLECTIONS) {
    await mongoose.connection.collection(collection).deleteMany({});
  }

  await mongoose.disconnect();
}

export async function teardownTestDatabase(): Promise<void> {
  if (usesMemoryServer && memoryServer) {
    await memoryServer.stop();
  }
}
