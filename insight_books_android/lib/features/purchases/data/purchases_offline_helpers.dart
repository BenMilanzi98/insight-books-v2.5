import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';

import '../domain/purchases_models.dart';
import 'purchases_offline_queue.dart';
import 'purchases_repository.dart';

final purchasesOfflineQueueProvider =
    Provider<PurchasesOfflineQueue>((ref) => PurchasesOfflineQueue());

/// Thrown when a create was queued offline instead of posted.
class PurchasesQueuedException implements Exception {
  PurchasesQueuedException(this.queueId, this.optimistic);

  final String queueId;
  final Object optimistic;

  @override
  String toString() => 'PurchasesQueuedException($queueId)';
}

String offlineEntityId(String queueId) => 'offline-$queueId';

String offlineActionLabel(String action) {
  switch (action) {
    case 'create_supplier':
      return 'Create supplier';
    case 'create_order':
      return 'Create purchase order';
    case 'create_bill':
      return 'Create supplier bill';
    case 'create_receipt':
      return 'Create receipt';
    case 'create_payment':
      return 'Record payment';
    default:
      return action;
  }
}

Future<T> postOrEnqueue<T>({
  required Future<T> Function() post,
  required PurchasesOfflineQueue queue,
  required String tenantId,
  required PurchasesOfflineAction action,
  required Map<String, dynamic> payload,
  required T Function(String queueId) buildOptimistic,
}) async {
  try {
    return await post();
  } catch (e) {
    if (!NetworkErrorMapper.isConnectionError(e)) rethrow;
    if (tenantId.isEmpty) {
      throw Exception('Business context missing. Cannot queue offline.');
    }
    final result = await queue.enqueue(
      tenantId: tenantId,
      action: action,
      payload: payload,
    );
    final queueId = '${result['id']}';
    throw PurchasesQueuedException(
      queueId,
      buildOptimistic(queueId) as Object,
    );
  }
}

PurchaseSupplier buildOptimisticSupplier(
  String queueId,
  Map<String, dynamic> body,
) {
  return PurchaseSupplier(
    id: offlineEntityId(queueId),
    supplierName: '${body['supplierName'] ?? 'Supplier'}',
    supplierCode: body['supplierCode']?.toString(),
    contactPerson: body['contactPerson']?.toString(),
    email: body['email']?.toString(),
    phone: body['phone']?.toString(),
    address: body['address']?.toString(),
    paymentTerms: body['paymentTerms'] != null
        ? int.tryParse('${body['paymentTerms']}')
        : null,
    paymentPreference: body['paymentPreference']?.toString(),
    currency: body['currency']?.toString(),
    notes: body['notes']?.toString(),
    isActive: body['isActive'] != false,
    currentBalance: 0,
  );
}

List<PurchaseOrderItem> _optimisticOrderItems(List<dynamic>? rawItems) {
  if (rawItems == null) return const [];
  return rawItems.map((raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    return PurchaseOrderItem(
      id: '',
      lineType: '${item['lineType'] ?? 'goods'}',
      productId: item['productId']?.toString(),
      productUnitId: item['productUnitId']?.toString(),
      expenseCategoryId: item['expenseCategoryId']?.toString(),
      description: item['description']?.toString(),
      quantityOrdered: (item['quantityOrdered'] as num?)?.toDouble() ?? 0,
      unitCost: (item['unitCost'] as num?)?.toDouble() ?? 0,
      taxTypeId: item['taxTypeId']?.toString(),
      taxRate: (item['taxRate'] as num?)?.toDouble() ?? 0,
      taxAmount: (item['taxAmount'] as num?)?.toDouble() ?? 0,
    );
  }).toList();
}

PurchaseOrder buildOptimisticOrder(
  String queueId,
  Map<String, dynamic> body,
) {
  final items = _optimisticOrderItems(body['items'] as List<dynamic>?);
  final totalAmount = items.fold<double>(
    0,
    (sum, line) => sum + line.quantityOrdered * line.unitCost + line.taxAmount,
  );

  return PurchaseOrder(
    id: offlineEntityId(queueId),
    poNumber: 'Pending sync',
    supplierId: '${body['supplierId'] ?? ''}',
    status: '${body['status'] ?? 'Draft'}',
    orderType: '${body['orderType'] ?? 'goods'}',
    poDate: DateTime.tryParse('${body['poDate'] ?? ''}'),
    expectedDeliveryDate:
        DateTime.tryParse('${body['expectedDeliveryDate'] ?? ''}'),
    totalAmount: totalAmount,
    pricesIncludeTax: body['pricesIncludeTax'] == true,
    notes: body['notes']?.toString(),
    items: items,
  );
}

