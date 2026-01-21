import { NextResponse } from 'next/server';

// System context about InsightBooks
const SYSTEM_CONTEXT = `You are an AI assistant for InsightBooks, a comprehensive business management system. 

InsightBooks includes the following features:

**User & Role Management:**
- Create, update, and manage users
- Role-based permissions system
- User activity tracking
- Password reset and account management

**Financial Management:**
- Invoicing: Create, send, and manage invoices
- Quotations: Create and convert quotations to invoices
- Expense Tracking: Record and categorize expenses
- Payment Processing: Track payments and receivables
- Financial Reports: Income statements, balance sheets, cash flow

**Inventory & Stock:**
- Stock management with SKU tracking
- Low stock alerts
- Stock movements and transactions
- Inventory valuation
- Supplier management

**Accounting:**
- Chart of Accounts
- Journal Entries
- Trial Balance
- General Ledger
- Capital Account management

**Sales & POS:**
- Point of Sale (POS) system
- Sales receipts
- Sales history and analytics

**HR & Payroll:**
- Employee management
- Leave management
- Attendance tracking
- Payroll processing
- Pension (NPS) and Gratuity management
- Salary advances

**Reports & Analytics:**
- Financial reports
- Sales analysis
- Expense analysis
- Tax summaries
- Custom date range reports

**System Administration:**
- Tenant/Business management
- Global settings
- Audit logs
- Email management
- Subscription management

Help users with:
1. How to use specific features
2. Troubleshooting issues
3. Best practices
4. Navigation guidance
5. Configuration help
6. Understanding reports and data

Be helpful, concise, and professional. If you don't know something specific, guide them to the relevant section or suggest contacting support.`;

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Prepare messages with system context
    const systemMessage = {
      role: 'system',
      content: SYSTEM_CONTEXT
    };

    // TODO: Integrate with a real LLM service for production use
    // Example with OpenAI:
    /*
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_CONTEXT },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const data = await openaiResponse.json();
    const response = data.choices[0].message.content;
    */
    
    // For now, using rule-based responses
    const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    let response = generateResponse(userMessage, messages);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', response: "I'm sorry, I encountered an error processing your request. Please try again or contact support." },
      { status: 500 }
    );
  }
}

