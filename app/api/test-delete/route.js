import { NextResponse } from 'next/server';

export async function DELETE(request) {
  return NextResponse.json({ message: 'DELETE method working' });
}

export async function GET(request) {
  return NextResponse.json({ message: 'GET method working' });
}

