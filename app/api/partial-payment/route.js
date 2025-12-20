import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      message: 'Partial payment endpoint is working!',
      receivedData: body
    }, { status: 200 });

  } catch (error) {
    console.error('Error in partial payment:', error);
    return NextResponse.json(
      { error: 'Failed to process partial payment' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    return NextResponse.json({
      message: 'Payment history endpoint is working!'
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
