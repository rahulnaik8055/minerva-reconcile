import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('7d'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .optional(),
});
