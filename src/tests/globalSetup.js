import { MongoMemoryServer } from 'mongodb-memory-server';

export default async () => {
  const mongoServer = await MongoMemoryServer.create({
    binary: { version: '7.0.14' }
  });
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test_jwt_secret_for_testing';
  process.env.NODE_ENV = 'test';
  global.__MONGO_SERVER__ = mongoServer;
};
