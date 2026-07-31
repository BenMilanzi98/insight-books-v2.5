/**
 * Phase 9 — Module Accounting Adapters entry.
 */

export { runCutoverPosting } from './cutoverBridge.js';
export { contextFromSession, submitViaCutover, toIsoDate, amountString } from './baseAdapter.js';
export { postExpenseAccounting } from './expenseAdapter.js';
export { postExpensePaymentAccounting } from './expensePaymentAdapter.js';
export { postInvoiceAccounting } from './invoiceAdapter.js';
export { postCustomerPaymentAccounting } from './customerPaymentAdapter.js';
export { postSupplierBillAccounting } from './supplierBillAdapter.js';
export { postSupplierPaymentAccounting } from './supplierPaymentAdapter.js';
export { postBankChargeAccounting, postInterestIncomeAccounting } from './bankingAdapter.js';
export { postPosSaleAccounting } from './posSaleAdapter.js';
export { postCostOfSalesAccounting } from './costOfSalesAdapter.js';
export { postGoodsReceivedAccounting } from './goodsReceivedAdapter.js';
export { postStockAdjustmentAccounting } from './stockAdjustmentAdapter.js';
export { postCreditNoteAccounting } from './creditNoteAdapter.js';
export { postCustomerRefundAccounting } from './customerRefundAdapter.js';
export {
  postBankTransferAccounting,
  postPayrollAccounting,
  postSalaryAdvanceAccounting,
  postRentalCustomerDepositAccounting,
  postHireSupplierDepositAccounting,
  postHireCostAccrualAccounting,
  postHireAccrualClearedAccounting,
  postAssetAcquiredAccounting,
  postDepreciationAccounting,
  postLoanReceivedAccounting,
  postLoanRepaymentAccounting,
  postCapitalContributionAccounting,
  postTaxSettlementAccounting,
  postSupplierCreditAccounting,
  postOwnerDrawingAccounting,
} from './remainingAdapters.js';
export { SCAFFOLDED_ADAPTERS } from './scaffolds.js';
