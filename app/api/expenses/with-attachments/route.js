// app/api/expenses/with-attachments/route.js
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { isSystemExpenseStructurePickerAccount } from '@/lib/systemExpenseCategoryCodes.js';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility';

// POST - Create expense with attachments in a single request
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
    
    // Process the form data
    const formData = await request.formData();
    
    // Check if form data contains any files
    let hasFiles = false;
    for (const [key, value] of formData.entries()) {
      if (value instanceof Blob && key !== 'data') {
        hasFiles = true;
        break;
      }
    }
    
    if (!hasFiles) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }
    
    // Get expense data JSON string and parse it
    const expenseDataStr = formData.get('data');
    if (!expenseDataStr) {
      // If no expense data provided, create a default expense
      const defaultExpense = {
        description: "Receipt Upload", 
        amount: 0, 
        date: new Date().toISOString().split('T')[0],
        category: "Other",
        status: "Pending",
        notes: "Created from receipt upload"
      };
      
      return handleExpenseCreation(user, defaultExpense, formData);
    }
    
    let expenseData;
    try {
      expenseData = JSON.parse(expenseDataStr);
      if (!expenseData.description) expenseData.description = "Receipt Upload";
      if (!expenseData.amount && expenseData.amount !== 0) expenseData.amount = 0;
      if (!expenseData.date) expenseData.date = new Date().toISOString().split('T')[0];
      if (!expenseData.category) expenseData.category = "Other";
    } catch (error) {
      console.error('Error parsing expense data:', error);
      expenseData = {
        description: "Receipt Upload", 
        amount: 0, 
        date: new Date().toISOString().split('T')[0],
        category: "Other",
        status: "Pending"
      };
      return NextResponse.json(
        { error: 'Invalid expense data format' },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!expenseData.description || expenseData.amount === undefined || !expenseData.date) {
        return NextResponse.json(
          { 
            error: 'Description, amount, and date are required in the expense data',
            receivedData: JSON.stringify(expenseData) // Add this for debugging
          },
          { status: 400 }
        );
      }
    
    // Parse amount - convert string to number if needed
    const amount = typeof expenseData.amount === 'string' 
      ? parseFloat(expenseData.amount.replace(/,/g, ''))
      : expenseData.amount;
      
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }
    
    return handleExpenseCreation(user, expenseData, formData);
  } catch (error) {
    console.error('Error creating expense with attachments:', error);
    const message = error?.message || 'Failed to create expense with attachments. Please try again.';
    const directPostingFailure =
      message.includes('consolidation parent') ||
      message.includes('cannot receive direct postings') ||
      message.includes('not open for new postings') ||
      message.includes('Structural chart section headers') ||
      message.includes('not a standard expense category');
    return NextResponse.json(
      { error: directPostingFailure ? message : 'Failed to create expense with attachments. Please try again.' },
      { status: directPostingFailure ? 400 : 500 }
    );
  }
}

