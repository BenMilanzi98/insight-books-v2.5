import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { Buffer } from 'buffer';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export const runtime = 'nodejs';

const HEADER_MAP = {
  'employee id': 'employeeId',
  'full name': 'name',
  'name': 'name',
  'email': 'email',
  'phone': 'phone',
  'id number': 'idNumber',
  'job title': 'jobTitle',
  'department': 'department',
  'employment type': 'employmentType',
  'gross salary': 'grossSalary',
  'hourly rate': 'hourlyRate',
  'start date': 'startDate',
  'date of birth': 'dateOfBirth',
  'gender': 'gender',
  'marital status': 'maritalStatus',
  'nationality': 'nationality',
  'address': 'address',
  'work location': 'workLocation',
  'is active': 'isActive',
  'next of kin name': 'nextOfKinName',
  'next of kin relationship': 'nextOfKinRelationship',
  'next of kin phone': 'nextOfKinPhone',
  'next of kin address': 'nextOfKinAddress',
  'selected deductions': 'selectedDeductions'
};

const REQUIRED_FIELDS = ['name', 'jobTitle', 'startDate'];

const normalizeHeader = (value) => String(value || '').trim().toLowerCase();

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', 'yes', '1', 'active'].includes(normalized)) return true;
  if (['false', 'no', '0', 'inactive'].includes(normalized)) return false;
  return null;
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/,/g, ''));
  return Number.isNaN(num) ? null : num;
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const jsDate = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(jsDate.getTime()) ? null : jsDate;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const extractRow = (row) => {
  const mapped = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeHeader(key);
    const field = HEADER_MAP[normalized];
    if (field) {
      mapped[field] = value;
    }
  });
  return mapped;
};

