import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/features/invoice/data/invoice_repository.dart';

void main() {
  group('mapInvoiceListStatusForApi', () {
    test('maps chip keys to API status strings', () {
      expect(mapInvoiceListStatusForApi(null), isNull);
      expect(mapInvoiceListStatusForApi(''), isNull);
      expect(mapInvoiceListStatusForApi('all'), isNull);
      expect(mapInvoiceListStatusForApi('draft'), 'Draft');
      expect(mapInvoiceListStatusForApi('pending'), 'Pending');
      expect(mapInvoiceListStatusForApi('paid'), 'Paid');
      expect(mapInvoiceListStatusForApi('overdue'), 'Overdue');
      expect(mapInvoiceListStatusForApi('sent'), 'Sent');
      expect(mapInvoiceListStatusForApi('partial'), 'Partial');
      expect(mapInvoiceListStatusForApi('void'), 'void');
    });

    test('passes through unknown filters unchanged', () {
      expect(mapInvoiceListStatusForApi('Custom'), 'Custom');
    });
  });
}
