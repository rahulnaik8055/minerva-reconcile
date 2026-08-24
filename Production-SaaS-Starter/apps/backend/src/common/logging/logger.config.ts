import { ConfigService } from '@nestjs/config';
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

export function createLoggerConfig(configService: ConfigService): WinstonModuleOptions {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const logLevel = configService.get<string>('LOG_LEVEL');

  const developmentFormat = combine(
    colorize(),
    timestamp(),
    errors({ stack: true }),
    printf(({ timestamp: ts, level, message, context, stack }) => {
      const contextStr = context ? `[${context}] ` : '';
      const stackStr = stack ? `\n${stack}` : '';
      return `${ts} ${level}: ${contextStr}${message}${stackStr}`;
    }),
  );

  const jsonFormat = combine(timestamp(), errors({ stack: true }), json());

  return {
    level: logLevel || (isProduction ? 'info' : 'debug'),
    transports: [
      new winston.transports.Console({
        format: isProduction ? jsonFormat : developmentFormat,
      }),
    ],
    exitOnError: false,
  };
}
