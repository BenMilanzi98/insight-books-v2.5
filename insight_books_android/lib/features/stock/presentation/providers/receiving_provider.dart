import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/stock_repository.dart';
import '../../domain/stock_models.dart';

class ReceivingState {
  const ReceivingState({
    this.data = const ReceivingDataResponse(),
    this.isLoading = false,
    this.error,
    this.canView = true,
    this.isOffline = false,
  });

  final ReceivingDataResponse data;
  final bool isLoading;
  final String? error;
  final bool canView;
  final bool isOffline;

  ReceivingState copyWith({
    ReceivingDataResponse? data,
    bool? isLoading,
    String? error,
    bool? canView,
    bool? isOffline,
  }) {
    return ReceivingState(
      data: data ?? this.data,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      canView: canView ?? this.canView,
      isOffline: isOffline ?? this.isOffline,
    );
  }
}

final receivingControllerProvider =
    NotifierProvider<ReceivingController, ReceivingState>(
  ReceivingController.new,
);

class ReceivingController extends Notifier<ReceivingState> {
  @override
  ReceivingState build() => const ReceivingState();

  StockRepository get _repo => ref.read(stockRepositoryProvider);

  Future<bool> _checkOnline() async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> loadPermissions() async {
    try {
      final perms = await ref.read(userPermissionsProvider.future);
      state = state.copyWith(
        canView: satisfiesPermission(perms, 'stock.view'),
      );
    } catch (_) {
      state = state.copyWith(canView: false);
    }
  }

  Future<void> load() async {
    await loadPermissions();
    if (!state.canView) return;
    await refresh();
  }

  Future<void> refresh() async {
    if (!state.canView) return;
    final online = await _checkOnline();
    if (!online) {
      state = state.copyWith(
        isOffline: true,
        isLoading: false,
        error: 'Receiving data requires an internet connection.',
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null, isOffline: false);
    try {
      final data = await _repo.fetchReceiving();
      state = state.copyWith(
        data: data,
        isLoading: false,
        isOffline: false,
      );
    } catch (e) {
      final offline = NetworkErrorMapper.isConnectionError(e);
      state = state.copyWith(
        isLoading: false,
        isOffline: offline,
        error: offline
            ? 'Receiving data requires an internet connection.'
            : NetworkErrorMapper.toUserMessage(e),
      );
    }
  }
}
