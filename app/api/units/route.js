import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureGlobalUnitsCatalog } from '@/lib/ensureGlobalUnitsCatalog';

// GET /api/units - Fetch all base units and their associated units
export async function GET(request) {
  try {
    await ensureGlobalUnitsCatalog(prisma);
    const { searchParams } = new URL(request.url);
    const baseUnitId = searchParams.get('baseUnitId');
    const includeUnits = searchParams.get('includeUnits') === 'true';

    if (baseUnitId) {
      // Fetch specific base unit with its units
      const baseUnit = await prisma.baseUnit.findUnique({
        where: { id: baseUnitId },
        include: {
          units: {
            where: { isActive: true },
            orderBy: { isBaseUnit: 'desc' } // Base units first
          }
        }
      });

      if (!baseUnit) {
        return NextResponse.json(
          { error: 'Base unit not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ baseUnit });
    } else {
      // Fetch all base units
      const baseUnits = await prisma.baseUnit.findMany({
        orderBy: { displayName: 'asc' },
        include: includeUnits ? {
          units: {
            where: { isActive: true },
            orderBy: { isBaseUnit: 'desc' } // Base units first
          }
        } : false
      });

      return NextResponse.json({ baseUnits });
    }
  } catch (error) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}

// POST /api/units - Create a new custom unit
export async function POST(request) {
  try {
    await ensureGlobalUnitsCatalog(prisma);
    const body = await request.json();
    const { baseUnitId, name, symbol, conversionToBase } = body;

    // Validate required fields
    if (!baseUnitId || !name || !symbol || conversionToBase === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if symbol already exists
    const existingUnit = await prisma.unit.findUnique({
      where: { symbol }
    });

    if (existingUnit) {
      return NextResponse.json(
        { error: 'Unit symbol already exists' },
        { status: 409 }
      );
    }

    // Create the new unit
    const newUnit = await prisma.unit.create({
      data: {
        baseUnitId,
        name,
        symbol,
        conversionToBase: parseFloat(conversionToBase),
        isBaseUnit: false,
        isActive: true,
        isCatalogUnit: false
      },
      include: {
        baseUnit: true
      }
    });

    return NextResponse.json({ unit: newUnit }, { status: 201 });
  } catch (error) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: 'Failed to create unit' },
      { status: 500 }
    );
  }
}
