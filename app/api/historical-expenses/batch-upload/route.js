// app/api/historical-expenses/batch-upload/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';
import { getPostableExpenseAccounts } from '@/lib/accountingMappingRules';

export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const migrationBatch = formData.get('migrationBatch') || `Historical-${Date.now()}`;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read and parse CSV content
    const csvContent = await file.text();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Parse CSV with proper quote handling
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const dataRows = lines.slice(1).map(line => parseCSVLine(line));

    const expenseAccounts = await getPostableExpenseAccounts(user.tenantId, prisma);

    const expenseAccountsByName = new Map(
      expenseAccounts.map(account => [
        String(account.accountName || account.name || '').toLowerCase(),
        account
      ])
    );

    // Validate headers
    const expectedHeaders = [
      'Expense Date',
      'Description', 
      'Amount',
      'Category',
      'Merchant',
      'Payment Method',
      'Original Reference',
      'Notes'
    ];

    const headerMap = {};
    expectedHeaders.forEach((header, index) => {
      const foundIndex = headers.findIndex(h => 
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === 
        header.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (foundIndex !== -1) {
        headerMap[header] = foundIndex;
      }
    });

    // Validation results
    const validationResults = [];
    const validExpenses = [];

    // Validate each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because we start from row 2 (after header)
      const errors = [];

      // Skip empty rows
      if (row.every(cell => !cell || cell.trim() === '')) {
        continue;
      }

      // Extract data
      const expenseDate = row[headerMap['Expense Date']] || '';
      const description = row[headerMap['Description']] || '';
      const amount = row[headerMap['Amount']] || '';
      const category = row[headerMap['Category']] || '';
      const merchant = row[headerMap['Merchant']] || '';
      const paymentMethod = row[headerMap['Payment Method']] || '';
      const originalReference = row[headerMap['Original Reference']] || '';
      const notes = row[headerMap['Notes']] || '';

      // Validate required fields
      if (!expenseDate.trim()) {
        errors.push('Expense Date is required');
      } else {
        // Enhanced date parsing to support multiple formats
        let date = null;
        const dateStr = expenseDate.trim();
        
        // Try different date formats
        const dateFormats = [
          // ISO formats
          /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
          /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
          // US formats
          /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or M/D/YYYY
          /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY or M-D-YYYY
          // European formats
          /^\d{1,2}\/\d{1,2}\/\d{4}$/, // DD/MM/YYYY or D/M/YYYY
          /^\d{1,2}\.\d{1,2}\.\d{4}$/, // DD.MM.YYYY or D.M.YYYY
          // Other common formats
          /^\d{1,2} \w+ \d{4}$/, // DD Month YYYY
          /^\w+ \d{1,2}, \d{4}$/, // Month DD, YYYY
        ];
        
        // First try direct parsing
        date = new Date(dateStr);
        
        // If that fails, try manual parsing for common formats
        if (isNaN(date.getTime())) {
          // Try MM/DD/YYYY format
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [month, day, year] = dateStr.split('/');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          // Try DD/MM/YYYY format (European)
          else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            // Assume European format if day > 12
            if (parseInt(day) > 12) {
              date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
          }
          // Try DD.MM.YYYY format
          else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('.');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          // Try DD-MM-YYYY format
          else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
        }
        
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format. Supported formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY');
        } else if (date > new Date()) {
          errors.push('Expense date cannot be in the future');
        }
      }

      if (!description.trim()) {
        errors.push('Description is required');
      }

      if (!amount.trim()) {
        errors.push('Amount is required');
      } else {
        const numAmount = parseFloat(amount.replace(/[,$]/g, ''));
        if (isNaN(numAmount) || numAmount <= 0) {
          errors.push('Amount must be a positive number');
        }
      }

      if (!category.trim()) {
        errors.push('Category is required');
      } else {
        const account = expenseAccountsByName.get(category.trim().toLowerCase());
        if (!account) {
          errors.push('Category must match an existing Expense account name');
        }
      }

      if (!paymentMethod.trim()) {
        errors.push('Payment Method is required');
      }

      if (errors.length > 0) {
        validationResults.push({
          row: rowNumber,
          errors,
          data: { expenseDate, description, amount, category, merchant, paymentMethod, originalReference, notes }
        });
      } else {
        // Parse the date using the same enhanced logic
        let parsedDate = new Date(expenseDate.trim());
        const dateStr = expenseDate.trim();
        
        if (isNaN(parsedDate.getTime())) {
          // Try MM/DD/YYYY format
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [month, day, year] = dateStr.split('/');
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          // Try DD.MM.YYYY format
          else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('.');
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          // Try DD-MM-YYYY format
          else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
        }
        
        const matchedAccount = expenseAccountsByName.get(category.trim().toLowerCase());
        validExpenses.push({
          expenseDate: parsedDate,
          description: description.trim(),
          amount: parseFloat(amount.replace(/[,$]/g, '')),
          category: matchedAccount?.accountName || category.trim(),
          expenseAccountId: matchedAccount?.id || null,
          merchant: merchant.trim() || null,
          paymentMethod: paymentMethod.trim(),
          originalReference: originalReference.trim() || null,
          notes: notes.trim() || null
        });
      }
    }

    // If there are validation errors, return them
    if (validationResults.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Validation errors found',
        errors: validationResults,
        totalRows: dataRows.length,
        validRows: validExpenses.length,
        errorRows: validationResults.length
      }, { status: 400 });
    }

    // Process valid expenses in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const createdExpenses = [];
      const createdPayments = [];

      for (const expenseData of validExpenses) {
        if (!expenseData.expenseAccountId) {
          throw new Error(`Expense account missing for category: ${expenseData.category}`);
        }
        // Create expense record
        const expense = await tx.expense.create({
          data: {
            date: expenseData.expenseDate,
            description: expenseData.description,
            amount: expenseData.amount,
            category: expenseData.category,
            expenseAccountId: expenseData.expenseAccountId,
            merchant: expenseData.merchant,
            paymentMethod: expenseData.paymentMethod,
            notes: expenseData.notes,
            status: 'Approved', // Historical expenses should be approved by default
            tenantId: user.tenantId,
            submittedById: user.id, // Required field for submittedBy relation
            // Historical expense fields
            isHistorical: true,
            historicalDate: expenseData.expenseDate,
            migrationBatch: migrationBatch,
            originalReference: expenseData.originalReference,
          },
        });

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            amount: expenseData.amount,
            paymentDate: expenseData.expenseDate,
            paymentMethod: expenseData.paymentMethod,
            reference: expenseData.originalReference || expenseData.description,
            status: 'Completed',
            tenantId: user.tenantId,
            type: 'expense',
            sourceAccount: expenseData.paymentMethod
          }
        });

        // Update account balance
        await updateAccountBalance(user.tenantId, expenseData.paymentMethod, expenseData.amount, "subtract");

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'HISTORICAL_EXPENSE_CREATED',
            entityType: 'EXPENSE',
            entityId: expense.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              migrationBatch,
              originalReference: expenseData.originalReference,
              isHistorical: true
            })
          }
        });

        createdExpenses.push(expense);
        createdPayments.push(payment);
      }

      return { createdExpenses, createdPayments };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${results.createdExpenses.length} historical expenses`,
      migrationBatch,
      totalProcessed: results.createdExpenses.length,
      expenses: results.createdExpenses.map(expense => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        date: expense.date.toISOString().split('T')[0],
        category: expense.category
      }))
    });

  } catch (error) {
    console.error('Error processing historical expenses batch upload:', error);
    return NextResponse.json(
      { error: 'Failed to process batch upload. Please try again.' },
      { status: 500 }
    );
  }
}
