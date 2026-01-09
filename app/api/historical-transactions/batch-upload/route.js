// app/api/historical-transactions/batch-upload/route.js
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateAccountBalance } from '@/lib/core';

// Helper function to normalize column names (case-insensitive, handle variations)
function normalizeColumnName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Helper function to find column value by normalized name
function getColumnValue(row, possibleNames) {
  const normalizedRow = {};
  Object.keys(row).forEach(key => {
    normalizedRow[normalizeColumnName(key)] = row[key];
  });
  
  for (const name of possibleNames) {
    const normalized = normalizeColumnName(name);
    if (normalizedRow[normalized] !== undefined) {
      return normalizedRow[normalized];
    }
  }
  
  // Try exact match as fallback
  for (const name of possibleNames) {
    if (row[name] !== undefined) {
      return row[name];
    }
  }
  
  return undefined;
}

// Helper function to parse CSV content
function parseCSV(csvText) {
  // Normalize line endings (handle both \r\n and \n)
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
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
        values.push(current.trim().replace(/^"|"$/g, '')); // Remove quotes
        current = '';
      } else {
        current += char;
      }
    }
    // Push the last value
    values.push(current.trim().replace(/^"|"$/g, '')); // Remove quotes
    
    const row = {};
    headers.forEach((header, i) => {
      // Get value, defaulting to empty string if index is out of bounds
      let value = (values[i] !== undefined) ? values[i] : '';
      row[header] = value;
    });
    row.rowNumber = index + 2; // +2 because we skip header and arrays are 0-indexed
    return row;
  });
}

// Helper function to normalize payment method
function normalizePaymentMethod(method) {
  if (!method) return 'cash';
  const methodStr = method.toString().trim();
  
  // If it's already a normalized key (contains underscore), return as is
  if (methodStr.includes('_')) {
    return methodStr.toLowerCase();
  }
  
  // Map display names to normalized keys
  const methodMap = {
    'cash': 'cash',
    'card': 'card', // Keep for backward compatibility
    'mobile_money': 'mobile_money', // Keep for backward compatibility
    'bank transfer': 'bank_transfer',
    'banktransfer': 'bank_transfer',
    'airtel money': 'airtel_money',
    'airtelmoney': 'airtel_money',
    'mpamba': 'mpamba',
    'paychangu': 'paychangu',
    'pay changu': 'paychangu',
    'cheque': 'cheque', // Keep for backward compatibility
    'check': 'cheque'
  };
  
  const normalized = methodMap[methodStr.toLowerCase()];
  if (normalized) {
    return normalized;
  }
  
  // Default normalization: lowercase and replace spaces with underscores
  return methodStr.toLowerCase().replace(/\s+/g, '_') || 'cash';
}

// Helper function to parse dates with multiple format support
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  
  const cleanStr = dateStr.trim();
  let date = null;
  
  // Try different formats
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/').map(p => p.trim());
    if (parts.length === 3) {
      const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
      
      // Check if any part is NaN
      if (isNaN(part1) || isNaN(part2) || isNaN(part3)) {
        // Try direct parsing as last resort
        date = new Date(cleanStr);
      } else {
        // Handle 2-digit years (e.g., 21, 22, 23 -> 2021, 2022, 2023)
        let year = part3;
        if (part3 < 100) {
          // 2-digit year: assume 2000-2099
          year = part3 < 50 ? 2000 + part3 : 1900 + part3;
        }
        
        // Determine format based on values
        if (year > 31) {
          // Third part is year: DD/MM/YYYY or MM/DD/YYYY
          if (part1 > 12) {
            // First part > 12, must be DD/MM/YYYY
            date = new Date(year, part2 - 1, part1);
          } else if (part2 > 12) {
            // Second part > 12, must be MM/DD/YYYY (invalid, but handle as DD/MM/YYYY)
            date = new Date(year, part2 - 1, part1);
          } else {
            // Ambiguous case - try DD/MM/YYYY first (European standard)
            date = new Date(year, part2 - 1, part1);
            // Validate the date makes sense
            if (date.getDate() !== part1 || date.getMonth() !== part2 - 1) {
              // Try MM/DD/YYYY instead
              date = new Date(year, part1 - 1, part2);
            }
          }
        } else if (part1 > 31) {
          // First part is year: YYYY/MM/DD
          date = new Date(part1, part2 - 1, part3);
        } else {
          // Try DD/MM/YYYY as default
          date = new Date(year, part2 - 1, part1);
        }
      }
    }
  } else if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-').map(p => p.trim());
    if (parts.length === 3) {
      const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
      
      if (isNaN(part1) || isNaN(part2) || isNaN(part3)) {
        // Try direct parsing as last resort
        date = new Date(cleanStr);
      } else {
        if (part1 > 31) {
          // YYYY-MM-DD format
          date = new Date(part1, part2 - 1, part3);
        } else if (part3 > 31) {
          // DD-MM-YYYY format
          date = new Date(part3, part2 - 1, part1);
        } else {
          // Try YYYY-MM-DD as default
          date = new Date(part1, part2 - 1, part3);
        }
      }
    }
  } else if (cleanStr.includes('.')) {
    // Try DD.MM.YYYY format
    const parts = cleanStr.split('.').map(p => p.trim());
    if (parts.length === 3) {
      const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
      if (!isNaN(part1) && !isNaN(part2) && !isNaN(part3)) {
        if (part3 > 31) {
          // DD.MM.YYYY format
          date = new Date(part3, part2 - 1, part1);
        } else if (part1 > 31) {
          // YYYY.MM.DD format
          date = new Date(part1, part2 - 1, part3);
        }
      }
    }
  } else {
    // Try ISO format (YYYY-MM-DD) first
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      date = new Date(cleanStr + 'T00:00:00');
    } else {
      // Try direct parsing as last resort
      date = new Date(cleanStr);
    }
  }
  
  // Validate the parsed date
  if (!date || isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

// Helper function to validate and apply default values to transaction data
function validateTransaction(transaction, rowNumber, applyDefaults = false) {
  const errors = [];
  
  // Helper to parse numeric values (handles currency formatting, commas, etc.)
  const parseNumericValue = (value) => {
    if (value === undefined || value === null) return '';
    const str = String(value).trim();
    if (!str || str === '') return '';
    // Remove currency symbols, commas, and whitespace
    return str.replace(/[$,\s]/g, '');
  };

  // Get field values - use EXACT column names from template
  // Template columns: Transaction Date,Customer Name,Customer Email,Product/Service Description,Quantity,Unit Price,Tax Rate (%),Discount Amount,Payment Method,Original Reference,Notes
  let transactionDate = transaction['Transaction Date'] || '';
  let productDescription = transaction['Product/Service Description'] || '';
  let quantity = transaction['Quantity'] || '';
  let unitPrice = transaction['Unit Price'] || '';
  const taxRate = transaction['Tax Rate (%)'] || '';
  const discountAmount = transaction['Discount Amount'] || '';
  let paymentMethod = transaction['Payment Method'] || '';
  
  // Apply default values if enabled and field is empty
  if (applyDefaults) {
    // Default transaction date to today if empty
    if (!transactionDate || transactionDate.trim() === '') {
      transactionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log(`Row ${rowNumber}: Using default Transaction Date: ${transactionDate}`);
    }
    
    // Default product description if empty
    if (!productDescription || productDescription.trim() === '') {
      productDescription = 'Historical Transaction Item';
      console.log(`Row ${rowNumber}: Using default Product Description: ${productDescription}`);
    }
    
    // Default quantity to 1 if empty
    if (!quantity || parseNumericValue(quantity) === '') {
      quantity = '1';
      console.log(`Row ${rowNumber}: Using default Quantity: ${quantity}`);
    }
    
    // Note: Unit Price cannot have a default - it must be provided
    // If empty, it will still be flagged as an error
    
    // Default payment method to cash if empty
    if (!paymentMethod || paymentMethod.trim() === '') {
      paymentMethod = 'cash';
      console.log(`Row ${rowNumber}: Using default Payment Method: ${paymentMethod}`);
    }
  }
  
  // Required fields validation
  if (!transactionDate || transactionDate.trim() === '') {
    errors.push(`Row ${rowNumber}: Transaction Date is required`);
  } else {
    const date = parseDate(transactionDate);
    if (!date) {
      errors.push(`Row ${rowNumber}: Invalid Transaction Date format. Please use formats like: 15/01/2023, 2023-01-15, or 01/15/2023`);
    } else if (date > new Date()) {
      errors.push(`Row ${rowNumber}: Transaction Date cannot be in the future`);
    }
  }
  
  if (!productDescription || productDescription.trim() === '') {
    errors.push(`Row ${rowNumber}: Product/Service Description is required`);
  }

  // Validate Quantity
  const quantityStr = parseNumericValue(quantity);
  if (!quantityStr || quantityStr === '') {
    errors.push(`Row ${rowNumber}: Quantity is required`);
  } else {
    const quantityNum = parseFloat(quantityStr);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      errors.push(`Row ${rowNumber}: Quantity must be a valid number greater than 0`);
    }
  }
  
  // Validate Unit Price
  // Check if unitPrice is undefined (field not found) vs empty string (field exists but empty)
  if (unitPrice === undefined) {
    // Field not found - this shouldn't happen if CSV has the column
    const availableFields = Object.keys(transaction).filter(k => k !== 'rowNumber').join(', ');
    errors.push(`Row ${rowNumber}: Unit Price column not found. Available columns: ${availableFields}`);
  } else {
    const unitPriceStr = parseNumericValue(unitPrice);
    if (!unitPriceStr || unitPriceStr === '') {
      // Field exists but is empty - Unit Price cannot have a default, it's required
      errors.push(`Row ${rowNumber}: Unit Price is required but is empty. Please provide a valid unit price for this row.`);
    } else {
      const unitPriceNum = parseFloat(unitPriceStr);
      if (isNaN(unitPriceNum) || unitPriceNum < 0) {
        errors.push(`Row ${rowNumber}: Unit Price must be a valid number >= 0 (found: "${unitPrice}")`);
      }
    }
  }
  
  // Optional but validated fields
  if (taxRate && taxRate.trim() !== '') {
    const taxRateStr = parseNumericValue(taxRate);
    if (taxRateStr && taxRateStr !== '') {
      const taxRateNum = parseFloat(taxRateStr);
      if (isNaN(taxRateNum) || taxRateNum < 0) {
        errors.push(`Row ${rowNumber}: Tax Rate must be a valid number >= 0`);
      }
    }
  }
  
  if (discountAmount && discountAmount.trim() !== '') {
    const discountStr = parseNumericValue(discountAmount);
    if (discountStr && discountStr !== '') {
      const discount = parseFloat(discountStr);
      if (isNaN(discount) || discount < 0) {
        errors.push(`Row ${rowNumber}: Discount Amount must be a valid number >= 0`);
      }
    }
  }
  
  // Payment method validation - normalize and check
  const validPaymentMethods = ['cash', 'card', 'mobile_money', 'bank_transfer', 'airtel_money', 'mpamba', 'paychangu', 'cheque'];
  if (paymentMethod && paymentMethod.trim() !== '') {
    const normalizedMethod = normalizePaymentMethod(paymentMethod);
    if (!validPaymentMethods.includes(normalizedMethod)) {
      errors.push(`Row ${rowNumber}: Payment Method must be one of: Cash, Bank Transfer, Airtel Money, Mpamba, PayChangu, Card, Mobile Money, or Cheque`);
    }
  }
  
  // Return validated data with defaults applied
  return {
    errors,
    validatedData: {
      transactionDate,
      productDescription,
      quantity,
      unitPrice,
      taxRate: taxRate || '0',
      discountAmount: discountAmount || '0',
      paymentMethod: paymentMethod || 'cash'
    }
  };
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
    if (transactions.length > 0) {
      console.log('CSV Headers:', Object.keys(transactions[0]).filter(k => k !== 'rowNumber'));
    }
    
    for (const transaction of transactions) {
      // Validate with defaults enabled (applyDefaults = true)
      const validationResult = validateTransaction(transaction, transaction.rowNumber, true);
      
      if (validationResult.errors.length > 0) {
        console.log(`Validation errors for row ${transaction.rowNumber}:`, validationResult.errors);
        allErrors.push(...validationResult.errors);
      } else {
        // Store validated data with defaults applied
        const validatedTransaction = {
          ...transaction,
          ...validationResult.validatedData
        };
        validTransactions.push(validatedTransaction);
      }
    }

    console.log('Validation complete. Valid:', validTransactions.length, 'Invalid:', allErrors.length);

    // If there are validation errors but we have some valid transactions, 
    // we can either fail completely or process the valid ones
    // For now, we'll process valid transactions and report errors separately
    if (allErrors.length > 0 && validTransactions.length === 0) {
      // All transactions are invalid - fail completely
      console.log('All transactions are invalid. Returning validation errors:', allErrors);
      return NextResponse.json(
        { 
          error: 'Validation failed - all rows have errors',
          details: allErrors,
          validCount: 0,
          totalCount: transactions.length
        },
        { status: 400 }
      );
    }
    
    // If we have some valid transactions, we'll process them and report errors
    if (allErrors.length > 0 && validTransactions.length > 0) {
      console.log(`Processing ${validTransactions.length} valid transactions. ${allErrors.length} rows will be skipped due to validation errors.`);
    }

    // Process valid transactions in batches
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0
    };

    // Process transactions in database transaction
    // Increase timeout for large batches (586 rows * ~200ms per row = ~120 seconds, with buffer = 10 minutes)
    // Calculate timeout: 10 minutes for very large batches, or 500ms per transaction
    const transactionTimeout = Math.max(600000, validTransactions.length * 500); // At least 10 minutes, or 500ms per transaction
    const maxWait = 60000; // Wait up to 60 seconds for transaction to start
    
    console.log(`Processing ${validTransactions.length} transactions with timeout: ${transactionTimeout}ms, maxWait: ${maxWait}ms`);
    
    try {
      await prisma.$transaction(async (tx) => {
        console.log(`Starting database transaction for ${validTransactions.length} transactions`);
        let processedCount = 0;
        for (const transaction of validTransactions) {
          try {
            processedCount++;
            // Log progress every 50 transactions to reduce console spam
            if (processedCount % 50 === 0 || processedCount === 1) {
              console.log(`Processing transaction ${processedCount}/${validTransactions.length} (row ${transaction?.rowNumber || 'unknown'})...`);
            }
          // Get field values - use EXACT column names from template (matching template/route.js)
          // Template columns: Transaction Date,Customer Name,Customer Email,Product/Service Description,Quantity,Unit Price,Tax Rate (%),Discount Amount,Payment Method,Original Reference,Notes
          const customerName = transaction['Customer Name'] || '';
          const customerEmail = transaction['Customer Email'] || '';
          // Use validated data if available (from validation with defaults), otherwise get from transaction
          const transactionDate = transaction.transactionDate || transaction['Transaction Date'] || '';
          const productDescription = transaction.productDescription || transaction['Product/Service Description'] || '';
          const quantity = transaction.quantity || transaction['Quantity'] || '';
          const unitPrice = transaction.unitPrice || transaction['Unit Price'] || '';
          // Validate Unit Price is not empty (should have been caught in validation, but double-check)
          if (!unitPrice || unitPrice.trim() === '') {
            throw new Error(`Row ${transaction.rowNumber}: Unit Price is required but is empty. This row should have been skipped during validation.`);
          }
          const taxRate = transaction.taxRate || transaction['Tax Rate (%)'] || '0';
          const discountAmount = transaction.discountAmount || transaction['Discount Amount'] || '0';
          const paymentMethod = transaction.paymentMethod || transaction['Payment Method'] || 'cash';
          const originalReference = transaction['Original Reference'] || '';
          const notes = transaction['Notes'] || '';

          // Find or create client if provided
          let clientId = null;
          if (customerName && customerName.trim()) {
            const clientName = customerName.trim();
            const clientEmail = customerEmail && customerEmail.trim() 
              ? customerEmail.trim() 
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

          // Helper to parse numeric values (handles currency formatting, commas, etc.)
          const parseNumericValue = (value) => {
            if (!value) return '0';
            // Remove currency symbols, commas, and whitespace
            return String(value).trim().replace(/[$,\s]/g, '');
          };

          // Calculate amounts - parse values with currency formatting support
          const quantityNum = parseFloat(parseNumericValue(quantity));
          const unitPriceNum = parseFloat(parseNumericValue(unitPrice));
          const taxRateNum = parseFloat(parseNumericValue(taxRate));
          const discountAmountNum = parseFloat(parseNumericValue(discountAmount));
          
          const subtotal = quantityNum * unitPriceNum;
          const taxAmount = subtotal * (taxRateNum / 100);
          const total = subtotal + taxAmount - discountAmountNum;

          // Parse transaction date using robust date parser
          let parsedTransactionDate = parseDate(transactionDate);
          
          // If parseDate fails, try parsing the default format (YYYY-MM-DD) directly
          if (!parsedTransactionDate && transactionDate) {
            try {
              // Try ISO format (YYYY-MM-DD)
              if (/^\d{4}-\d{2}-\d{2}$/.test(transactionDate.trim())) {
                parsedTransactionDate = new Date(transactionDate.trim() + 'T00:00:00');
                if (isNaN(parsedTransactionDate.getTime())) {
                  parsedTransactionDate = null;
                }
              }
            } catch (e) {
              console.error(`Error parsing date ${transactionDate}:`, e);
            }
          }
          
          if (!parsedTransactionDate) {
            throw new Error(`Invalid transaction date for row ${transaction.rowNumber}: "${transactionDate}". Please use formats like: 15/01/2023, 2023-01-15, or 01/15/2023`);
          }
          
          // Generate sale number
          const saleDateStr = parsedTransactionDate.toISOString().split('T')[0].replace(/-/g, '').substring(2); // YYMMDD format
          const startOfDay = new Date(parsedTransactionDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(parsedTransactionDate);
          endOfDay.setHours(23, 59, 59, 999);
          
          const salesCount = await tx.sale.count({
            where: {
              tenantId: user.tenantId,
              saleDate: {
                gte: startOfDay,
                lt: endOfDay
              }
            }
          });
          const saleNumber = `SALE-${saleDateStr}-${(salesCount + 1).toString().padStart(3, '0')}`;

          // Normalize payment method
          const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
          
          // Create sale
          const saleData = {
            saleNumber,
            saleDate: parsedTransactionDate,
            subtotal,
            totalTaxAmount: taxAmount,
            totalDiscountAmount: discountAmountNum,
            total,
            status: 'completed',
            paymentMethod: normalizedPaymentMethod,
            notes: notes || '',
            taxRate: taxRateNum,
            taxAmount,
            isHistorical: true,
            historicalDate: parsedTransactionDate,
            migrationBatch,
            originalReference: originalReference || null,
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

          // Find or create product based on description BEFORE creating the sale
          let product = null;
          let productId = null;
          
          try {
            // Try to find existing product by name (case-insensitive)
            product = await tx.product.findFirst({
              where: {
                name: {
                  equals: productDescription.trim(),
                  mode: 'insensitive'
                },
                tenantId: user.tenantId,
                isDeleted: false
              }
            });

            // If product doesn't exist, create it
            if (!product) {
              // Generate a SKU from the product name
              const cleanName = productDescription.trim();
              let skuBase = cleanName
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');
              
              // Ensure SKU is not empty
              if (!skuBase || skuBase.length === 0) {
                skuBase = 'PROD';
              }
              
              // Limit SKU length to 20 characters
              if (skuBase.length > 20) {
                skuBase = skuBase.substring(0, 20);
              }
              
              // Check if SKU already exists and make it unique
              let sku = skuBase;
              let skuCounter = 1;
              let existingProductWithSku = await tx.product.findFirst({
                where: {
                  sku: sku,
                  tenantId: user.tenantId
                }
              });
              
              while (existingProductWithSku && skuCounter < 1000) { // Prevent infinite loop
                const suffix = `-${skuCounter}`;
                const maxLength = Math.max(1, 20 - suffix.length);
                sku = `${skuBase.substring(0, maxLength)}${suffix}`;
                skuCounter++;
                existingProductWithSku = await tx.product.findFirst({
                  where: {
                    sku: sku,
                    tenantId: user.tenantId
                  }
                });
              }
              
              // If we hit the limit, use timestamp-based SKU
              if (skuCounter >= 1000) {
                sku = `${skuBase.substring(0, 10)}-${Date.now().toString().slice(-6)}`;
              }

              // Create new product with initial stock
              try {
                product = await tx.product.create({
                  data: {
                    name: cleanName,
                    sku: sku || null, // SKU is optional
                    description: cleanName || null,
                    category: 'Historical',
                    stockLevel: new Prisma.Decimal(Math.max(0, quantityNum)), // Use Prisma.Decimal for Decimal field
                    reorderPoint: 10,
                    location: 'Default Location',
                    price: parseFloat(String(Math.max(0, unitPriceNum))), // Ensure non-negative price
                    cost: 0, // Default cost to 0 for historical products
                    isService: false,
                    tenant: {
                      connect: { id: user.tenantId }
                    }
                  }
                });
                console.log(`Created new product: ${product.name} (SKU: ${product.sku}) with stock: ${quantityNum}`);
              } catch (createError) {
                console.error(`Failed to create product "${cleanName}":`, createError);
                console.error('Create error details:', {
                  message: createError.message,
                  code: createError.code,
                  sku: sku,
                  name: cleanName,
                  quantityNum: quantityNum,
                  unitPriceNum: unitPriceNum
                });
                throw createError; // Re-throw to be caught by outer catch
              }
            } else {
              // Product exists - add quantity to existing stock
              const currentStock = parseFloat(String(product.stockLevel || 0));
              const newStock = Math.max(0, currentStock + quantityNum);
              
              product = await tx.product.update({
                where: { id: product.id },
                data: { stockLevel: new Prisma.Decimal(newStock) }
              });
              console.log(`Updated product: ${product.name} stock from ${currentStock} to ${newStock}`);
            }

            productId = product.id;
          } catch (productError) {
            console.error(`Error finding/creating product for "${productDescription}":`, productError);
            console.error('Product error details:', {
              message: productError.message,
              stack: productError.stack,
              productDescription: productDescription
            });
            // Continue without product - will create as custom item
            productId = null;
          }

          // Create sale
          const sale = await tx.sale.create({
            data: saleData
          });

          // Create sale item linked to the actual product
          const saleItemData = {
            sale: {
              connect: { id: sale.id }
            },
            description: productDescription,
            quantity: quantityNum,
            unitPrice: unitPriceNum,
            amount: subtotal,
            taxRate: taxRateNum,
            taxAmount: taxAmount,
            discountAmount: discountAmountNum,
            discount: discountAmountNum,
            isCustom: !productId, // Mark as custom only if no product was found/created
          };

          // Add product connection if product exists
          if (productId) {
            saleItemData.product = {
              connect: { id: productId }
            };
          } else {
            // If no product, add custom product data
            saleItemData.customProductData = {
              name: productDescription,
              price: unitPriceNum,
              description: productDescription
            };
          }

          await tx.saleItem.create({
            data: saleItemData
          });

          // Create payment record
          await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: total,
              paymentDate: parsedTransactionDate,
              paymentMethod: normalizedPaymentMethod,
              reference: `Historical Sale ${saleNumber}`,
              notes: `Historical payment for ${saleNumber}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale',
              sourceAccount: normalizedPaymentMethod
            }
          });

          // Update account balance
          await updateAccountBalance(user.tenantId, normalizedPaymentMethod, total, "add");

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
                originalReference: originalReference,
                rowNumber: transaction.rowNumber
              })
            }
          });

          results.successful.push({
            rowNumber: transaction.rowNumber,
            saleNumber: sale.saleNumber,
            total: total,
            customer: customerName || 'Walk-in Customer'
          });
          results.totalProcessed++;

        } catch (error) {
          console.error(`Error processing row ${transaction?.rowNumber || 'unknown'}:`, error);
          console.error(`Error details:`, {
            message: error.message,
            stack: error.stack,
            transaction: JSON.stringify(transaction, null, 2)
          });
          const productDesc = transaction?.productDescription || getColumnValue(transaction, ['Product/Service Description', 'Product/ServiceDescription', 'Product Description', 'Description', 'Product']) || 'Unknown';
          results.failed.push({
            rowNumber: transaction?.rowNumber || 'unknown',
            error: error.message || String(error),
            transaction: productDesc
          });
          }
        }
      }, {
        maxWait: maxWait, // Maximum time to wait for a transaction slot (60 seconds)
        timeout: transactionTimeout // Maximum time the transaction can run (10 minutes or calculated)
      });
    } catch (dbError) {
      console.error('Database transaction error:', dbError);
      console.error('Database error stack:', dbError.stack);
      console.error('Database error code:', dbError.code);
      console.error('Database error meta:', dbError.meta);
      console.error('Number of transactions processed before error:', results.successful?.length || 0);
      console.error('Number of transactions failed before error:', results.failed?.length || 0);
      throw new Error(`Database transaction failed: ${dbError.message || 'Unknown error'}. Code: ${dbError.code || 'N/A'}`);
    }

    // Combine validation errors with processing errors
    const allFailedRows = [
      ...(allErrors || []).map(err => {
        const match = err.match(/Row (\d+):/);
        return {
          rowNumber: match ? parseInt(match[1]) : 0,
          error: err,
          type: 'validation'
        };
      }),
      ...(results.failed || []).map(f => ({ ...f, type: 'processing' }))
    ].sort((a, b) => a.rowNumber - b.rowNumber);

    const validCount = validTransactions ? validTransactions.length : 0;
    const successCount = results.successful ? results.successful.length : 0;
    const failedCount = allFailedRows.length;

    return NextResponse.json({
      message: validCount > 0 
        ? `Batch upload completed. ${successCount} transactions processed successfully. ${failedCount} rows skipped due to errors.`
        : 'Batch upload completed with errors',
      results: {
        totalRows: transactions.length,
        successful: successCount,
        failed: failedCount,
        skipped: failedCount,
        migrationBatch: migrationBatch,
        successfulTransactions: results.successful || [],
        failedTransactions: allFailedRows,
        validationErrors: (allErrors && allErrors.length > 0) ? allErrors : undefined
      }
    }, { status: validCount > 0 ? 200 : 400 });

  } catch (error) {
    console.error('Error processing batch upload:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { 
        error: 'Failed to process batch upload',
        details: error.message || 'Unknown error occurred',
        errorType: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

