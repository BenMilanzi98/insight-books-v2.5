// lib/recurring-expenses.js

/**
 * Calculate the next run date for a recurring expense based on its configuration
 * @param {Object} expenseData - The recurring expense data
 * @returns {Date} The next run date
 */
export function calculateNextRunDate(expenseData) {
    const startDate = new Date(expenseData.startDate);
    const now = new Date();
    
    // If start date is in the future, that's the next run date
    if (startDate > now) {
      return startDate;
    }
    
    // Initialize nextDate to start date
    let nextDate = new Date(startDate);
    
    // Based on frequency, find the next run date
    switch (expenseData.frequency) {
      case 'weekly':
        const dayOfWeek = parseInt(expenseData.dayOfWeek);
        
        // Adjust to the correct day of week if needed
        if (nextDate.getDay() !== dayOfWeek) {
          // Calculate days to add to get to the correct day of week
          const daysToAdd = (dayOfWeek - nextDate.getDay() + 7) % 7;
          nextDate.setDate(nextDate.getDate() + daysToAdd);
        }
        
        // Keep adding weeks until we find a date in the future
        while (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 7); // Add 1 week
        }
        break;
        
      case 'monthly':
        const dayOfMonth = parseInt(expenseData.dayOfMonth);
        
        // Adjust to the correct day of month
        nextDate.setDate(Math.min(dayOfMonth, getDaysInMonth(nextDate.getFullYear(), nextDate.getMonth() + 1)));
        
        // Keep adding months until we find a date in the future
        while (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(Math.min(dayOfMonth, getDaysInMonth(nextDate.getFullYear(), nextDate.getMonth() + 1)));
        }
        break;
        
      case 'quarterly':
        // Move to the same day but 3 months later
        // Keep adding quarters until we find a date in the future
        while (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 3);
        }
        break;
        
      case 'yearly':
        // Move to the same day but 1 year later
        // Keep adding years until we find a date in the future
        while (nextDate <= now) {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        break;
    }
    
    // Check if the next date exceeds the end date (if endType is 'date')
    if (expenseData.endType === 'date' && expenseData.endDate) {
      const endDate = new Date(expenseData.endDate);
      if (nextDate > endDate) {
        return null; // No more occurrences
      }
    }
    
    return nextDate;
  }
  
  /**
   * Helper function to get the number of days in a month
   * @param {number} year - The year
   * @param {number} month - The month (1-12)
   * @returns {number} The number of days in the month
   */
  function getDaysInMonth(year, month) {
    // Month is 0-indexed in Date constructor but we use 1-indexed
    return new Date(year, month, 0).getDate();
  }
  
  /**
   * Process a recurring expense to create an actual expense
   * @param {Object} recurringExpense - The recurring expense object
   * @param {Object} user - The user object (for audit logs)
   * @returns {Promise<Object>} The created expense and updated recurring expense
   */
  export async function processRecurringExpense(recurringExpense, user, prisma) {
    // Create the actual expense
    const expense = await prisma.expense.create({
      data: {
        description: recurringExpense.description,
        amount: recurringExpense.amount,
        date: new Date(), // Current date
        category: recurringExpense.category,
        status: 'Pending', // New expenses are set to pending by default
        notes: `Auto-generated from recurring expense: ${recurringExpense.description} (ID: ${recurringExpense.id})`,
        submittedById: recurringExpense.createdById,
        tenantId: recurringExpense.tenantId,
      }
    });
    
    // Create a history record
    const history = await prisma.recurringExpenseHistory.create({
      data: {
        recurringExpenseId: recurringExpense.id,
        expenseId: expense.id,
        scheduledDate: recurringExpense.nextRunDate,
        processedDate: new Date(),
        status: 'Success',
      }
    });
    
    // Update the recurring expense
    let updateData = {
      lastRunDate: new Date(),
    };
    
    // If the recurring expense has a remaining occurrences count, decrement it
    if (recurringExpense.endType === 'occurrences' && recurringExpense.remainingOccurrences) {
      updateData.remainingOccurrences = recurringExpense.remainingOccurrences - 1;
      
      // If all occurrences have been processed, mark as completed
      if (updateData.remainingOccurrences <= 0) {
        updateData.status = 'Completed';
        updateData.nextRunDate = null;
      } else {
        // Calculate the next run date
        updateData.nextRunDate = calculateNextRunDate({
          ...recurringExpense,
          startDate: new Date(), // Use current date as the reference point
        });
      }
    } else {
      // Calculate the next run date
      updateData.nextRunDate = calculateNextRunDate({
        ...recurringExpense,
        startDate: new Date(), // Use current date as the reference point
      });
      
      // If no more run dates (reached end date), mark as completed
      if (!updateData.nextRunDate) {
        updateData.status = 'Completed';
      }
    }
    
    // Update the recurring expense
    const updatedRecurringExpense = await prisma.recurringExpense.update({
      where: { id: recurringExpense.id },
      data: updateData
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'RECURRING_EXPENSE_PROCESSED',
        entityType: 'RECURRING_EXPENSE',
        entityId: recurringExpense.id,
        userId: user.id,
        tenantId: recurringExpense.tenantId,
        details: JSON.stringify({
          expenseId: expense.id,
          description: expense.description,
          amount: expense.amount,
          nextRunDate: updatedRecurringExpense.nextRunDate,
          remainingOccurrences: updatedRecurringExpense.remainingOccurrences
        })
      }
    });
    
    return {
      expense,
      recurringExpense: updatedRecurringExpense,
      history
    };
  }