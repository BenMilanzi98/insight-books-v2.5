// app/api/historical-transactions/batch-upload/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateAccountBalance } from '@/lib/core';

// Helper function to parse CSV content
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map((line, index) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    row.rowNumber = index + 2; // +2 because we skip header and arrays are 0-indexed
    return row;
  });
}

// Helper function to parse dates with multiple format support
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  
  const cleanStr = dateStr.trim();
  let date = null;
  
  // Try different formats
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      const [part1, part2, part3] = parts.map(p => parseInt(p));
      
      // Determine format based on values
      if (part3 > 31) {
        // Third part is year: DD/MM/YYYY or MM/DD/YYYY
        if (part1 > 12) {
          // First part > 12, must be DD/MM/YYYY
          date = new Date(part3, part2 - 1, part1);
        } else if (part2 > 12) {
          // Second part > 12, must be MM/DD/YYYY (invalid, but handle as DD/MM/YYYY)
          date = new Date(part3, part2 - 1, part1);
        } else {
          // Ambiguous case - try DD/MM/YYYY first (European standard)
          date = new Date(part3, part2 - 1, part1);
          // Validate the date makes sense
          if (date.getDate() !== part1 || date.getMonth() !== part2 - 1) {
            // Try MM/DD/YYYY instead
            date = new Date(part3, part1 - 1, part2);
          }
        }
      } else if (part1 > 31) {
        // First part is year: YYYY/MM/DD
        date = new Date(part1, part2 - 1, part3);
      }
    }
  } else if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const [part1, part2, part3] = parts.map(p => parseInt(p));
      
      if (part1 > 31) {
        // YYYY-MM-DD format
        date = new Date(part1, part2 - 1, part3);
      } else if (part3 > 31) {
        // DD-MM-YYYY format
        date = new Date(part3, part2 - 1, part1);
      }
    }
  } else {
    // Try direct parsing as last resort
    date = new Date(cleanStr);
  }
  
  // Validate the parsed date
  if (!date || isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

// Helper function to validate transaction data
function validateTransaction(transaction, rowNumber) {
  const errors = [];
  
  // Required fields
  if (!transaction['Transaction Date']) {
    errors.push(`Row ${rowNumber}: Transaction Date is required`);
  } else {
    const date = parseDate(transaction['Transaction Date']);
    if (!date) {
      errors.push(`Row ${rowNumber}: Invalid Transaction Date format. Please use formats like: 15/01/2023, 2023-01-15, or 01/15/2023`);
    } else if (date > new Date()) {
      errors.push(`Row ${rowNumber}: Transaction Date cannot be in the future`);
    }
  }
  
  if (!transaction['Product/Service Description']) {
    errors.push(`Row ${rowNumber}: Product/Service Description is required`);
  }
  
  if (!transaction['Quantity'] || isNaN(parseFloat(transaction['Quantity'])) || parseFloat(transaction['Quantity']) <= 0) {
    errors.push(`Row ${rowNumber}: Valid Quantity is required`);
  }
  
  if (!transaction['Unit Price'] || isNaN(parseFloat(transaction['Unit Price'])) || parseFloat(transaction['Unit Price']) <= 0) {
    errors.push(`Row ${rowNumber}: Valid Unit Price is required`);
  }
  
  // Optional but validated fields
  if (transaction['Tax Rate (%)'] && (isNaN(parseFloat(transaction['Tax Rate (%)'])) || parseFloat(transaction['Tax Rate (%)']) < 0)) {
    errors.push(`Row ${rowNumber}: Tax Rate must be a valid number >= 0`);
  }
  
  if (transaction['Discount Amount'] && (isNaN(parseFloat(transaction['Discount Amount'])) || parseFloat(transaction['Discount Amount']) < 0)) {
    errors.push(`Row ${rowNumber}: Discount Amount must be a valid number >= 0`);
  }
  
  // Payment method validation
  const validPaymentMethods = ['cash', 'card', 'mobile_money', 'bank_transfer', 'cheque'];
  if (transaction['Payment Method'] && !validPaymentMethods.includes(transaction['Payment Method'].toLowerCase())) {
    errors.push(`Row ${rowNumber}: Payment Method must be one of: ${validPaymentMethods.join(', ')}`);
  }
  
  return errors;
}

export async function POST(request) {
  try {
    console.log('Batch upload request received');
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      console.log('Authentication failed - no user session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('User authenticated:', user.id);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const migrationBatch = formData.get('migrationBatch') || `BATCH-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    
    console.log('File received:', file ? file.name : 'No file');
    console.log('Migration batch:', migrationBatch);
    
    if (!file) {
      console.log('No file in form data');
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file type and read content
    const fileName = file.name.toLowerCase();
    let fileContent;
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Excel files are not yet supported. Please download the CSV template and use CSV format.' },
        { status: 400 }
      );
    } else if (fileName.endsWith('.csv')) {
      fileContent = await file.text();
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please use CSV format.' },
        { status: 400 }
      );
    }
    
    console.log('File content length:', fileContent.length);
    console.log('First 200 chars:', fileContent.substring(0, 200));
    
    // Parse CSV
    let transactions;
    try {
      transactions = parseCSV(fileContent);
      console.log('Parsed transactions count:', transactions.length);
      console.log('First transaction:', transactions[0]);
    } catch (parseError) {
      console.error('CSV parsing error:', parseError);
      return NextResponse.json(
        { error: 'Invalid CSV format. Please use the provided template.', details: parseError.message },
        { status: 400 }
      );
    }

    if (transactions.length === 0) {
      console.log('No transactions found in file');
      return NextResponse.json(
        { error: 'No transactions found in the uploaded file' },
        { status: 400 }
      );
    }

    // Validate all transactions first
    const allErrors = [];
    const validTransactions = [];
    
    console.log('Starting validation of', transactions.length, 'transactions');
    
    for (const transaction of transactions) {
      const errors = validateTransaction(transaction, transaction.rowNumber);
      if (errors.length > 0) {
        console.log(`Validation errors for row ${transaction.rowNumber}:`, errors);
        allErrors.push(...errors);
      } else {
        validTransactions.push(transaction);
      }
    }

    console.log('Validation complete. Valid:', validTransactions.length, 'Invalid:', allErrors.length);

    if (allErrors.length > 0) {
      console.log('Returning validation errors:', allErrors);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: allErrors,
          validCount: validTransactions.length,
          totalCount: transactions.length
        },
        { status: 400 }
      );
    }

    // Process valid transactions in batches
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0
    };

    // Process transactions in database transaction
    await prisma.$transaction(async (tx) => {
      for (const transaction of validTransactions) {
        try {
          // Find or create client if provided
          let clientId = null;
          if (transaction['Customer Name'] && transaction['Customer Name'].trim()) {
            const clientName = transaction['Customer Name'].trim();
            const clientEmail = transaction['Customer Email'] && transaction['Customer Email'].trim() 
              ? transaction['Customer Email'].trim() 
              : `${clientName.toLowerCase().replace(/\s+/g, '.')}@placeholder.com`;
            
            // Try to find existing client by email and tenantId
            let client = await tx.client.findFirst({
              where: {
                email: clientEmail,
                tenantId: user.tenantId
              }
            });
            
            // If not found, create new client
            if (!client) {
              client = await tx.client.create({
                data: {
                  name: clientName,
                  email: clientEmail,
                  tenantId: user.tenantId
                }
              });
            }
            
            clientId = client.id;
          }

          // Calculate amounts
          const quantity = parseFloat(transaction['Quantity']);
          const unitPrice = parseFloat(transaction['Unit Price']);
          const taxRate = parseFloat(transaction['Tax Rate (%)'] || '0');
          const discountAmount = parseFloat(transaction['Discount Amount'] || '0');
          
          const subtotal = quantity * unitPrice;
          const taxAmount = subtotal * (taxRate / 100);
          const total = subtotal + taxAmount - discountAmount;

          // Parse transaction date using robust date parser
          const transactionDate = parseDate(transaction['Transaction Date']);
          
          // Generate sale number
          const saleDateStr = transactionDate.toISOString().split('T')[0].replace(/-/g, '').substring(2); // YYMMDD format
          const salesCount = await tx.sale.count({
            where: {
              tenantId: user.tenantId,
              saleDate: {
                gte: new Date(transactionDate.setHours(0, 0, 0, 0)),
                lt: new Date(transactionDate.setHours(23, 59, 59, 999))
              }
            }
          });
          const saleNumber = `SALE-${saleDateStr}-${(salesCount + 1).toString().padStart(3, '0')}`;

          // Create sale
          const saleData = {
            saleNumber,
            saleDate: transactionDate,
            subtotal,
            totalTaxAmount: taxAmount,
            totalDiscountAmount: discountAmount,
            total,
            status: 'completed',
            paymentMethod: transaction['Payment Method']?.toLowerCase() || 'cash',
            notes: transaction['Notes'] || '',
            taxRate,
            taxAmount,
            isHistorical: true,
            historicalDate: transactionDate,
            migrationBatch,
            originalReference: transaction['Original Reference'] || null,
            createdBy: {
              connect: { id: user.id }
            },
            tenant: {
              connect: { id: user.tenantId }
            }
          };

          // Add client relation if clientId exists
          if (clientId) {
            saleData.client = {
              connect: { id: clientId }
            };
          }

          const sale = await tx.sale.create({
            data: saleData
          });

          // Create sale item
          await tx.saleItem.create({
            data: {
              sale: { connect: { id: sale.id } },
              description: transaction['Product/Service Description'],
              quantity: quantity,
              unitPrice: unitPrice,
              amount: subtotal,
              taxRate: taxRate,
              taxAmount: taxAmount,
              discountAmount: discountAmount,
              isCustom: true,
              customProductData: {
                name: transaction['Product/Service Description'],
                price: unitPrice,
                description: transaction['Product/Service Description']
              }
            }
          });

          // Create payment record
          await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: total,
              paymentDate: transactionDate,
              paymentMethod: transaction['Payment Method']?.toLowerCase() || 'cash',
              reference: `Historical Sale ${saleNumber}`,
              notes: `Historical payment for ${saleNumber}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale',
              sourceAccount: transaction['Payment Method']?.toLowerCase() || 'cash'
            }
          });

          // Update account balance
          await updateAccountBalance(user.tenantId, transaction['Payment Method']?.toLowerCase() || 'cash', total, "add");

          // Create audit log
          await tx.auditLog.create({
            data: {
              action: 'HISTORICAL_BATCH_SALE_CREATED',
              entityType: 'SALE',
              entityId: sale.id,
              userId: user.id,
              tenantId: user.tenantId,
              details: JSON.stringify({
                saleNumber: sale.saleNumber,
                total: sale.total,
                migrationBatch: migrationBatch,
                originalReference: transaction['Original Reference'],
                rowNumber: transaction.rowNumber
              })
            }
          });

          results.successful.push({
            rowNumber: transaction.rowNumber,
            saleNumber: sale.saleNumber,
            total: total,
            customer: transaction['Customer Name'] || 'Walk-in Customer'
          });
          results.totalProcessed++;

        } catch (error) {
          console.error(`Error processing row ${transaction.rowNumber}:`, error);
          results.failed.push({
            rowNumber: transaction.rowNumber,
            error: error.message,
            transaction: transaction['Product/Service Description']
          });
        }
      }
    });

    return NextResponse.json({
      message: 'Batch upload completed',
      results: {
        totalRows: transactions.length,
        successful: results.successful.length,
        failed: results.failed.length,
        migrationBatch: migrationBatch,
        successfulTransactions: results.successful,
        failedTransactions: results.failed
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing batch upload:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process batch upload',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
