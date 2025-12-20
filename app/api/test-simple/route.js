import { NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json({ message: 'DELETE working' });
}

export async function POST() {
  return NextResponse.json({ message: 'POST working' });
}

export async function PUT() {
  return NextResponse.json({ message: 'PUT working' });
}

export async function GET() {
  return NextResponse.json({ message: 'GET working' });
}

