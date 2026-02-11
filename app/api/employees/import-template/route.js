import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export const runtime = 'nodejs';

const REQUIRED_HEADERS = ['Full Name', 'Job Title', 'Start Date'];

const TEMPLATE_HEADERS = [
  'Employee ID',
  'Full Name',
  'Email',
  'Phone',
  'ID Number',
  'Job Title',
  'Department',
  'Employment Type',
  'Gross Salary',
  'Hourly Rate',
  'Start Date',
  'Date of Birth',
  'Gender',
  'Marital Status',
  'Nationality',
  'Address',
  'Work Location',
  'Is Active',
  'Next of Kin Name',
  'Next of Kin Relationship',
  'Next of Kin Phone',
  'Next of Kin Address',
  'Selected Deductions'
];

export async function GET(request) {
  const accessError = await requireStandardAccess(request);
  if (accessError) return accessError;

  const user = await getUserFromSession(request);
  if (!user || !user.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const exampleRow = [
    '',
    'Jane Banda',
    'jane.banda@example.com',
    '265999000111',
    'A1234567',
    'Accountant',
    'Finance',
    'Permanent',
    '650000',
    '',
    '2024-01-15',
    '1990-05-20',
    'Female',
    'Single',
    'Malawian',
    'Area 49, Lilongwe',
    'Head Office',
    'TRUE',
    'John Banda',
    'Spouse',
    '265888000111',
    'Area 49, Lilongwe',
    'PAYE,NPS'
  ];

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, exampleRow]);
  ws['!cols'] = TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(12, header.length + 2) }));

  TEMPLATE_HEADERS.forEach((header, index) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: index });
    if (!ws[cellRef]) return;
    const isRequired = REQUIRED_HEADERS.includes(header);
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: isRequired ? 'C62828' : '1E3A8A' } },
      fill: {
        patternType: 'solid',
        fgColor: { rgb: isRequired ? 'FFF59D' : 'E3F2FD' }
      },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };
  });

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Instructions'],
    ['Required fields are highlighted in yellow.'],
    ['Dates should be in YYYY-MM-DD format.'],
    ['Employment Type example values: Permanent, Contract, Intern.'],
    ['Is Active accepts TRUE/FALSE, yes/no, 1/0.'],
    ['Selected Deductions: comma-separated IDs or names (e.g., PAYE,NPS).'],
  ]);
  instructions['!cols'] = [{ wch: 90 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, 'Employees');
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="employee-import-template.xlsx"'
    }
  });
}
