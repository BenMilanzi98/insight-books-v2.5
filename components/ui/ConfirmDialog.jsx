'use client';

import { tx } from '@/lib/i18n/runtime';
import Dialog from './Dialog';
import Button from './Button';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = {tt('Confirm')},
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tx(title)}
      description={tx(description)}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {tx(cancelLabel)}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {tx(confirmLabel)}
          </Button>
        </div>
      }
    >
      {children}
    </Dialog>
  );
}
