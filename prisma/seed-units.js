const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Comprehensive unit system data
const baseUnitsData = [
  {
    name: 'mass',
    displayName: 'Mass (Weight)',
    description: 'Weight-based measurements for products sold by mass',
    baseUnit: 'kg',
    units: [
      { name: 'Kilogram', symbol: 'kg', conversionToBase: 1, isBaseUnit: true },
      { name: 'Gram', symbol: 'g', conversionToBase: 1000 },
      { name: 'Pound', symbol: 'lb', conversionToBase: 2.20462 },
      { name: 'Ounce', symbol: 'oz', conversionToBase: 35.274 },
      { name: 'Metric Ton', symbol: 't', conversionToBase: 0.001 },
      { name: 'Stone', symbol: 'st', conversionToBase: 0.157473 },
      { name: 'Grain', symbol: 'grain', conversionToBase: 15432.4 },
    ]
  },
  {
    name: 'length',
    displayName: 'Length (Distance)',
    description: 'Distance-based measurements for products sold by length',
    baseUnit: 'm',
    units: [
      { name: 'Meter', symbol: 'm', conversionToBase: 1, isBaseUnit: true },
      { name: 'Centimeter', symbol: 'cm', conversionToBase: 100 },
      { name: 'Millimeter', symbol: 'mm', conversionToBase: 1000 },
      { name: 'Kilometer', symbol: 'km', conversionToBase: 0.001 },
      { name: 'Inch', symbol: 'in', conversionToBase: 39.3701 },
      { name: 'Foot', symbol: 'ft', conversionToBase: 3.28084 },
      { name: 'Yard', symbol: 'yd', conversionToBase: 1.09361 },
      { name: 'Mile', symbol: 'mi', conversionToBase: 0.000621371 },
    ]
  },
  {
    name: 'volume',
    displayName: 'Volume (Liquid)',
    description: 'Volume-based measurements for liquids and bulk materials',
    baseUnit: 'L',
    units: [
      { name: 'Liter', symbol: 'L', conversionToBase: 1, isBaseUnit: true },
      { name: 'Milliliter', symbol: 'mL', conversionToBase: 1000 },
      { name: 'Gallon (US)', symbol: 'gal_us', conversionToBase: 0.264172 },
      { name: 'Gallon (UK)', symbol: 'gal_uk', conversionToBase: 0.219969 },
      { name: 'Cubic Meter', symbol: 'm³', conversionToBase: 0.001 },
      { name: 'Fluid Ounce', symbol: 'fl oz', conversionToBase: 33.814 },
      { name: 'Pint', symbol: 'pt', conversionToBase: 2.11338 },
      { name: 'Quart', symbol: 'qt', conversionToBase: 1.05669 },
      { name: 'Cup', symbol: 'cup', conversionToBase: 4.22675 },
    ]
  },
  {
    name: 'area',
    displayName: 'Area (Surface)',
    description: 'Surface area measurements for materials sold by coverage',
    baseUnit: 'm²',
    units: [
      { name: 'Square Meter', symbol: 'm²', conversionToBase: 1, isBaseUnit: true },
      { name: 'Square Centimeter', symbol: 'cm²', conversionToBase: 10000 },
      { name: 'Square Foot', symbol: 'ft²', conversionToBase: 10.7639 },
      { name: 'Square Inch', symbol: 'in²', conversionToBase: 1550 },
      { name: 'Hectare', symbol: 'ha', conversionToBase: 0.0001 },
      { name: 'Acre', symbol: 'acre', conversionToBase: 0.000247105 },
      { name: 'Square Yard', symbol: 'yd²', conversionToBase: 1.19599 },
    ]
  },
  {
    name: 'count',
    displayName: 'Count (Discrete)',
    description: 'Discrete item counts for products sold individually',
    baseUnit: 'pcs',
    units: [
      { name: 'Piece', symbol: 'pcs', conversionToBase: 1, isBaseUnit: true },
      { name: 'Dozen', symbol: 'dz', conversionToBase: 0.083333 },
      { name: 'Gross', symbol: 'gross', conversionToBase: 0.006944 },
      { name: 'Pair', symbol: 'pair', conversionToBase: 0.5 },
      { name: 'Set', symbol: 'set', conversionToBase: 1 }, // Variable, user-defined
      { name: 'Pack', symbol: 'pack', conversionToBase: 1 }, // Variable, user-defined
      { name: 'Box', symbol: 'box', conversionToBase: 1 }, // Variable, user-defined
      { name: 'Bundle', symbol: 'bundle', conversionToBase: 1 }, // Variable, user-defined
    ]
  },
  {
    name: 'energy',
    displayName: 'Energy (Power)',
    description: 'Energy and power measurements for electrical products',
    baseUnit: 'W',
    units: [
      { name: 'Watt', symbol: 'W', conversionToBase: 1, isBaseUnit: true },
      { name: 'Kilowatt', symbol: 'kW', conversionToBase: 0.001 },
      { name: 'Megawatt', symbol: 'MW', conversionToBase: 0.000001 },
      { name: 'Horsepower', symbol: 'hp', conversionToBase: 0.001341 },
      { name: 'BTU per Hour', symbol: 'BTU/h', conversionToBase: 3.41214 },
    ]
  },
  {
    name: 'temperature',
    displayName: 'Temperature',
    description: 'Temperature measurements for products with temperature requirements',
    baseUnit: '°C',
    units: [
      { name: 'Celsius', symbol: '°C', conversionToBase: 1, isBaseUnit: true },
      { name: 'Fahrenheit', symbol: '°F', conversionToBase: 1 }, // Special conversion
      { name: 'Kelvin', symbol: 'K', conversionToBase: 1 }, // Special conversion
    ]
  },
  {
    name: 'time',
    displayName: 'Time (Duration)',
    description: 'Time-based measurements for services and rentals',
    baseUnit: 'h',
    units: [
      { name: 'Hour', symbol: 'h', conversionToBase: 1, isBaseUnit: true },
      { name: 'Minute', symbol: 'min', conversionToBase: 60 },
      { name: 'Second', symbol: 's', conversionToBase: 3600 },
      { name: 'Day', symbol: 'day', conversionToBase: 0.0416667 },
      { name: 'Week', symbol: 'week', conversionToBase: 0.00595238 },
      { name: 'Month', symbol: 'month', conversionToBase: 0.00136986 },
      { name: 'Year', symbol: 'year', conversionToBase: 0.000114155 },
    ]
  },
  {
    name: 'pressure',
    displayName: 'Pressure',
    description: 'Pressure measurements for industrial and technical products',
    baseUnit: 'Pa',
    units: [
      { name: 'Pascal', symbol: 'Pa', conversionToBase: 1, isBaseUnit: true },
      { name: 'Kilopascal', symbol: 'kPa', conversionToBase: 0.001 },
      { name: 'Bar', symbol: 'bar', conversionToBase: 0.00001 },
      { name: 'PSI', symbol: 'psi', conversionToBase: 0.000145038 },
      { name: 'Atmosphere', symbol: 'atm', conversionToBase: 0.00000986923 },
    ]
  },
  {
    name: 'custom',
    displayName: 'Custom Units',
    description: 'User-defined custom units for specialized products',
    baseUnit: 'unit',
    units: [
      { name: 'Unit', symbol: 'unit', conversionToBase: 1, isBaseUnit: true },
    ]
  }
];

async function seedUnits() {
  console.log('🌱 Starting unit system seeding...');

  try {
    // Clear existing data
    await prisma.productUnit.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.baseUnit.deleteMany();
    console.log('✅ Cleared existing unit data');

    // Create base units and their associated units
    for (const baseUnitData of baseUnitsData) {
      const { units, ...baseUnitInfo } = baseUnitData;
      
      // Create base unit
      const baseUnit = await prisma.baseUnit.create({
        data: baseUnitInfo
      });
      
      console.log(`📦 Created base unit: ${baseUnit.displayName}`);

      // Create units for this base unit
      for (const unitData of units) {
        await prisma.unit.create({
          data: {
            ...unitData,
            baseUnitId: baseUnit.id
          }
        });
      }
      
      console.log(`  ✅ Created ${units.length} units for ${baseUnit.displayName}`);
    }

    console.log('🎉 Unit system seeding completed successfully!');
    console.log(`📊 Created ${baseUnitsData.length} base units with ${baseUnitsData.reduce((total, bu) => total + bu.units.length, 0)} total units`);

  } catch (error) {
    console.error('❌ Error seeding units:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
if (require.main === module) {
  seedUnits()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedUnits };
