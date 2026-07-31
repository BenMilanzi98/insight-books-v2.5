import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/features/purchases/domain/purchases_models.dart';

void main() {
  test('PurchaseSupplier.fromJson maps API fields', () {
    final s = PurchaseSupplier.fromJson({
      'id': 's1',
      'supplierName': 'Acme',
      'supplierCode': 'SUP-1',
      'email': 'a@x.com',
      'phone': '123',
      'isActive': true,
      'currentBalance': 250.5,
    });
    expect(s.id, 's1');
    expect(s.supplierName, 'Acme');
    expect(s.isActive, isTrue);
    expect(s.currentBalance, 250.5);
  });

  test('PurchaseOrder.fromJson maps order + items', () {
    final o = PurchaseOrder.fromJson({
      'id': 'po1',
      'poNumber': 'PO-001',
      'supplierId': 's1',
      'status': 'Approved',
      'orderType': 'goods',
      'totalAmount': 1000,
      'items': [
        {
          'id': 'li1',
          'lineType': 'goods',
          'productId': 'p1',
          'quantityOrdered': 2,
          'unitCost': 500,
        }
      ],
    });
    expect(o.poNumber, 'PO-001');
    expect(o.items.length, 1);
    expect(o.items.first.quantityOrdered, 2);
  });

  test('GoodsReceipt.fromJson maps receipt + items', () {
    final r = GoodsReceipt.fromJson({
      'id': 'gr1',
      'receiptNumber': 'GR-001',
      'supplierId': 's1',
      'purchaseOrderId': 'po1',
      'status': 'Posted',
      'receiptDate': '2026-07-29T10:00:00.000Z',
      'totalAmount': 1500,
      'inventoryAppliedAt': '2026-07-29T11:00:00.000Z',
      'items': [
        {
          'id': 'gri1',
          'productId': 'p1',
          'quantityReceived': 3,
          'unitCost': 500,
        }
      ],
    });
    expect(r.receiptNumber, 'GR-001');
    expect(r.status, 'Posted');
    expect(r.totalAmount, 1500);
    expect(r.items.length, 1);
    expect(r.items.first.quantityReceived, 3);
    expect(r.inventoryAppliedAt, isNotNull);
  });

  test('SupplierBill.fromJson maps bill + balance', () {
    final b = SupplierBill.fromJson({
      'id': 'b1',
      'billNumber': 'BILL-001',
      'supplierId': 's1',
      'status': 'Unpaid',
      'totalAmount': 2000,
      'amountPaid': 500,
      'billType': 'inventory',
      'items': [
        {
          'id': 'bi1',
          'description': 'Sugar',
          'quantity': 10,
          'unitCost': 200,
          'lineTotal': 2000,
        }
      ],
    });
    expect(b.billNumber, 'BILL-001');
    expect(b.totalAmount, 2000);
    expect(b.amountPaid, 500);
    expect(b.balanceDue, 1500);
    expect(b.items.length, 1);
    expect(b.items.first.description, 'Sugar');
  });

  test('SupplierBill.fromJson maps matchingStatus (v2.5)', () {
    final b = SupplierBill.fromJson({
      'id': 'b2',
      'billNumber': 'BILL-002',
      'supplierId': 's1',
      'status': 'Unpaid',
      'matchingStatus': 'EXACT_MATCH',
      'totalAmount': 100,
      'amountPaid': 0,
    });
    expect(b.matchingStatus, 'EXACT_MATCH');
  });

  test('BillMatchResult.fromJson maps match payload', () {
    final result = BillMatchResult.fromJson({
      'matchingStatus': 'RECEIPT_MISSING',
      'blocked': true,
      'issues': [
        {'message': 'No goods receipt linked'},
      ],
    });
    expect(result.matchingStatus, 'RECEIPT_MISSING');
    expect(result.blocked, isTrue);
    expect(result.issueMessages, ['No goods receipt linked']);
  });

  test('SupplierPayment.fromJson maps payment + allocations', () {
    final p = SupplierPayment.fromJson({
      'id': 'pay1',
      'paymentNumber': 'PAY-001',
      'supplierId': 's1',
      'totalAmount': 500,
      'paymentDate': '2026-07-29T12:00:00.000Z',
      'paymentMethod': 'acct1',
      'referenceNumber': 'REF-1',
      'allocations': [
        {
          'id': 'a1',
          'billId': 'b1',
          'amount': 500,
          'bill': {'billNumber': 'BILL-001'},
        }
      ],
    });
    expect(p.paymentNumber, 'PAY-001');
    expect(p.amount, 500);
    expect(p.paymentAccountId, 'acct1');
    expect(p.reference, 'REF-1');
    expect(p.allocations.length, 1);
    expect(p.allocations.first.billId, 'b1');
    expect(p.allocations.first.amount, 500);
    expect(p.allocations.first.billNumber, 'BILL-001');
  });

  test('PurchaseSupplierListResponse.fromJson maps paginated suppliers', () {
    final resp = PurchaseSupplierListResponse.fromJson({
      'suppliers': [
        {'id': 's1', 'supplierName': 'Acme', 'isActive': true},
      ],
      'pagination': {
        'page': 2,
        'limit': 25,
        'totalCount': 50,
        'totalPages': 2,
      },
    });
    expect(resp.items.length, 1);
    expect(resp.items.first.supplierName, 'Acme');
    expect(resp.page, 2);
    expect(resp.totalCount, 50);
    expect(resp.totalPages, 2);
  });

  test('PurchaseOrderListResponse.fromJson maps paginated orders', () {
    final resp = PurchaseOrderListResponse.fromJson({
      'purchaseOrders': [
        {
          'id': 'po1',
          'poNumber': 'PO-001',
          'supplierId': 's1',
          'status': 'Draft',
        },
      ],
      'pagination': {'page': 1, 'totalCount': 1, 'totalPages': 1},
    });
    expect(resp.items.length, 1);
    expect(resp.items.first.poNumber, 'PO-001');
    expect(resp.page, 1);
  });
}