// Simple rule-based response generator
// In production, replace this with actual LLM API calls
function generateResponse(userMessage, conversationHistory) {
  // Check for common queries
  if (userMessage.includes('invoice') || userMessage.includes('bill')) {
    return `To manage invoices in InsightBooks:

1. **Create an Invoice:**
   - Navigate to "Invoicing" from the sidebar
   - Click "Create Invoice" or "New Invoice"
   - Fill in client details, items, and amounts
   - Save and send

2. **View Invoices:**
   - Go to the Invoicing page to see all invoices
   - Filter by status (Draft, Sent, Paid, Overdue)
   - Use date range filters for specific periods

3. **Send Invoice:**
   - Open an invoice
   - Click "Send Invoice" to email it to the client

4. **Mark as Paid:**
   - Open a paid invoice
   - Click "Mark as Paid" and record payment details

Need help with a specific invoice task? Let me know!`;
  }

  if (userMessage.includes('expense') || userMessage.includes('spend')) {
    return `To track expenses in InsightBooks:

1. **Record an Expense:**
   - Go to "Expense Tracking" from the sidebar
   - Click "Add Expense" or "New Expense"
   - Enter amount, category, date, and description
   - Attach receipts if needed
   - Save

2. **Expense Categories:**
   - Expenses are organized by categories
   - You can create custom categories in settings
   - Common categories: Office Supplies, Utilities, Travel, etc.

3. **View Expenses:**
   - Use the Expense Tracking page to see all expenses
   - Filter by date range, category, or status
   - Export expense reports for accounting

4. **Recurring Expenses:**
   - Set up recurring expenses for regular bills
   - Automatically creates expense entries on schedule

Would you like help with a specific expense feature?`;
  }

  if (userMessage.includes('user') || userMessage.includes('role') || userMessage.includes('permission')) {
    return `To manage users and roles in InsightBooks:

1. **User Management:**
   - Navigate to "User & Role Management"
   - Click "Add User" to create new users
   - Edit user details, roles, and permissions
   - Deactivate or delete users as needed

2. **Role Management:**
   - Roles define what users can do in the system
   - Common roles: Admin, Manager, Accountant, Sales Staff
   - Each role has specific permissions

3. **Permissions:**
   - Permissions control access to features
   - Examples: invoices.view, expenses.create, reports.export
   - Assign permissions to roles, not individual users

4. **Best Practices:**
   - Create roles first, then assign users to roles
   - Use principle of least privilege
   - Regularly review user access

Need help setting up a specific role or permission?`;
  }

  if (userMessage.includes('stock') || userMessage.includes('inventory') || userMessage.includes('product')) {
    return `To manage inventory in InsightBooks:

1. **Add Products:**
   - Go to "Stock Management"
   - Click "Add Product" or "New Item"
   - Enter product details: name, SKU, price, quantity
   - Set low stock alerts
   - Save

2. **Stock Alerts:**
   - System alerts when stock is low
   - View alerts on the dashboard
   - Click "Restock" to create purchase orders

3. **Stock Movements:**
   - Track all stock transactions
   - View stock history and adjustments
   - Export stock reports

4. **Inventory Valuation:**
   - View current inventory value
   - Generate inventory reports
   - Track stock by location (if multi-location)

5. **Suppliers:**
   - Manage supplier information
   - Link products to suppliers
   - Create purchase orders

Need help with a specific inventory task?`;
  }

  if (userMessage.includes('report') || userMessage.includes('analytics') || userMessage.includes('data')) {
    return `InsightBooks offers comprehensive reporting:

1. **Financial Reports:**
   - Income Statement (Profit & Loss)
   - Balance Sheet
   - Cash Flow Statement
   - Trial Balance
   - Available in "Financial Reporting"

2. **Sales Reports:**
   - Sales analysis by period
   - Product sales performance
   - Customer sales reports
   - Available in Reports section

3. **Expense Reports:**
   - Expense breakdown by category
   - Expense trends over time
   - Tax-deductible expenses
   - Available in Expense Tracking

4. **Inventory Reports:**
   - Stock valuation
   - Stock movement history
   - Low stock alerts
   - Available in Stock Management

5. **Custom Reports:**
   - Use date range filters
   - Export to Excel/PDF
   - Schedule regular reports

Which report would you like help with?`;
  }

  if (userMessage.includes('dashboard') || userMessage.includes('overview')) {
    return `The InsightBooks Dashboard provides:

1. **Today's Performance:**
   - Today's revenue vs yesterday
   - Today's expenses vs yesterday
   - Weekly trend indicators

2. **Financial Summary:**
   - Total revenue for selected period
   - Total expenses for selected period
   - Change percentages

3. **Charts & Visualizations:**
   - Income & Expense bar chart
   - Expense breakdown pie chart
   - Accounts receivable overview
   - Accounts payable overview

4. **Quick Actions:**
   - Stock alerts
   - Recent transactions
   - Upcoming payments

5. **Date Range Filter:**
   - Filter dashboard data by date range
   - Compare different periods
   - Export dashboard data

The dashboard updates automatically as you add transactions. Need help with a specific metric?`;
  }

  if (userMessage.includes('help') || userMessage.includes('how') || userMessage.includes('what')) {
    return `I'm here to help you with InsightBooks! I can assist with:

✅ **Feature Guidance** - How to use specific features
✅ **Troubleshooting** - Resolve common issues
✅ **Best Practices** - Tips for efficient system use
✅ **Navigation** - Help finding features
✅ **Configuration** - Setting up system options
✅ **Reports** - Understanding your data

**Quick Tips:**
- Use the sidebar to navigate between sections
- Most pages have search and filter options
- Export features are available in most sections
- Use date range filters for time-specific data

What specific area would you like help with? You can ask about:
- Invoicing and payments
- Expense tracking
- Inventory management
- User and role management
- Reports and analytics
- Or anything else about InsightBooks!`;
  }

  // Default response
  return `I understand you're asking about "${userMessage}". 

I can help you with various InsightBooks features including:
- User & Role Management
- Financial Operations (Invoices, Expenses, Payments)
- Inventory & Stock Management
- Reports & Analytics
- System Configuration

Could you be more specific about what you need help with? For example:
- "How do I create an invoice?"
- "How do I add a new user?"
- "How do I view my expenses?"
- "How do I check stock levels?"

Or ask me about any other InsightBooks feature!`;
}

