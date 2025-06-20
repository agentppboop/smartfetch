// validateEnv.js
const Joi = require('joi');
require('dotenv').config(); // loads .env variables

const envSchema = Joi.object({
  YOUTUBE_API_KEY: Joi.string().required().label('YOUTUBE_API_KEY'),
  NODE_ENV: Joi.string().valid('development', 'production').default('development'),
  PORT: Joi.number().default(3000),
}).unknown(); // allow extra vars

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  console.error(`❌ Env validation error: ${error.message}`);
  process.exit(1); // exit app
}

module.exports = envVars;
