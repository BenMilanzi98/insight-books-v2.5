import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getPublicAppBaseUrlForEmail } from '@/lib/publicAppUrl';

export async function GET(request) {
  try {
    const appUrl = getPublicAppBaseUrlForEmail({
      forwardedProto: request.headers.get('x-forwarded-proto'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    });

    // Check for required environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('Google OAuth: Missing required environment variables');
      console.error('GOOGLE_CLIENT_ID:', clientId ? 'Set' : 'Missing');
      console.error('GOOGLE_CLIENT_SECRET:', clientSecret ? 'Set' : 'Missing');
      return NextResponse.redirect(
        `${appUrl}/auth/signup?error=oauth_config_missing`
      );
    }

    // Set up redirect URI
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    console.log('Google OAuth Configuration:');
    console.log('Client ID:', clientId ? 'Set' : 'Missing');
    console.log('Client Secret:', clientSecret ? 'Set' : 'Missing');
    console.log('Redirect URI:', redirectUri);

    // Initialize Google OAuth client
    const googleClient = new OAuth2Client(clientId, clientSecret, redirectUri);

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'signup';
    
    // Generate Google OAuth URL
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: mode === 'signup' ? 'consent' : 'select_account',
      state: Buffer.from(JSON.stringify({ mode })).toString('base64'),
      redirect_uri: redirectUri, // Explicitly set redirect_uri
      // Add login_hint for signup to encourage new account creation
      ...(mode === 'signup' && { login_hint: '' })
    });

    console.log('Generated Auth URL:', authUrl.substring(0, 100) + '...');

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    const appUrl = getPublicAppBaseUrlForEmail({
      forwardedProto: request.headers.get('x-forwarded-proto'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    });
    return NextResponse.redirect(
      `${appUrl}/auth/signup?error=oauth_init_failed&details=${encodeURIComponent(error.message)}`
    );
  }
} 