GoodsReceipt buildOptimisticReceipt(
  String queueId,
  Map<String, dynamic> body,
) {
  final rawItems = body['items'] as List<dynamic>? ?? const [];
  final items = rawItems.map((raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    return GoodsReceiptItem(
      id: '',
      productId: item['productId']?.toString(),
      quantityReceived: (item['quantityReceived'] as num?)?.toDouble() ?? 0,
      unitCost: (item['unitCost'] as num?)?.toDouble() ?? 0,
      purchaseOrderItemId: item['poItemId']?.toString(),
    );
  }).toList();

  final totalAmount = items.fold<double>(
    0,
    (sum, line) => sum + line.quantityReceived * line.unitCost,
  );

  return GoodsReceipt(
    id: offlineEntityId(queueId),
    receiptNumber: 'Pending sync',
    supplierId: '${body['supplierId'] ?? ''}',
    purchaseOrderId: body['purchaseOrderId']?.toString(),
    status: '${body['status'] ?? 'Posted'}',
    receiptDate: DateTime.tryParse('${body['receiptDate'] ?? ''}'),
    totalAmount: totalAmount,
    receiptType: body['receiptType']?.toString(),
    items: items,
  );
}

SupplierBill buildOptimisticBill(
  String queueId,
  Map<String, dynamic> body,
) {
  final totalAmount = (body['totalAmount'] as num?)?.toDouble() ??
      (body['subtotal'] as num?)?.toDouble() ??
      0;

  return SupplierBill(
    id: offlineEntityId(queueId),
    billNumber: body['billNumber']?.toString().trim().isNotEmpty == true
        ? body['billNumber'].toString()
        : 'Pending sync',
    supplierId: '${body['supplierId'] ?? ''}',
    status: '${body['status'] ?? 'Draft'}',
    billDate: DateTime.tryParse('${body['billDate'] ?? ''}'),
    dueDate: DateTime.tryParse('${body['dueDate'] ?? ''}'),
    billType: body['billType']?.toString(),
    totalAmount: totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount,
  );
}

SupplierPayment buildOptimisticPayment(
  String queueId,
  Map<String, dynamic> body,
) {
  final amount = (body['totalAmount'] as num?)?.toDouble() ?? 0;

  return SupplierPayment(
    id: offlineEntityId(queueId),
    supplierId: '${body['supplierId'] ?? ''}',
    amount: amount,
    paymentDate: DateTime.tryParse('${body['paymentDate'] ?? ''}'),
    paymentAccountId: body['paymentMethod']?.toString(),
    reference: body['referenceNumber']?.toString(),
    notes: body['notes']?.toString(),
  );
}

Future<PurchaseSupplier> queueOrCreateSupplier(
  PurchasesRepository repo,
  PurchasesOfflineQueue queue,
  String tenantId,
  Map<String, dynamic> body,
) {
  return postOrEnqueue<PurchaseSupplier>(
    post: () => repo.createSupplier(body),
    queue: queue,
    tenantId: tenantId,
    action: PurchasesOfflineAction.createSupplier,
    payload: body,
    buildOptimistic: (id) => buildOptimisticSupplier(id, body),
  );
}

Future<PurchaseOrder> queueOrCreateOrder(
  PurchasesRepository repo,
  PurchasesOfflineQueue queue,
  String tenantId,
  Map<String, dynamic> body,
) {
  return postOrEnqueue<PurchaseOrder>(
    post: () => repo.createOrder(body),
    queue: queue,
    tenantId: tenantId,
    action: PurchasesOfflineAction.createOrder,
    payload: body,
    buildOptimistic: (id) => buildOptimisticOrder(id, body),
  );
}

Future<GoodsReceipt> queueOrCreateReceipt(
  PurchasesRepository repo,
  PurchasesOfflineQueue queue,
  String tenantId,
  Map<String, dynamic> body,
) {
  return postOrEnqueue<GoodsReceipt>(
    post: () => repo.createReceipt(body),
    queue: queue,
    tenantId: tenantId,
    action: PurchasesOfflineAction.createReceipt,
    payload: body,
    buildOptimistic: (id) => buildOptimisticReceipt(id, body),
  );
}

Future<SupplierBill> queueOrCreateBill(
  PurchasesRepository repo,
  PurchasesOfflineQueue queue,
  String tenantId,
  Map<String, dynamic> body,
) {
  return postOrEnqueue<SupplierBill>(
    post: () => repo.createBill(body),
    queue: queue,
    tenantId: tenantId,
    action: PurchasesOfflineAction.createBill,
    payload: body,
    buildOptimistic: (id) => buildOptimisticBill(id, body),
  );
}

Future<SupplierPayment> queueOrCreatePayment(
  PurchasesRepository repo,
  PurchasesOfflineQueue queue,
  String tenantId,
  Map<String, dynamic> body,
) {
  return postOrEnqueue<SupplierPayment>(
    post: () => repo.createPayment(body),
    queue: queue,
    tenantId: tenantId,
    action: PurchasesOfflineAction.createPayment,
    payload: body,
    buildOptimistic: (id) => buildOptimisticPayment(id, body),
  );
}
