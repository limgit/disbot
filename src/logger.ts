import Winston from 'winston';

const logger = Winston.createLogger({
  level: 'info',
  format: Winston.format.combine(
    Winston.format.timestamp(),
    Winston.format.printf(({ level, message, timestamp }) => (
      `${timestamp} [${level.toUpperCase()}] ${message}`
    )),
  ),
  transports: [
    new Winston.transports.Console(),
  ],
});

export default logger;
