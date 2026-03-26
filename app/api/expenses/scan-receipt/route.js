import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

function extractMerchantName(lines) {
  const skipWords = ['receipt', 'invoice', 'welcome', 'thank you', 'order', 'tel:', 'phone:'];
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = String(lines[i] || '').trim();
    if (line.length < 3) continue;
    if (skipWords.some((word) => line.toLowerCase().includes(word))) continue;
    if (line.match(/\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/)) continue;
    if (line.match(/\d{1,2}:\d{2}/)) continue;
    if (line.match(/^[\d\s\.\,\$]+$/)) continue;
    return line;
  }
  return 'Receipt Upload';
}

function findDate(text) {
  const dateRegexes = [
    /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/,
    /(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/,
    /(\d{1,2})[\s]*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s]*[,\s]*(\d{2,4})/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s]*(\d{1,2})[\s]*[,\s]*(\d{2,4})/i,
  ];
  for (const regex of dateRegexes) {
    const match = text.match(regex);
    if (match) return match[0];
  }
  return null;
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function findAmount(text) {
  const totalLabels = ['total', 'amount', 'grand total', 'balance', 'amount due', 'amount paid'];
  const lines = text.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (totalLabels.some((label) => lowerLine.includes(label))) {
      const amountMatch = line.match(/[\$\£\€]?\s*(\d+[\.,]\d{2})/);
      if (amountMatch) return amountMatch[1].replace(',', '.');
    }
  }
  const allAmounts = [];
  const amountRegex = /[\$\£\€]?\s*(\d+[\.,]\d{2})/g;
  let match;
  while ((match = amountRegex.exec(text)) !== null) {
    allAmounts.push(parseFloat(String(match[1]).replace(',', '.')));
  }
  if (allAmounts.length > 0) return String(Math.max(...allAmounts));
  return null;
}

function parseReceiptText(text) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const parsed = {
    description: extractMerchantName(lines),
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: 'Scanned from receipt image',
  };
  const dateMatch = findDate(text);
  if (dateMatch) parsed.date = formatDate(dateMatch);
  const amountMatch = findAmount(text);
  if (amountMatch) parsed.amount = Number.parseFloat(amountMatch) || 0;
  return parsed;
}

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Receipt image is required' }, { status: 400 });
    }
    const mimeType = String(file.type || '').toLowerCase();
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported for OCR scanning' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {},
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    });
    const extractedText = result?.data?.text || '';
    const parsed = parseReceiptText(extractedText);

    return NextResponse.json({
      success: true,
      receiptData: parsed,
      rawText: extractedText,
    });
  } catch (error) {
    console.error('Expense receipt OCR scan failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to scan receipt' },
      { status: 500 },
    );
  }
}
