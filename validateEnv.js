// validateEnv.js - COMPLETE CORRECTED VERSION

const Joi = require('joi');

require('dotenv').config(); // loads .env variables

const envSchema = Joi.object({
    // Required APIs
    YOUTUBE_API_KEY: Joi.string().required().label('YOUTUBE_API_KEY'),
    
    // Optional APIs
    OPENAI_API_KEY: Joi.string().optional().label('OPENAI_API_KEY'),
    
    // Google Sheets integration (all or none)
    GOOGLE_SHEET_ID: Joi.string().optional().label('GOOGLE_SHEET_ID'),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: Joi.string().email().optional().label('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    GOOGLE_PRIVATE_KEY: Joi.string().optional().label('GOOGLE_PRIVATE_KEY'),
    
    // Application settings
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    
}).unknown(); // allow extra vars

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    console.error(`❌ Env validation error: ${error.message}`);
    console.error('\n📝 Required environment variables:');
    console.error('   YOUTUBE_API_KEY - Get from Google Cloud Console');
    console.error('\n🔧 Optional environment variables:');
    console.error('   OPENAI_API_KEY - For AI-powered code extraction');
    console.error('   GOOGLE_SHEET_ID - For syncing results to Google Sheets');
    process.exit(1);
} // ← ADD THIS MISSING CLOSING BRACE

console.log('✅ Environment variables validated successfully');

module.exports = envVars;
