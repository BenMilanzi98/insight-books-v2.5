import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';
import 'package:insightbooks_android/core/audio/scan_beep.dart';
import 'package:insightbooks_android/features/pos/presentation/widgets/cart_sheet.dart';

/// Live camera scanner: stays open; calls [onBarcode] per scan; feedback (no auto-close).
class BarcodeScannerScreen extends ConsumerStatefulWidget {
  const BarcodeScannerScreen({
    super.key,
    required this.onBarcode,
  });

  /// Return product name when added to cart, or `null` if not found / error.
  final Future<String?> Function(String code) onBarcode;

  @override
  ConsumerState<BarcodeScannerScreen> createState() =>
      _BarcodeScannerScreenState();
}

class _BarcodeScannerScreenState extends ConsumerState<BarcodeScannerScreen>
    with SingleTickerProviderStateMixin {
  late final MobileScannerController _scanner;
  late final AnimationController _lineAnim;
  var _processing = false;
  _FlashKind? _flash;

  @override
  void initState() {
    super.initState();
    _scanner = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
    _lineAnim = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _lineAnim.dispose();
    _scanner.dispose();
    super.dispose();
  }

  static const _cooldownAfterScan = Duration(seconds: 2);

  void _openCart() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const CartSheet(),
    );
  }

  Future<void> _deviceVibrate({required int durationMs}) async {
    try {
      final has = await Vibration.hasVibrator();
      if (has == true) {
        await Vibration.vibrate(duration: durationMs);
      }
    } catch (_) {}
  }

  Future<void> _feedbackSuccess(String? productName) async {
    HapticFeedback.mediumImpact();
    await Future.wait<void>([
      playScanConfirmBeep(),
      _deviceVibrate(durationMs: 95),
    ]);
    if (!mounted) return;
    setState(() => _flash = _FlashKind.success);
    await Fluttertoast.showToast(
      msg: (productName != null && productName.trim().isNotEmpty)
          ? 'Item added to cart: ${productName.trim()}'
          : 'Item added to cart',
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.TOP,
      backgroundColor: const Color(0xFF1B5E20),
      textColor: Colors.white,
      fontSize: 16,
    );
  }

  Future<void> _feedbackNotFound() async {
    HapticFeedback.heavyImpact();
    await Future.wait<void>([
      playScanErrorTone(),
      _deviceVibrate(durationMs: 130),
    ]);
    if (!mounted) return;
    setState(() => _flash = _FlashKind.error);
    await Fluttertoast.showToast(
      msg: 'Item not found',
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.TOP,
      backgroundColor: const Color(0xFFB71C1C),
      textColor: Colors.white,
      fontSize: 16,
    );
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final b = barcodes.first;
    final code = b.rawValue ?? b.displayValue;
    if (code == null || code.trim().isEmpty) return;

    _processing = true;
    try {
      final name = await widget.onBarcode(code.trim());
      if (!mounted) return;
      if (name != null) {
        await _feedbackSuccess(name);
      } else {
        await _feedbackNotFound();
      }
      await Future<void>.delayed(const Duration(milliseconds: 280));
      if (mounted) setState(() => _flash = null);
    } finally {
      await Future<void>.delayed(_cooldownAfterScan);
      if (mounted) {
        _processing = false;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan barcode'),
        backgroundColor: Colors.black87,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            tooltip: 'View cart',
            icon: const Icon(Icons.shopping_cart_outlined),
            onPressed: _openCart,
          ),
          IconButton(
            tooltip: 'Torch',
            icon: const Icon(Icons.flashlight_on_outlined),
            onPressed: () => _scanner.toggleTorch(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCart,
        icon: const Icon(Icons.shopping_cart_checkout_outlined),
        label: const Text('View cart'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _scanner,
            onDetect: _onDetect,
          ),
          CustomPaint(
            painter: _ScanFramePainter(),
            child: const SizedBox.expand(),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final w = constraints.maxWidth;
              final h = constraints.maxHeight;
              final frameW = w * 0.78;
              final frameH = frameW * 0.55;
              final left = (w - frameW) / 2;
              final top = (h - frameH) / 2 - h * 0.05;
              return AnimatedBuilder(
                animation: _lineAnim,
                builder: (context, child) {
                  final t = _lineAnim.value;
                  final y = top + 8 + (frameH - 16) * ((t * 2) % 1.0);
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned(
                        left: left,
                        top: top,
                        width: frameW,
                        height: frameH,
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.white70, width: 2),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.cyanAccent.withValues(alpha: 0.15),
                                  blurRadius: 16,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: left + 4,
                        top: y,
                        width: frameW - 8,
                        height: 2,
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.cyanAccent.withValues(alpha: 0),
                                  Colors.cyanAccent,
                                  Colors.cyanAccent.withValues(alpha: 0),
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.cyanAccent.withValues(alpha: 0.8),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              );
            },
          ),
          if (_flash != null)
            IgnorePointer(
              child: AnimatedOpacity(
                opacity: _flash == null ? 0 : 0.35,
                duration: const Duration(milliseconds: 120),
                child: ColoredBox(
                  color: _flash == _FlashKind.success
                      ? Colors.greenAccent
                      : Colors.redAccent,
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 100,
            child: Text(
              'After the beep you can scan another item. Wait 2 seconds between scans. '
              'Use View cart to review or checkout.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                shadows: [
                  Shadow(
                    blurRadius: 8,
                    color: Colors.black.withValues(alpha: 0.9),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

enum _FlashKind { success, error }

class _ScanFramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final frameW = w * 0.78;
    final frameH = frameW * 0.55;
    final left = (w - frameW) / 2;
    final top = (h - frameH) / 2 - h * 0.05;
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(left, top, frameW, frameH),
      const Radius.circular(12),
    );
    final overlay = Path()
      ..addRect(Rect.fromLTWH(0, 0, w, h))
      ..addRRect(rrect)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(
      overlay,
      Paint()..color = Colors.black.withValues(alpha: 0.45),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