// Helper function to handle expense creation and attachment processing
async function handleExpenseCreation(user, expenseData, formData) {
  // Parse amount if needed
  let amount = expenseData.amount;
  if (typeof amount === 'string') {
    amount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(amount)) amount = 0;
  }
  
  // Extract attachments from form data
  const attachments = [];
  for (const [key, value] of formData.entries()) {
    if (key !== 'data' && value instanceof Blob) {
      attachments.push({ key, file: value });
    }
  }
  
  // Start a transaction to create the expense and attachments
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the expense
    let expenseAccount = null;
    let expenseCategoryName = null;
    if (expenseData.expenseAccountId) {
      const ecByPickerId = await tx.expenseCategory.findFirst({
        where: { id: expenseData.expenseAccountId, tenantId: user.tenantId },
        include: {
          account: {
            include: {
              _count: {
                select: {
                  childAccounts: { where: { isActive: true } },
                },
              },
            },
          },
        },
      });
      if (ecByPickerId?.account) {
        expenseAccount = ecByPickerId.account;
        expenseCategoryName = ecByPickerId.name;
      } else {
        expenseAccount = await tx.account.findFirst({
          where: {
            id: expenseData.expenseAccountId,
            tenantId: user.tenantId,
            accountType: 'Expense',
          },
          include: {
            _count: {
              select: {
                childAccounts: { where: { isActive: true } },
              },
            },
          },
        });
      }
    }

    if (!expenseAccount && expenseData.category) {
      expenseAccount = await tx.account.findFirst({
        where: {
          tenantId: user.tenantId,
          accountType: 'Expense',
          accountName: { equals: expenseData.category, mode: 'insensitive' }
        },
        include: {
          _count: {
            select: {
              childAccounts: { where: { isActive: true } },
            },
          },
        },
      });
    }

    if (!expenseAccount) {
      const fallbackAccounts = await tx.account.findMany({
        where: {
          tenantId: user.tenantId,
          accountType: 'Expense',
          isActive: true,
          mergedIntoAccountId: null,
        },
        include: {
          _count: {
            select: {
              childAccounts: { where: { isActive: true } },
            },
          },
        },
        orderBy: { accountCode: 'asc' }
      });
      expenseAccount = fallbackAccounts.find(
        (account) =>
          isSystemExpenseStructurePickerAccount(account) &&
          !accountBlocksDirectPosting(account).blocked
      ) || null;
    }

    if (!expenseAccount) {
      throw new Error('No expense account found. Please configure your Chart of Accounts.');
    }

    if (!isSystemExpenseStructurePickerAccount(expenseAccount)) {
      throw new Error(
        'That account is not a standard expense category. Select a detail account from the EXPENSES (5000) structure in Chart of accounts.'
      );
    }

    const postingBlock = accountBlocksDirectPosting(expenseAccount);
    if (postingBlock.blocked) {
      throw new Error(
        `Cannot post expenses to "${postingBlock.details || expenseAccount.accountName || expenseAccount.accountCode}". ${postingBlock.reason} Choose a sub-account beneath it.`
      );
    }

    const expense = await tx.expense.create({
      data: {
        description: expenseData.description,
        amount: amount,
        date: new Date(expenseData.date),
        category: expenseCategoryName || expenseData.category || expenseAccount.accountName,
        expenseAccountId: expenseAccount.id,
        status: expenseData.status || 'Pending',
        notes: expenseData.notes || null,
        submittedById: user.id,
        tenantId: user.tenantId,
      }
    });
    
    // 2. Process and save attachments
    const savedAttachments = [];
    
    for (const attachment of attachments) {
      const file = attachment.file;
      
      // Validate file type and size
      if (!file.type.match(/^image\/(jpeg|png|gif)$/) && !file.type.match(/^application\/pdf$/)) {
        continue; // Skip unsupported file types
      }
      
      // Size validation (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        continue; // Skip files that are too large
      }
      
      try {
        // Create a unique filename
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
        
        // Define file path structure: /uploads/tenantId/expenses/expenseId/
        const uploadDir = join(process.cwd(), 'public', 'uploads', user.tenantId, 'expenses', expense.id);
        
        // Create directory if it doesn't exist
        await mkdir(uploadDir, { recursive: true });
        
        // Full path to file
        const filePath = join(uploadDir, uniqueFilename);
        
        // Write file to disk
        const fileBytes = await file.arrayBuffer();
        await writeFile(filePath, Buffer.from(fileBytes));
        
        // Public URL for the file
        const fileUrl = `/uploads/${user.tenantId}/expenses/${expense.id}/${uniqueFilename}`;
        
        // Create attachment record in database
        const attachmentRecord = await tx.expenseAttachment.create({
          data: {
            expenseId: expense.id,
            filename: file.name,
            fileType: file.type,
            fileSize: file.size,
            filePath: fileUrl,
            uploadedById: user.id,
          }
        });
        
        // Add to saved attachments
        savedAttachments.push({
          id: attachmentRecord.id,
          name: attachmentRecord.filename,
          type: attachmentRecord.fileType,
          size: formatFileSize(attachmentRecord.fileSize),
          url: attachmentRecord.filePath,
          date: attachmentRecord.uploadedAt.toISOString().split('T')[0]
        });
      } catch (err) {
        console.error('Error processing file:', err);
        // Continue with other files
      }
    }
    
    // 3. Create an audit log entry
    await tx.auditLog.create({
      data: {
        action: 'EXPENSE_CREATED_WITH_ATTACHMENTS',
        entityType: 'EXPENSE',
        entityId: expense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          attachmentCount: savedAttachments.length
        })
      }
    });
    
    return {
      expense: {
        ...expense,
        // Format the amount for display
        amount: expense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        // Format the date for display
        date: expense.date.toISOString().split('T')[0],
        attachments: savedAttachments
      }
    };
  });
  
  return NextResponse.json({
    message: 'Expense created successfully with attachments',
    expense: result.expense
  }, { status: 201 });
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
}
