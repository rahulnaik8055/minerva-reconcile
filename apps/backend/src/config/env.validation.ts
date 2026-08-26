import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  CLERK_SECRET_KEY: Joi.string().required(),
  AICREDITS_API_KEY: Joi.string().optional(),
  AICREDITS_MODEL: Joi.string().optional(),
  AICREDITS_BASE_URL: Joi.string().uri().optional(),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .optional(),
});
