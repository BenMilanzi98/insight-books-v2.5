// app/api/debug-env/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  // Get all environment variables
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET',
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_SECURE: process.env.EMAIL_SECURE,
    EMAIL_PORT: process.env.EMAIL_PORT
  };

  // Check if we're in production mode
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check if email configuration is available
  const hasEmailConfig = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  
  // Get all process.env keys for debugging
  const allEnvKeys = Object.keys(process.env).filter(key => 
    key.includes('NODE_ENV') || key.includes('EMAIL_')
  );

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      isProduction,
      allEnvKeys
    },
    emailConfig: envVars,
    analysis: {
      hasEmailConfig,
      willUseHostinger: hasEmailConfig,
      willUseEthereal: !hasEmailConfig,
      missingVars: Object.entries(envVars)
        .filter(([key, value]) => !value || value === 'NOT SET')
        .map(([key]) => key)
    }
  });
} 