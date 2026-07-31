/// Parsed row from a bulk stock import CSV (matches web BulkStockOperations).
class BulkStockImportRow {
  const BulkStockImportRow({
    required this.name,
    required this.sku,
    required this.category,
    this.description,
    this.price = 0,
    this.cost = 0,
    this.stockLevel = 0,
    this.reorderPoint = 0,
    this.location,
    this.supplier,
    this.isPerishable = false,
    this.expiryDate,
    this.discountAmount = 0,
    this.weight = 0,
    this.dimensions,
    this.barcode,
    this.tags,
  });

  final String name;
  final String sku;
  final String category;
  final String? description;
  final num price;
  final num cost;
  final num stockLevel;
  final num reorderPoint;
  final String? location;
  final String? supplier;
  final bool isPerishable;
  final String? expiryDate;
  final num discountAmount;
  final num weight;
  final String? dimensions;
  final String? barcode;
  final String? tags;

  Map<String, dynamic> toCreateBody() {
    final barcodes = <String>[];
    if (barcode != null && barcode!.trim().isNotEmpty) {
      barcodes.add(barcode!.trim());
    }

    return {
      'name': name.trim(),
      'sku': sku.trim(),
      'category': category.trim().isEmpty ? 'Uncategorized' : category.trim(),
      if (description != null && description!.trim().isNotEmpty)
        'description': description!.trim(),
      'unitPrice': price,
      'costPrice': cost,
      'quantityInStock': stockLevel,
      'reorderPoint': reorderPoint,
      'location': (location ?? '').trim().isEmpty
          ? 'Default Location'
          : location!.trim(),
      'isPerishable': isPerishable,
      'isService': false,
      'unitManagementEnabled': false,
      if (barcodes.isNotEmpty) 'barcodes': barcodes,
      if (expiryDate != null && expiryDate!.trim().isNotEmpty)
        'expiryDate': expiryDate!.trim(),
    };
  }

  Map<String, dynamic> toRestoreUpdateBody() {
    return {
      'name': name.trim(),
      'sku': sku.trim(),
      'description': (description ?? '').trim(),
      'category': category.trim().isEmpty ? 'Uncategorized' : category.trim(),
      'stockLevel': stockLevel.toInt(),
      'reorderPoint': reorderPoint.toInt(),
      'location': (location ?? '').trim().isEmpty
          ? 'Default Location'
          : location!.trim(),
      'price': price,
      'cost': cost,
      'isService': false,
      'unitManagementEnabled': false,
    };
  }
}

class BulkStockCsvParseResult {
  const BulkStockCsvParseResult({
    this.rows = const [],
    this.errors = const [],
  });

  final List<BulkStockImportRow> rows;
  final List<String> errors;

  bool get isValid => errors.isEmpty && rows.isNotEmpty;
}

