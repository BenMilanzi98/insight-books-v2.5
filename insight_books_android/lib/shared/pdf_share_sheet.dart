import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

/// Bottom sheet to share a PDF via system picker, with labels for email and WhatsApp.
Future<void> showPdfShareSheet(
  BuildContext context, {
  required XFile file,
  required String title,
  String? body,
}) async {
  final text = body ?? title;
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text(
              title,
              style: Theme.of(ctx).textTheme.titleSmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          ListTile(
            leading: const Icon(Icons.share_outlined),
            title: const Text('Share…'),
            subtitle: const Text('Choose app (Files, Drive, etc.)'),
            onTap: () async {
              Navigator.pop(ctx);
              await SharePlus.instance.share(
                ShareParams(
                  files: [file],
                  subject: title,
                  text: text,
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.email_outlined),
            title: const Text('Email'),
            subtitle: const Text('Attach PDF via Gmail or mail app'),
            onTap: () async {
              Navigator.pop(ctx);
              await SharePlus.instance.share(
                ShareParams(
                  files: [file],
                  subject: title,
                  text: 'Please find the attached PDF.\n\n$text',
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.chat_outlined),
            title: const Text('WhatsApp'),
            subtitle: const Text('Send PDF in a chat'),
            onTap: () async {
              Navigator.pop(ctx);
              await SharePlus.instance.share(
                ShareParams(
                  files: [file],
                  text: text,
                ),
              );
            },
          ),
        ],
      ),
    ),
  );
}
