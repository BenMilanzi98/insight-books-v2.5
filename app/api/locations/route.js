import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch locations for a tenant
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get unique locations from existing products
    const productLocations = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isDeleted: false
      },
      select: {
        location: true
      },
      distinct: ['location']
    });

    // Extract unique locations from existing products only
    const existingLocations = productLocations.map(item => item.location).filter(Boolean);
    
    // Only return locations that have been actually used (no default options)
    const locations = existingLocations.sort();

    return NextResponse.json({
      locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

// POST - Create a new location (for future use if we want dedicated location management)
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      );
    }

    // For now, we'll just return success since locations are stored with inventory items
    // In the future, we could create a dedicated Location model
    const location = {
      id: `location-${Date.now()}`,
      name: name.trim(),
      description: description || null
    };

    return NextResponse.json({
      location,
      message: 'Location created successfully'
    });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}
