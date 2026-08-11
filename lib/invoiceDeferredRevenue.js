// lib/invoiceDeferredRevenue.js
import { parseMoney, roundMoney, subtractMoney } from '@/lib/money';

export function computePaymentRecognizedNet({
  paymentAmount,
  invoiceTotal,
  invoiceTaxAmount,
}) {
  const total = parseMoney(invoiceTotal);
  const tax = parseMoney(invoiceTaxAmount);
  const net = subtractMoney(total, tax);
  const pay = parseMoney(paymentAmount);
  if (total <= 0 || pay <= 0 || net <= 0) return 0;
  return roundMoney((pay * net) / total);
}

export function computeFinalPaymentRecognizedNet({
  invoiceNet,
  previouslyRecognizedNet,
}) {
  return roundMoney(
    Math.max(0, subtractMoney(parseMoney(invoiceNet), parseMoney(previouslyRecognizedNet)))
  );
}
