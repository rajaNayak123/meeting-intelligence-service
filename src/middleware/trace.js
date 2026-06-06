const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const traceMiddleware = (req, res, next) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  res.locals.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  const startTime = Date.now();

  logger.info('Incoming request', {
    traceId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      traceId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

module.exports = traceMiddleware;