// Generate a random unique employee ID
const generateRandomEmployeeId = (existingIds) => {
  const maxAttempts = 100;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Generate a random ID using timestamp + random alphanumeric characters
    const timestamp = Date.now().toString(36); // Base36 encoding of timestamp
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 random chars
    const candidate = `${timestamp}${randomPart}`.toUpperCase();
    
    // Check if this ID already exists (case-insensitive)
    if (!existingIds.has(candidate)) {
      existingIds.add(candidate);
      return candidate;
    }
    
    attempts += 1;
  }
  
  // Fallback: if we can't generate a unique ID after max attempts, use UUID-like format
  const fallbackId = `EMP${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  existingIds.add(fallbackId);
  return fallbackId;
};

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'Template is missing a worksheet' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Template has no data rows' }, { status: 400 });
    }

    const [deductions, departments, existingEmployees] = await Promise.all([
    prisma.deduction.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true }
    }),
      prisma.department.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true }
      }),
      prisma.employee.findMany({
        where: { tenantId: user.tenantId },
        select: { employeeId: true }
      })
    ]);

    const deductionsByKey = new Map();
    deductions.forEach((deduction) => {
      if (deduction.id) deductionsByKey.set(deduction.id.toLowerCase(), deduction.id);
      if (deduction.name) deductionsByKey.set(deduction.name.toLowerCase(), deduction.id);
    });

    const departmentsByName = new Map(
      departments.map((department) => [department.name.toLowerCase(), department])
    );

    // Normalize employee IDs (trim and uppercase) for case-insensitive comparison
    const existingEmployeeIds = new Set(
      existingEmployees
        .map((employee) => String(employee.employeeId || '').trim().toUpperCase())
        .filter(Boolean)
    );

    let createdCount = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // Header is row 1
      const mapped = extractRow(rows[i]);
      const missingRequired = REQUIRED_FIELDS.filter((field) => !mapped[field]);
      if (missingRequired.length > 0) {
        errors.push({
          row: rowNumber,
          message: `Missing required fields: ${missingRequired.join(', ')}`
        });
        continue;
      }

      const startDate = parseDate(mapped.startDate) || new Date();
      const dateOfBirth = parseDate(mapped.dateOfBirth);
      const isActive = parseBoolean(mapped.isActive);

      let employeeId = mapped.employeeId ? String(mapped.employeeId).trim() : '';
      if (employeeId) {
        // Normalize the employee ID for comparison (uppercase)
        const normalizedId = employeeId.toUpperCase();
        // Check if this normalized ID already exists
        if (existingEmployeeIds.has(normalizedId)) {
          // Employee ID already exists - auto-generate a new random unique ID
          employeeId = generateRandomEmployeeId(existingEmployeeIds);
          // Add a warning to errors (but don't skip the row)
          errors.push({ 
            row: rowNumber, 
            message: `Employee ID "${mapped.employeeId}" already exists. Auto-assigned new random ID: "${employeeId}"`,
            type: 'warning'
          });
        } else {
          // ID is available - use it
          existingEmployeeIds.add(normalizedId);
          // Keep original case for the actual employeeId field
        }
      } else {
        // No employee ID provided - auto-generate a random unique one
        employeeId = generateRandomEmployeeId(existingEmployeeIds);
      }

      const emailInput = mapped.email ? String(mapped.email).trim() : '';
      const normalizedEmail = emailInput ? emailInput.toLowerCase() : '';
      const finalEmail = normalizedEmail
        ? normalizedEmail
        : `no-email-${Date.now()}-${Math.random().toString(36).substring(7)}@placeholder.local`;

      let departmentId = null;
      if (mapped.department) {
        const deptName = String(mapped.department).trim();
        if (deptName) {
          const existingDept = departmentsByName.get(deptName.toLowerCase());
          if (existingDept) {
            departmentId = existingDept.id;
          } else {
            // Try to find or create the department, handling unique constraint errors
            try {
              // First, try to find the department by exact name match
              let dept = await prisma.department.findFirst({
                where: {
                  tenantId: user.tenantId,
                  name: deptName
                }
              });

              // If not found by exact match, try case-insensitive search
              if (!dept) {
                dept = await prisma.department.findFirst({
                  where: {
                    tenantId: user.tenantId,
                    name: {
                      equals: deptName,
                      mode: 'insensitive'
                    }
                  }
                });
              }

              // If still not found, try to create it
              if (!dept) {
                try {
                  dept = await prisma.department.create({
                    data: {
                      name: deptName,
                      tenantId: user.tenantId
                    }
                  });
                } catch (createError) {
                  // If create fails due to unique constraint (P2002), 
                  // the department exists but wasn't found - try to fetch it again
                  if (createError.code === 'P2002') {
                    dept = await prisma.department.findFirst({
                      where: {
                        name: deptName
                      }
                    });
                    // If still not found, try case-insensitive
                    if (!dept) {
                      dept = await prisma.department.findFirst({
                        where: {
                          name: {
                            equals: deptName,
                            mode: 'insensitive'
                          }
                        }
                      });
                    }
                  } else {
                    throw createError;
                  }
                }
              }

              if (dept) {
                departmentsByName.set(deptName.toLowerCase(), dept);
                departmentId = dept.id;
              }
            } catch (deptError) {
              console.error('Error creating/fetching department:', deptError);
              // Continue without departmentId - employee will be created without department
            }
          }
        }
      }

      let selectedDeductions = null;
      if (mapped.selectedDeductions) {
        const items = String(mapped.selectedDeductions)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        const deductionIds = items
          .map((item) => deductionsByKey.get(item.toLowerCase()))
          .filter(Boolean);
        if (deductionIds.length > 0) {
          selectedDeductions = deductionIds;
        }
      }

      const emergencyContact = {
        name: mapped.nextOfKinName || null,
        relationship: mapped.nextOfKinRelationship || null,
        phone: mapped.nextOfKinPhone || null,
        address: mapped.nextOfKinAddress || null
      };

      let retryCount = 0;
      const maxRetries = 3;
      let employeeCreated = false;
      
      while (!employeeCreated && retryCount < maxRetries) {
        try {
          await prisma.employee.create({
            data: {
              employeeId,
              name: String(mapped.name).trim(),
              email: finalEmail,
              phone: mapped.phone ? String(mapped.phone).trim() : null,
              position: mapped.jobTitle ? String(mapped.jobTitle).trim() : null,
              jobTitle: mapped.jobTitle ? String(mapped.jobTitle).trim() : null,
              department: mapped.department ? String(mapped.department).trim() : null,
              departmentId,
              employmentType: mapped.employmentType ? String(mapped.employmentType).trim() : 'Permanent',
              grossSalary: parseNumber(mapped.grossSalary),
              hourlyRate: parseNumber(mapped.hourlyRate),
              salary: parseNumber(mapped.grossSalary),
              startDate,
              dateOfBirth,
              gender: mapped.gender ? String(mapped.gender).trim() : null,
              maritalStatus: mapped.maritalStatus ? String(mapped.maritalStatus).trim() : null,
              nationality: mapped.nationality ? String(mapped.nationality).trim() : 'Malawian',
              address: mapped.address ? String(mapped.address).trim() : null,
              workLocation: mapped.workLocation ? String(mapped.workLocation).trim() : null,
              isActive: isActive !== null ? isActive : true,
              status: isActive === false ? 'Inactive' : 'Active',
              idNumber: mapped.idNumber ? String(mapped.idNumber).trim() : null,
              emergencyContact,
              selectedDeductions,
              tenantId: user.tenantId
            }
          });

          createdCount += 1;
          employeeCreated = true;
        } catch (error) {
          // Handle unique constraint errors specifically
          if (error.code === 'P2002') {
            const field = error.meta?.target;
            if (Array.isArray(field) && field.includes('employeeId')) {
              // Employee ID conflict - generate a new random unique ID and retry
              if (retryCount < maxRetries - 1) {
                employeeId = generateRandomEmployeeId(existingEmployeeIds);
                retryCount += 1;
                // Add warning about ID change
                if (retryCount === 1) {
                  errors.push({ 
                    row: rowNumber, 
                    message: `Employee ID conflict detected. Auto-assigned new random ID: "${employeeId}"`,
                    type: 'warning'
                  });
                }
                continue; // Retry with new ID
              } else {
                // Max retries reached
                errors.push({ 
                  row: rowNumber, 
                  message: `Failed to create employee after ${maxRetries} attempts. Could not generate unique employee ID.` 
                });
                break;
              }
            } else if (Array.isArray(field) && field.includes('email')) {
              // Email conflict - cannot auto-fix, skip this row
              errors.push({ 
                row: rowNumber, 
                message: `Email "${finalEmail}" already exists in the database. Please use a different email.` 
              });
              break;
            } else {
              // Other unique constraint violation
              errors.push({ 
                row: rowNumber, 
                message: `Unique constraint violation: ${field ? field.join(', ') : 'unknown field'}` 
              });
              break;
            }
          } else {
            // Other errors - don't retry
            errors.push({ 
              row: rowNumber, 
              message: error.message || 'Failed to create employee' 
            });
            break;
          }
        }
      }
    }

    return NextResponse.json({
      createdCount,
      skippedCount: errors.length,
      errors
    });
  } catch (error) {
    console.error('Employee import failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to import employees',
        details: error.message
      },
      { status: 500 }
    );
  }
}
