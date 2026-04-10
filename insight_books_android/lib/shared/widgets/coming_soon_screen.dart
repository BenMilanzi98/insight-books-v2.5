import 'package:flutter/material.dart';

/// Placeholder for features not yet available in the mobile app.
/// Shows a polished animated "Coming Soon" message.
class ComingSoonScreen extends StatefulWidget {
  final String title;
  final IconData icon;
  final String? description;

  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.icon,
    this.description,
  });

  @override
  State<ComingSoonScreen> createState() => _ComingSoonScreenState();
}

class _ComingSoonScreenState extends State<ComingSoonScreen>
    with TickerProviderStateMixin {
  late final AnimationController _iconCtrl;
  late final AnimationController _contentCtrl;
  late final Animation<double> _iconScale;
  late final Animation<double> _iconFade;
  late final Animation<double> _contentFade;
  late final Animation<Offset> _contentSlide;

  @override
  void initState() {
    super.initState();
    _iconCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _iconScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _iconCtrl, curve: Curves.elasticOut),
    );
    _iconFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _iconCtrl, curve: Curves.easeOut),
    );

    _contentCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _contentFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _contentCtrl, curve: Curves.easeOut),
    );
    _contentSlide = Tween<Offset>(
      begin: const Offset(0, 16),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _contentCtrl, curve: Curves.easeOutCubic));

    _iconCtrl.forward();
    Future.delayed(const Duration(milliseconds: 250), () {
      if (mounted) _contentCtrl.forward();
    });
  }

  @override
  void dispose() {
    _iconCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedBuilder(
                animation: _iconCtrl,
                builder: (context, _) => Opacity(
                  opacity: _iconFade.value,
                  child: Transform.scale(
                    scale: _iconScale.value,
                    child: Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        color: colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.primary.withValues(alpha: 0.15),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Icon(widget.icon, size: 40, color: colorScheme.primary),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              AnimatedBuilder(
                animation: _contentCtrl,
                builder: (context, _) => Opacity(
                  opacity: _contentFade.value,
                  child: Transform.translate(
                    offset: _contentSlide.value,
                    child: Column(
                      children: [
                        Text(
                          'Coming Soon',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          widget.description ??
                              '${widget.title} is not yet available in the mobile app. '
                                  'Use the web version to access this feature.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
