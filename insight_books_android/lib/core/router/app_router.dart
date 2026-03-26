import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/auth/presentation/login_screen.dart';
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
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final permissionAsync = ref.watch(userPermissionsProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final isLoading = authState.isLoading;
      final isAuthenticated = authState.value ?? false;
      final permissions = permissionAsync.asData?.value ?? <String>{};

      final isGoingToLogin = state.matchedLocation == '/login';

      if (isLoading) {
        return null;
      }

      if (!isAuthenticated && !isGoingToLogin) {
        return '/login';
      }

      if (isAuthenticated && isGoingToLogin) {
        return '/dashboard';
      }

      if (!isAuthenticated) return null;
      if (permissionAsync.isLoading) return null;

      String? requiredPermission;
      final location = state.matchedLocation;
      if (location.startsWith('/dashboard')) requiredPermission = 'dashboard.view';
      if (location.startsWith('/pos')) requiredPermission = 'sales.view';
      if (location.startsWith('/invoice')) requiredPermission = 'invoices.view';
      if (location.startsWith('/quotation')) requiredPermission = 'quotations.view';
      if (location.startsWith('/expenses')) requiredPermission = 'expenses.view';
      if (location.startsWith('/stock')) requiredPermission = 'inventory.view';
      if (location.startsWith('/reports')) requiredPermission = 'reports.view';
      if (location.startsWith('/account')) requiredPermission = 'system.view';
      if (location.startsWith('/payments')) requiredPermission = 'payments.view';

      if (requiredPermission != null &&
          !hasPermission(permissions, requiredPermission)) {
        if (hasPermission(permissions, 'dashboard.view')) {
          return '/dashboard';
        }
        if (hasPermission(permissions, 'sales.view')) {
          return '/pos';
        }
        if (hasPermission(permissions, 'invoices.view')) {
          return '/invoice';
        }
        if (hasPermission(permissions, 'quotations.view')) {
          return '/quotation';
        }
        if (hasPermission(permissions, 'expenses.view')) {
          return '/expenses';
        }
        return '/switch-tenant';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) {
          return MainLayout(child: child);
        },
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(path: '/pos', builder: (context, state) => const PosScreen()),
          GoRoute(
            path: '/invoice',
            builder: (context, state) => const InvoiceListScreen(),
          ),
          GoRoute(
            path: '/invoice/create',
            builder: (context, state) => const CreateInvoiceScreen(),
          ),
          GoRoute(
            path: '/invoice/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return InvoiceDetailsScreen(invoiceId: id);
            },
          ),
          GoRoute(
            path: '/invoice/:id/edit',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return CreateInvoiceScreen(invoiceId: id);
            },
          ),
          GoRoute(
            path: '/quotation',
            builder: (context, state) => const QuotationListScreen(),
          ),
          GoRoute(
            path: '/quotation/create',
            builder: (context, state) => const CreateQuotationScreen(),
          ),
          GoRoute(
            path: '/quotation/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return QuotationDetailsScreen(quotationId: id);
            },
          ),
          GoRoute(
            path: '/quotation/:id/edit',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return CreateQuotationScreen(quotationId: id);
            },
          ),
          GoRoute(
            path: '/expenses',
            builder: (context, state) => const ExpenseListScreen(),
          ),
          GoRoute(
            path: '/expenses/create',
            builder: (context, state) => const CreateExpenseScreen(),
          ),
          GoRoute(
            path: '/expenses/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return ExpenseDetailsScreen(expenseId: id);
            },
          ),
          GoRoute(
            path: '/expenses/:id/edit',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return CreateExpenseScreen(expenseId: id);
            },
          ),
          GoRoute(
            path: '/payments',
            builder: (context, state) =>
                const Scaffold(body: Center(child: Text('Payments Screen'))),
          ),
          GoRoute(
            path: '/reports',
            builder: (context, state) =>
                const Scaffold(body: Center(child: Text('Reports Screen'))),
          ),
          GoRoute(
            path: '/stock',
            builder: (context, state) =>
                const Scaffold(body: Center(child: Text('Stock Screen'))),
          ),
          GoRoute(
            path: '/account',
            builder: (context, state) => const AccountScreen(),
          ),
          GoRoute(
            path: '/switch-tenant',
            builder: (context, state) => const BusinessListScreen(),
          ),
        ],
      ),
    ],
  );
});
