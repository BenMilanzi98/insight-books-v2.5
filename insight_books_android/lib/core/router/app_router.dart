import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/core/router/go_router_refresh.dart';
import 'package:insightbooks_android/core/security/app_route_access.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/login_screen.dart';
import 'package:insightbooks_android/features/splash/presentation/splash_screen.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_screen.dart';
import 'package:insightbooks_android/features/pos/presentation/pos_screen.dart';
import 'package:insightbooks_android/features/tenant/presentation/business_list_screen.dart';
import 'package:insightbooks_android/features/account/presentation/account_screen.dart';
import 'package:insightbooks_android/features/invoice/presentation/invoice_list_screen.dart';
import 'package:insightbooks_android/features/invoice/presentation/create_invoice_screen.dart';
import 'package:insightbooks_android/features/invoice/presentation/invoice_details_screen.dart';
import 'package:insightbooks_android/features/quotation/presentation/quotation_list_screen.dart';
import 'package:insightbooks_android/features/quotation/presentation/quotation_details_screen.dart';
import 'package:insightbooks_android/features/quotation/presentation/create_quotation_screen.dart';
import 'package:insightbooks_android/features/expense/presentation/expense_list_screen.dart';
import 'package:insightbooks_android/features/expense/presentation/expense_details_screen.dart';
import 'package:insightbooks_android/features/expense/presentation/create_expense_screen.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/shared/widgets/coming_soon_screen.dart';

// ---------------------------------------------------------------------------
// Page transition helpers
// ---------------------------------------------------------------------------

class _FadePage<T> extends CustomTransitionPage<T> {
  _FadePage({required super.child, super.key})
      : super(
          transitionDuration: const Duration(milliseconds: 250),
          reverseTransitionDuration: const Duration(milliseconds: 200),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity:
                  CurvedAnimation(parent: animation, curve: Curves.easeOut),
              child: child,
            );
          },
        );
}

class _SlideUpFadePage<T> extends CustomTransitionPage<T> {
  _SlideUpFadePage({required super.child, super.key})
      : super(
          transitionDuration: const Duration(milliseconds: 300),
          reverseTransitionDuration: const Duration(milliseconds: 250),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final curved = CurvedAnimation(
                parent: animation, curve: Curves.easeOutCubic);
            return FadeTransition(
              opacity: curved,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.04, 0),
                  end: Offset.zero,
                ).animate(curved),
                child: child,
              ),
            );
          },
        );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Single [GoRouter] instance; auth/permission changes only re-run [redirect] via
/// [refreshListenable] (see [goRouterRefreshNotifierProvider]).
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ref.watch(goRouterRefreshNotifierProvider);

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final authState = ref.read(authStateProvider);
      final permissionAsync = ref.read(userPermissionsProvider);
      final tenantState = ref.read(tenantProvider);

      final isLoading = authState.isLoading;
      final isAuthenticated = authState.value ?? false;
      final permissions = permissionAsync.asData?.value ?? <String>{};
      final tenantCountForRoute =
          tenantState.isLoading ? null : tenantState.tenants.length;

      final isGoingToLogin = state.matchedLocation == '/login';
      final onSplash = state.matchedLocation == '/splash';

      if (isLoading) {
        return null;
      }

      if (!isAuthenticated && !isGoingToLogin && !onSplash) {
        return '/login';
      }

      if (isAuthenticated && isGoingToLogin) {
        return firstAccessibleRoute(
          permissions,
          tenantCount: tenantCountForRoute,
        );
      }

      if (!isAuthenticated) return null;
      if (onSplash) return null;
      if (permissionAsync.isLoading) return null;

      final location = state.matchedLocation;

      if (location == '/switch-tenant' ||
          location.startsWith('/switch-tenant/')) {
        if (tenantState.isLoading) return null;
        if (!canAccessSwitchTenant(
          permissions: permissions,
          tenantCount: tenantState.tenants.length,
        )) {
          return firstAccessibleRoute(
            permissions,
            tenantCount: tenantState.tenants.length,
          );
        }
      }

      final required = requiredPermissionForLocation(location);
      if (required != null &&
          required.isNotEmpty &&
          !satisfiesPermission(permissions, required)) {
        return firstAccessibleRoute(
          permissions,
          tenantCount: tenantCountForRoute,
        );
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SplashScreen()),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) =>
            _FadePage(child: const LoginScreen(), key: state.pageKey),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return MainLayout(child: child);
        },
        routes: [
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) =>
                _FadePage(child: const DashboardScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/pos',
            pageBuilder: (context, state) =>
                _FadePage(child: const PosScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/invoice',
            pageBuilder: (context, state) => _FadePage(
                child: const InvoiceListScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/invoice/create',
            pageBuilder: (context, state) => _SlideUpFadePage(
                child: const CreateInvoiceScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/invoice/:id',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return _SlideUpFadePage(
                  child: InvoiceDetailsScreen(invoiceId: id),
                  key: state.pageKey);
            },
          ),
          GoRoute(
            path: '/invoice/:id/edit',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return _SlideUpFadePage(
                  child: CreateInvoiceScreen(invoiceId: id),
                  key: state.pageKey);
            },
          ),
          GoRoute(
            path: '/quotation',
            pageBuilder: (context, state) => _FadePage(
                child: const QuotationListScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/quotation/create',
            pageBuilder: (context, state) => _SlideUpFadePage(
                child: const CreateQuotationScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/quotation/:id',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return _SlideUpFadePage(
                  child: QuotationDetailsScreen(quotationId: id),
                  key: state.pageKey);
            },
          ),
          GoRoute(
            path: '/quotation/:id/edit',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return _SlideUpFadePage(
                  child: CreateQuotationScreen(quotationId: id),
                  key: state.pageKey);
            },
          ),
          GoRoute(
            path: '/expenses',
            pageBuilder: (context, state) => _FadePage(
                child: const ExpenseListScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/expenses/create',
            pageBuilder: (context, state) => _SlideUpFadePage(
                child: const CreateExpenseScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/expenses/:id',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return _SlideUpFadePage(
                  child: ExpenseDetailsScreen(expenseId: id),
                  key: state.pageKey);
            },
          ),
          GoRoute(
            path: '/expenses/:id/edit',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return _SlideUpFadePage(
                  child: CreateExpenseScreen(expenseId: id),
                  key: state.pageKey);
            },
          ),
          GoRoute(
            path: '/payments',
            pageBuilder: (context, state) => _FadePage(
              key: state.pageKey,
              child: const ComingSoonScreen(
                title: 'Payments',
                icon: Icons.payments_rounded,
              ),
            ),
          ),
          GoRoute(
            path: '/reports',
            pageBuilder: (context, state) => _FadePage(
              key: state.pageKey,
              child: const ComingSoonScreen(
                title: 'Reports',
                icon: Icons.bar_chart_rounded,
              ),
            ),
          ),
          GoRoute(
            path: '/stock',
            pageBuilder: (context, state) => _FadePage(
              key: state.pageKey,
              child: const ComingSoonScreen(
                title: 'Stock & Inventory',
                icon: Icons.inventory_2_rounded,
              ),
            ),
          ),
          GoRoute(
            path: '/account',
            pageBuilder: (context, state) =>
                _FadePage(child: const AccountScreen(), key: state.pageKey),
          ),
          GoRoute(
            path: '/switch-tenant',
            pageBuilder: (context, state) => _FadePage(
                child: const BusinessListScreen(), key: state.pageKey),
          ),
        ],
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});
