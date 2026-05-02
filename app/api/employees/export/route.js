import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  EMPLOYEE_FULL_EXPORT_HEADERS,
  employeeToFullExportRow,
  rowsToCsv,
} from '@/lib/employeeImportExportColumns';

export const runtime = 'nodejs';

function buildEmployeeWhere(tenantId, searchParams) {
  const search = searchParams.get('search') || '';
  const department = searchParams.get('department');
  const status = searchParams.get('status');
  const employmentType = searchParams.get('employmentType');
  const isActive = searchParams.get('isActive');

  const where = { tenantId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { position: { contains: search, mode: 'insensitive' } },
      { jobTitle: { contains: search, mode: 'insensitive' } },
      { idNumber: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { department: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (department && department !== 'All') {
    where.department = department;
  }
  if (status && status !== 'All') {
    where.status = status;
  }
  if (employmentType && employmentType !== 'All') {
    where.employmentType = employmentType;
  }
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }

  return where;
}

function filenameStem() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `employees-export-${y}-${m}-${day}`;
}

export async function GET(request) {
  const accessError = await requireStandardAccess(request);
  if (accessError) return accessError;

  const user = await getUserFromSession(request);
  if (!user || !user.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'xlsx').toLowerCase();
  if (!['xlsx', 'csv', 'pdf'].includes(format)) {
    return NextResponse.json(
      { error: 'Invalid format. Use format=xlsx, format=csv, or format=pdf' },
      { status: 400 }
    );
  }

  const where = buildEmployeeWhere(user.tenantId, searchParams);

  const [employees, deductions] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        departmentRef: { select: { name: true } },
        employeeBenefits: {
          include: {
            benefit: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.deduction.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        amount: true,
        percentage: true,
        isStatutory: true,
        description: true,
        isActive: true,
      },
    }),
  ]);

  const deductionIdToName = new Map(deductions.map((d) => [d.id, d.name || d.id]));

  const deductionById = new Map(deductions.map((d) => [d.id, d]));

  const rows = employees.map((e) =>
    employeeToFullExportRow(e, deductionIdToName, deductionById)
  );
  const base = filenameStem();

  if (format === 'csv') {
    const csv = rowsToCsv(EMPLOYEE_FULL_EXPORT_HEADERS, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.csv"`,
      },
    });
  }

  if (format === 'xlsx') {
    const aoa = [EMPLOYEE_FULL_EXPORT_HEADERS, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = EMPLOYEE_FULL_EXPORT_HEADERS.map((h) => {
      const base = Math.max(12, Math.min(40, h.length + 2));
      if (/JSON/i.test(h)) return { wch: 48 };
      if (/Detail|Reason|Address/i.test(h)) return { wch: Math.max(base, 28) };
      return { wch: base };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  // PDF
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  doc.setFontSize(11);
  doc.text('Employees export', 14, 12);
  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date().toLocaleString()} · ${rows.length} record(s) · Includes deductions, benefits, and HR fields. Import uses template columns only.`,
    14,
    18
  );

  autoTable(doc, {
    head: [EMPLOYEE_FULL_EXPORT_HEADERS],
    body: rows,
    startY: 24,
    styles: { fontSize: 5, cellPadding: 0.8, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 175], fontSize: 6 },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
    horizontalPageBreak: true,
  });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${base}.pdf"`,
    },
  });
}
