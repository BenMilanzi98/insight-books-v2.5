import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('Test subscription delete endpoint called');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    if (body.action === 'delete') {
      console.log('Delete action detected');
      return NextResponse.json({
        success: true,
        message: 'Test delete action successful',
        action: 'delete',
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working',
      receivedAction: body.action,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request) {
  return NextResponse.json({
    success: true,
    message: 'Test subscription delete endpoint is working',
    methods: ['GET', 'POST'],
    timestamp: new Date().toISOString()
  });
}
