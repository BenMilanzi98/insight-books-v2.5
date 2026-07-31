import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/features/stock/domain/stock_models.dart';

void main() {
  test('StockProduct.fromJson maps API product fields', () {
    final p = StockProduct.fromJson({
      'id': 'p1',
      'name': 'Sugar',
      'sku': 'SUG-1',
      'quantityInStock': 12.5,
      'stockLevel': 12.5,
      'unitPrice': 100,
      'costPrice': 80,
      'reorderPoint': 5,
      'status': 'In Stock',
      'category': 'Food',
      'location': 'Shelf A',
      'isService': false,
      'isDeleted': false,
      'totalStockValue': 1000,
    });
    expect(p.id, 'p1');
    expect(p.name, 'Sugar');
    expect(p.quantityInStock, 12.5);
    expect(p.isService, isFalse);
    expect(p.status, 'In Stock');
  });

  test('StockStatistics.fromJson maps statistics payload', () {
    final s = StockStatistics.fromJson({
      'totalItems': 10,
      'serviceCount': 2,
      'totalValue': 5000,
      'lowStock': 1,
      'outOfStock': 0,
    });
    expect(s.totalItems, 10);
    expect(s.serviceCount, 2);
    expect(s.totalValue, 5000);
    expect(s.lowStock, 1);
  });

  test('StockTransaction.fromJson maps transaction fields', () {
    final tx = StockTransaction.fromJson({
      'id': 'tx1',
      'type': 'Stock In',
      'quantity': 5,
      'date': '2026-07-29T10:00:00.000Z',
      'productId': 'p1',
      'product': 'Sugar',
      'user': 'Admin',
      'notes': 'Restock',
      'delta': 5,
    });
    expect(tx.id, 'tx1');
    expect(tx.type, 'Stock In');
    expect(tx.quantity, 5);
    expect(tx.productName, 'Sugar');
    expect(tx.userName, 'Admin');
    expect(tx.delta, 5);
  });

  test('StockTransaction.fromJson maps movement-history shape', () {
    final tx = StockTransaction.fromJson({
      'id': 'tx2',
      'type': 'stock_out',
      'quantity': 2,
      'createdAt': '2026-07-29T12:00:00.000Z',
      'productId': 'p1',
      'product': {'id': 'p1', 'name': 'Sugar'},
      'user': {'id': 'u1', 'name': 'Clerk'},
      'delta': -2,
      'balanceAfter': 10,
    });
    expect(tx.type, 'stock_out');
    expect(tx.productName, 'Sugar');
    expect(tx.userName, 'Clerk');
    expect(tx.balanceAfter, 10);
  });

  test('StockTransfer.fromJson maps transfer payload', () {
    final t = StockTransfer.fromJson({
      'id': 'tr1',
      'status': 'pending',
      'quantity': 4,
      'productId': 'p1',
      'product': {'id': 'p1', 'name': 'Sugar', 'sku': 'SUG-1'},
      'fromBranch': {
        'id': 'b1',
        'name': 'Main',
        'tenant': {'id': 't1', 'name': 'Shop A'},
      },
      'toBranch': {
        'id': 'b2',
        'name': 'Warehouse',
        'tenant': {'id': 't2', 'name': 'Shop B'},
      },
      'notes': 'Restock',
      'createdAt': '2026-07-29T10:00:00.000Z',
      'createdBy': {'id': 'u1', 'name': 'Admin'},
    });
    expect(t.id, 'tr1');
    expect(t.status, 'pending');
    expect(t.quantity, 4);
    expect(t.productName, 'Sugar');
    expect(t.fromBranch?.tenantName, 'Shop A');
    expect(t.toBranch?.tenantName, 'Shop B');
    expect(t.isPending, isTrue);
    expect(t.createdByName, 'Admin');
  });

  test('StockByBranchSummary.fromJson maps branch stock row', () {
    final row = StockByBranchSummary.fromJson({
      'id': 'b1',
      'name': 'Main',
      'code': 'M1',
      'productCount': 12,
      'totalQuantity': 150.5,
      'totalValue': 5000,
    });
    expect(row.id, 'b1');
    expect(row.productCount, 12);
    expect(row.totalQuantity, 150.5);
    expect(row.totalValue, 5000);
  });

  test('ExpiryAlert.fromJson maps expiry alert row', () {
    final alert = ExpiryAlert.fromJson({
      'batchId': 'batch1',
      'productId': 'p1',
      'productName': 'Milk',
      'sku': 'MLK-1',
      'branchId': 'b1',
      'branchName': 'Main',
      'expiryDate': '2026-08-01T00:00:00.000Z',
      'qtyRemaining': 5,
      'unitCost': 100,
      'lineValue': 500,
      'daysRemaining': 3,
      'status': 'urgent',
    });
    expect(alert.batchId, 'batch1');
    expect(alert.productName, 'Milk');
    expect(alert.qtyRemaining, 5);
    expect(alert.isUrgent, isTrue);
    expect(alert.daysRemaining, 3);
  });

  test('ExpiryAlertsResponse.fromJson maps full payload', () {
    final resp = ExpiryAlertsResponse.fromJson({
      'thresholds': {'earlyDays': 30, 'urgentDays': 7},
      'summary': {'expired': 1, 'urgent': 2, 'early': 3, 'totalLineValue': 900},
      'rows': [
        {
          'batchId': 'b1',
          'productId': 'p1',
          'productName': 'Bread',
          'status': 'expired',
          'qtyRemaining': 2,
          'daysRemaining': -1,
        },
      ],
    });
    expect(resp.thresholds.earlyDays, 30);
    expect(resp.summary.expired, 1);
    expect(resp.summary.total, 6);
    expect(resp.rows.length, 1);
    expect(resp.rows.first.isExpired, isTrue);
  });

  test('WriteOffResult.fromJson maps write-off response', () {
    final result = WriteOffResult.fromJson({
      'batchId': 'b1',
      'quantity': 2,
      'lossAmount': 200,
      'productId': 'p1',
    });
    expect(result.lossAmount, 200);
    expect(result.quantity, 2);
  });

  test('RestockResult.fromJson maps restock response', () {
    final result = RestockResult.fromJson({
      'productId': 'p1',
      'restockBatchId': 'nb1',
      'quantityOnHand': 12,
    });
    expect(result.restockBatchId, 'nb1');
    expect(result.quantityOnHand, 12);
  });

  test('ReceivingDataResponse.fromJson maps receiving payload', () {
    final resp = ReceivingDataResponse.fromJson({
      'orderedGoodsOutstanding': [
        {
          'id': 'po1',
          'poNumber': 'PO-001',
          'poDate': '2026-07-01T00:00:00.000Z',
          'status': 'Approved',
          'supplierName': 'Acme',
          'lines': [
            {
              'lineId': 'l1',
              'productId': 'p1',
              'productName': 'Sugar',
              'sku': 'SUG-1',
              'quantityOrdered': 10,
              'quantityReceived': 3,
              'quantityRemaining': 7,
              'unitCost': 80,
            },
          ],
        },
      ],
      'postedInventoryPending': [
        {
          'id': 'gr1',
          'receiptNumber': 'GR-001',
          'receiptDate': '2026-07-15T00:00:00.000Z',
          'status': 'Posted',
          'supplierName': 'Acme',
          'poNumber': 'PO-001',
          'itemCount': 2,
          'items': [
            {
              'id': 'i1',
              'productName': 'Sugar',
              'quantityReceived': 5,
            },
          ],
        },
      ],
      'goodsReceivedPosted': [
        {
          'id': 'gr2',
          'receiptNumber': 'GR-002',
          'receiptDate': '2026-07-10T00:00:00.000Z',
          'status': 'Posted',
          'supplierName': 'Acme',
          'inventoryAppliedAt': '2026-07-10T12:00:00.000Z',
          'itemCount': 1,
        },
      ],
    });
    expect(resp.orderedPoCount, 1);
    expect(resp.pendingReceiptCount, 1);
    expect(resp.receivedReceiptCount, 1);
    expect(resp.unitsStillToReceive, 7);
    expect(resp.orderedGoodsOutstanding.first.poNumber, 'PO-001');
    expect(resp.orderedGoodsOutstanding.first.lines.first.quantityRemaining, 7);
    expect(resp.postedInventoryPending.first.receiptNumber, 'GR-001');
    expect(resp.goodsReceivedPosted.first.inventoryAppliedAt, isNotNull);
  });

  test('StockProduct.fromJson maps barcodes and product units', () {
    final p = StockProduct.fromJson({
      'id': 'p2',
      'name': 'Rice',
      'barcodes': ['111', '222'],
      'units': [
        {
          'id': 'u1',
          'name': 'Kilogram',
          'symbol': 'kg',
          'isBaseUnit': true,
          'conversionToBase': 1,
          'unitPrice': 100,
          'costPrice': 80,
          'quantityInStock': 5,
          'reorderPoint': 1,
          'isDefault': true,
        },
      ],
    });
    expect(p.barcodes, ['111', '222']);
    expect(p.hasUnitManagement, isTrue);
    expect(p.productUnits.first.symbol, 'kg');
  });

  test('StockBaseUnit.fromJson maps nested units', () {
    final base = StockBaseUnit.fromJson({
      'id': 'b1',
      'displayName': 'Weight',
      'units': [
        {'id': 'u1', 'name': 'Kilogram', 'symbol': 'kg', 'isBaseUnit': true},
      ],
    });
    expect(base.displayName, 'Weight');
    expect(base.units.length, 1);
    expect(base.units.first.baseUnitId, 'b1');
  });

  test('StockTaxTypeOption.fromJson maps tax type fields', () {
    final tax = StockTaxTypeOption.fromJson({
      'id': 't1',
      'taxName': 'VAT',
      'taxCode': 'VAT16',
      'taxRate': 16,
      'calculationType': 'Percentage',
    });
    expect(tax.taxName, 'VAT');
    expect(tax.taxRate, 16);
  });
}
