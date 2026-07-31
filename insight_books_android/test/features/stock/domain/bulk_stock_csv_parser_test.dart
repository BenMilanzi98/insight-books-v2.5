import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/features/stock/domain/bulk_stock_csv_parser.dart';

void main() {
  test('parseBulkStockCsv maps headers and validates required fields', () {
    const csv = '''
"Product Name*","SKU*","Category*","Price*","Stock Level*"
"Widget A","W-1","Hardware","1500","10"
"Widget B","W-2","Hardware","2000","5"
''';

    final result = parseBulkStockCsv(csv);
    expect(result.errors, isEmpty);
    expect(result.rows.length, 2);
    expect(result.rows.first.name, 'Widget A');
    expect(result.rows.first.sku, 'W-1');
    expect(result.rows.first.price, 1500);
    expect(result.rows.first.stockLevel, 10);
  });

  test('parseBulkStockCsv reports missing required fields', () {
    const csv = '''
"Product Name*","SKU*","Category*","Price*","Stock Level*"
"","W-1","Hardware","1500","10"
''';

    final result = parseBulkStockCsv(csv);
    expect(result.errors, isNotEmpty);
    expect(result.errors.first, contains('Row 2'));
  });

  test('BulkStockImportRow.toCreateBody maps API fields', () {
    const row = BulkStockImportRow(
      name: 'Sugar',
      sku: 'SUG-1',
      category: 'Food',
      price: 100,
      cost: 80,
      stockLevel: 12,
      reorderPoint: 5,
      barcode: '12345',
    );

    final body = row.toCreateBody();
    expect(body['name'], 'Sugar');
    expect(body['sku'], 'SUG-1');
    expect(body['unitPrice'], 100);
    expect(body['costPrice'], 80);
    expect(body['quantityInStock'], 12);
    expect(body['barcodes'], ['12345']);
    expect(body['unitManagementEnabled'], false);
  });

  test('bulkStockTemplateCsv includes required headers', () {
    final template = bulkStockTemplateCsv();
    expect(template, contains('Product Name*'));
    expect(template, contains('SKU*'));
    expect(template, contains('Category*'));
  });
}
