import 'dotenv/config';

import app from './app.js';
import { connectDB } from './config/database.js';
import { startScheduler, stopScheduler } from './services/reminderService.js';
import logger from './utils/logger.js';
import mongoose from 'mongoose';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        docs: `http://localhost:${PORT}/api/docs`
      });
    });

    // Start scheduled reminder job
    startScheduler();

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        stopScheduler();

        process.exit(0);
      });

      // Force exit after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason: reason?.message || reason, promise });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
