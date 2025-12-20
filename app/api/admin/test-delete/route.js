import { NextResponse } from 'next/server';

export async function DELETE(request) {
  console.log('Test DELETE endpoint called');
  
  return NextResponse.json({
    success: true,
    message: 'DELETE method is working',
    timestamp: new Date().toISOString()
  });
}

export async function GET(request) {
  return NextResponse.json({
    success: true,
    message: 'Test endpoint is working',
    methods: ['GET', 'DELETE']
  });
}