/// Client-side CSV parser aligned with web `BulkStockOperations.parseCSV`.
BulkStockCsvParseResult parseBulkStockCsv(String csvContent) {
  try {
    final lines = csvContent.split(RegExp(r'\r?\n'));
    if (lines.length < 2) {
      return const BulkStockCsvParseResult(
        errors: ['CSV file must have at least a header row and one data row'],
      );
    }

    final headers = _parseCsvLine(lines.first)
        .map((h) => h.trim().replaceAll(RegExp(r'^"|"$'), '').toLowerCase())
        .toList();

    final rows = <BulkStockImportRow>[];
    final validationErrors = <String>[];

    for (var i = 1; i < lines.length; i++) {
      final line = lines[i].trim();
      if (line.isEmpty) continue;

      final values = _parseCsvLine(line)
          .map((v) => v.replaceAll(RegExp(r'^"|"$'), '').trim())
          .toList();

      final padded = List<String>.from(values);
      while (padded.length < headers.length) {
        padded.add('');
      }
      final finalValues = padded.take(headers.length).toList();

      final rowMap = <String, dynamic>{};
      for (var j = 0; j < headers.length; j++) {
        final header = headers[j];
        var value = finalValues[j];

        if (const {'price', 'cost', 'weight', 'discountamount'}.contains(header)) {
          value = '${double.tryParse(value) ?? 0}';
        }
        if (const {'stocklevel', 'reorderpoint'}.contains(header)) {
          value = '${int.tryParse(value) ?? 0}';
        }
        if (header == 'isperishable') {
          value = value.toLowerCase() == 'true' ? 'true' : 'false';
        }

        final fieldName = _headerFieldMap[header] ?? header;
        rowMap[fieldName] = value;
      }

      final row = BulkStockImportRow(
        name: '${rowMap['name'] ?? ''}',
        sku: '${rowMap['sku'] ?? ''}',
        category: '${rowMap['category'] ?? ''}',
        description: rowMap['description']?.toString(),
        price: double.tryParse('${rowMap['price'] ?? rowMap['unitPrice'] ?? 0}') ?? 0,
        cost: double.tryParse('${rowMap['cost'] ?? rowMap['costPrice'] ?? 0}') ?? 0,
        stockLevel:
            int.tryParse('${rowMap['stockLevel'] ?? rowMap['quantityInStock'] ?? 0}') ??
                0,
        reorderPoint: int.tryParse('${rowMap['reorderPoint'] ?? 0}') ?? 0,
        location: rowMap['location']?.toString(),
        supplier: rowMap['supplier']?.toString(),
        isPerishable: '${rowMap['isPerishable']}'.toLowerCase() == 'true',
        expiryDate: rowMap['expiryDate']?.toString(),
        discountAmount:
            double.tryParse('${rowMap['discountAmount'] ?? 0}') ?? 0,
        weight: double.tryParse('${rowMap['weight'] ?? 0}') ?? 0,
        dimensions: rowMap['dimensions']?.toString(),
        barcode: rowMap['barcode']?.toString(),
        tags: rowMap['tags']?.toString(),
      );

      final rowNum = i + 1;
      if (row.name.trim().isEmpty ||
          row.sku.trim().isEmpty ||
          row.category.trim().isEmpty ||
          row.price <= 0) {
        validationErrors.add(
          'Row $rowNum: Missing required fields (name, sku, category, price)',
        );
      } else if (row.stockLevel < 0) {
        validationErrors.add('Row $rowNum: Invalid stock level value');
      } else {
        rows.add(row);
      }
    }

    if (validationErrors.isNotEmpty) {
      return BulkStockCsvParseResult(rows: rows, errors: validationErrors);
    }
    if (rows.isEmpty) {
      return const BulkStockCsvParseResult(
        errors: ['No product rows found in CSV'],
      );
    }
    return BulkStockCsvParseResult(rows: rows);
  } catch (e) {
    return BulkStockCsvParseResult(errors: ['Error parsing CSV: $e']);
  }
}

const _headerFieldMap = <String, String>{
  'product name*': 'name',
  'name': 'name',
  'sku*': 'sku',
  'sku': 'sku',
  'category*': 'category',
  'category': 'category',
  'description': 'description',
  'price*': 'price',
  'price': 'price',
  'cost': 'cost',
  'stock level*': 'stockLevel',
  'stocklevel': 'stockLevel',
  'reorder point': 'reorderPoint',
  'reorderpoint': 'reorderPoint',
  'location': 'location',
  'supplier': 'supplier',
  'is perishable (true/false)': 'isPerishable',
  'isperishable': 'isPerishable',
  'expiry date (yyyy-mm-dd)': 'expiryDate',
  'expirydate': 'expiryDate',
  'discount amount': 'discountAmount',
  'discountamount': 'discountAmount',
  'weight (kg)': 'weight',
  'weight': 'weight',
  'dimensions (lxwxh)': 'dimensions',
  'dimensions': 'dimensions',
  'barcode': 'barcode',
  'tags (comma-separated)': 'tags',
  'tags': 'tags',
};

List<String> _parseCsvLine(String line) {
  final result = <String>[];
  final buffer = StringBuffer();
  var inQuotes = false;

  for (var i = 0; i < line.length; i++) {
    final char = line[i];
    final nextChar = i + 1 < line.length ? line[i + 1] : null;

    if (char == '"') {
      if (inQuotes && nextChar == '"') {
        buffer.write('"');
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char == ',' && !inQuotes) {
      result.add(buffer.toString().trim());
      buffer.clear();
    } else {
      buffer.write(char);
    }
  }

  result.add(buffer.toString().trim());
  return result;
}

String bulkStockTemplateCsv() {
  return [
    '"Product Name*","SKU*","Category*","Description","Price*","Cost","Stock Level*","Reorder Point","Location","Supplier","Is Perishable (true/false)","Expiry Date (YYYY-MM-DD)","Discount Amount","Weight (kg)","Dimensions (LxWxH)","Barcode","Tags (comma-separated)"',
  ].join('\n');
}
