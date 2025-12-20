import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const batchName = formData.get('batchName') || `Client-Bulk-${Date.now()}`;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read and parse CSV content
    let csvText = await file.text();
    
    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }
    
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Parse header and validate
    const actualHeaders = lines[0].split(',').map(h => h.replace(/"/g, '').replace(/\r/g, '').trim());
    
    // Create header mapping - find each expected header in the actual headers
    const headerMapping = {};
    const expectedHeaders = ['Client Name', 'Email', 'Phone', 'Address', 'Contact Person'];
    
    // Simple approach - map by position first, then by name matching
    actualHeaders.forEach((header, index) => {
      const cleanHeader = header.trim();
      // Direct match
      if (expectedHeaders.includes(cleanHeader)) {
        headerMapping[cleanHeader] = index;
      }
      // Case insensitive match
      else {
        const matchedExpected = expectedHeaders.find(expected => 
          expected.toLowerCase() === cleanHeader.toLowerCase()
        );
        if (matchedExpected) {
          headerMapping[matchedExpected] = index;
        }
      }
    });

    // Debug logging
    console.log('Raw line:', lines[0]);
    console.log('Actual headers:', actualHeaders);
    console.log('Header mapping:', headerMapping);

    // Check if required "Client Name" column exists
    const hasClientName = headerMapping['Client Name'] !== undefined;
    
    if (!hasClientName) {
      return NextResponse.json(
        { 
          error: `CSV must contain "Client Name" column. Found headers: ${actualHeaders.join(', ')}`,
          actualHeaders: actualHeaders,
          expectedHeaders: expectedHeaders,
          headerMapping: headerMapping,
          rawFirstLine: lines[0]
        },
        { status: 400 }
      );
    }

    // Parse and validate data rows
    const validClients = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const values = lines[i].split(',').map(val => val.replace(/"/g, '').replace(/\r/g, '').trim());
      const rowErrors = [];

      // Extract values
      const clientName = values[headerMapping['Client Name']] || '';
      const email = values[headerMapping['Email']] || '';
      const phone = values[headerMapping['Phone']] || '';
      const address = values[headerMapping['Address']] || '';
      const contactPerson = values[headerMapping['Contact Person']] || '';

      // Validate required fields
      if (!clientName.trim()) {
        rowErrors.push('Client Name is required');
      }

      // Validate email format if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowErrors.push('Invalid email format');
      }

      // Validate phone format if provided (basic validation)
      if (phone && !/^[\+]?[\d\s\-\(\)]{7,}$/.test(phone)) {
        rowErrors.push('Invalid phone format');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: rowErrors
        });
      } else {
        validClients.push({
          name: clientName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          contactPerson: contactPerson.trim() || null
        });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors: errors,
        message: `Found ${errors.length} validation error(s). Please fix them and try again.`
      });
    }

    // Check for duplicate names within the batch
    const nameSet = new Set();
    const duplicates = [];
    validClients.forEach((client, index) => {
      if (nameSet.has(client.name.toLowerCase())) {
        duplicates.push(`Row ${index + 2}: Duplicate client name "${client.name}"`);
      } else {
        nameSet.add(client.name.toLowerCase());
      }
    });

    if (duplicates.length > 0) {
      return NextResponse.json({
        success: false,
        errors: duplicates.map((dup, index) => ({
          row: index + 2,
          errors: [dup]
        })),
        message: 'Duplicate client names found in the batch'
      });
    }

    // Check for existing clients with same names
    const existingClients = await prisma.client.findMany({
      where: {
        tenantId: user.tenantId,
        name: {
          in: validClients.map(c => c.name)
        }
      },
      select: { name: true }
    });

    if (existingClients.length > 0) {
      const existingNames = existingClients.map(c => c.name);
      return NextResponse.json({
        success: false,
        errors: existingNames.map((name, index) => ({
          row: index + 2,
          errors: [`Client "${name}" already exists`]
        })),
        message: 'Some clients already exist in the system'
      });
    }

    // Process valid clients in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const createdClients = [];

      for (const clientData of validClients) {
        // Create client record
        const client = await tx.client.create({
          data: {
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            address: clientData.address,
            contactPerson: clientData.contactPerson,
            tenantId: user.tenantId
          }
        });

        createdClients.push(client);
      }

      return { createdClients };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${results.createdClients.length} clients`,
      batchName,
      totalProcessed: results.createdClients.length,
      clients: results.createdClients.map(client => ({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        contactPerson: client.contactPerson
      }))
    });

  } catch (error) {
    console.error('Error processing client bulk upload:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk upload. Please try again.' },
      { status: 500 }
    );
  }
}
