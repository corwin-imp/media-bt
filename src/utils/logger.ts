import winston from 'winston';

export function setupLogging(debug: boolean = false): void {
  const level = debug ? 'debug' : 'info';
  
  winston.configure({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} | ${level.toUpperCase()} | ${message} ${metaStr}`;
      })
    ),
    transports: [
      new winston.transports.Console()
    ]
  });
}

export const logger = winston;