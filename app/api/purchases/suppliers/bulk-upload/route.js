import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

async function nextSupplierCode(tx) {
  let seq = (await tx.supplier.count()) + 1;
  let code = `SUP-${String(seq).padStart(4, '0')}`;
  while (await tx.supplier.findUnique({ where: { supplierCode: code } })) {
    seq += 1;
    code = `SUP-${String(seq).padStart(4, '0')}`;
  }
  return code;
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'suppliers.create');
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    let csvText = await file.text();
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

    const lines = csvText.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must contain at least a header row and one data row' },
        { status: 400 },
      );
    }

    const actualHeaders = lines[0].split(',').map((h) => h.replace(/"/g, '').replace(/\r/g, '').trim());
    const expectedHeaders = ['Supplier Name', 'Email', 'Phone', 'Address', 'Contact Person'];
    const headerMapping = {};
    actualHeaders.forEach((header, index) => {
      const matched = expectedHeaders.find((expected) => expected.toLowerCase() === header.toLowerCase());
      if (matched) headerMapping[matched] = index;
    });

    if (headerMapping['Supplier Name'] === undefined) {
      return NextResponse.json(
        {
          error: `CSV must contain "Supplier Name" column. Found headers: ${actualHeaders.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const validSuppliers = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const values = lines[i].split(',').map((val) => val.replace(/"/g, '').replace(/\r/g, '').trim());
      const rowErrors = [];
      const supplierName = values[headerMapping['Supplier Name']] || '';
      const email = values[headerMapping['Email']] || '';
      const phone = values[headerMapping['Phone']] || '';
      const address = values[headerMapping['Address']] || '';
      const contactPerson = values[headerMapping['Contact Person']] || '';

      if (!supplierName.trim()) rowErrors.push('Supplier Name is required');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push('Invalid email format');

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, errors: rowErrors });
      } else {
        validSuppliers.push({
          supplierName: supplierName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          contactPerson: contactPerson.trim() || null,
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors,
        message: `Found ${errors.length} validation error(s). Please fix them and try again.`,
      });
    }

    const nameSet = new Set();
    const duplicates = [];
    validSuppliers.forEach((supplier) => {
      const key = supplier.supplierName.toLowerCase();
      if (nameSet.has(key)) duplicates.push(supplier.supplierName);
      else nameSet.add(key);
    });
    if (duplicates.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Duplicate supplier names found in the batch',
        errors: duplicates.map((name) => ({ errors: [`Duplicate supplier name "${name}"`] })),
      });
    }

    const existing = await prisma.supplier.findMany({
      where: {
        tenantId: user.tenantId,
        supplierName: { in: validSuppliers.map((s) => s.supplierName) },
      },
      select: { supplierName: true },
    });
    if (existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Some suppliers already exist in the system',
        errors: existing.map((s) => ({ errors: [`Supplier "${s.supplierName}" already exists`] })),
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const supplier of validSuppliers) {
        const supplierCode = await nextSupplierCode(tx);
        rows.push(
          await tx.supplier.create({
            data: {
              tenantId: user.tenantId,
              supplierCode,
              supplierName: supplier.supplierName,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address,
              contactPerson: supplier.contactPerson,
              createdById: user.id,
            },
          }),
        );
      }
      return rows;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${created.length} suppliers`,
      totalProcessed: created.length,
      suppliers: created.map((s) => ({
        id: s.id,
        supplierName: s.supplierName,
        email: s.email,
        phone: s.phone,
      })),
    });
  } catch (error) {
    console.error('Error processing supplier bulk upload:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk upload. Please try again.' },
      { status: 500 },
    );
  }
}
