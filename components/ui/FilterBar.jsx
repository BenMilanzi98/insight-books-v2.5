'use client';
import { tt, tx } from '@/lib/i18n/runtime';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';
import Drawer from './Drawer';

/**
 * Desktop inline filter row; mobile opens FilterDrawer.
 */
export default function FilterBar({ children, className, drawerTitle = 'Filters', actions }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'mb-4 hidden flex-wrap items-end gap-3 md:flex',
          className
        )}
      >
        {children}
        {actions}
      </div>

      <div className="mb-4 flex items-center justify-between gap-2 md:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} className="min-h-11">
          <Filter className="h-4 w-4" aria-hidden="true" />
          {tt('Filters')}
        </Button>
        {actions}
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title={tx(drawerTitle)}>
        <div className="flex flex-col gap-3">{children}</div>
      </Drawer>
    </>
  );
}

