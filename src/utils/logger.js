import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'meeting-intelligence' },
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === 'test',
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, traceId, method, path, status, ...rest }) => {
          let log = `[${timestamp}] ${level}`;
          if (traceId) log += ` [trace:${traceId}]`;
          if (method && path) log += ` ${method} ${path}`;
          if (status) log += ` → ${status}`;
          log += `: ${message}`;
          const extra = Object.keys(rest).filter(k => k !== 'service').reduce((acc, k) => {
            acc[k] = rest[k];
            return acc;
          }, {});
          if (Object.keys(extra).length > 0) log += ` ${JSON.stringify(extra)}`;
          return log;
        })
      )
    })
  ]
});

export { logger };
export default logger;
