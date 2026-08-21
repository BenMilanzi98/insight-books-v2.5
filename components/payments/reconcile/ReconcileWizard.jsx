'use client';
import { tt } from '@/lib/i18n/runtime';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';
import Button from '@/components/ui/Button';
import StatementStep from './StatementStep.jsx';
import ImportStep from './ImportStep.jsx';
import MatchStep from './MatchStep.jsx';
import ResolveStep from './ResolveStep.jsx';
import {
  WIZARD_STEPS,
  getReconciliationWorkspace,
  listReconcilableAccounts,
} from './reconApi.js';

const MATCH_STEP_INDEX = WIZARD_STEPS.indexOf('match');

const STEP_LABELS = {
  statement: 'Statement',
  import: 'Import',
  match: 'Match',
  resolve: 'Resolve',
  complete: 'Complete',
};

function PlaceholderStep({ name }) {
  return (
    <p className="text-sm text-gray-600">
      {tt('Coming in next tasks')} — {tt(name)}
    </p>
  );
}

export default function ReconcileWizard({ paymentAccountId, initialReconciliationId }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [reconciliationId, setReconciliationId] = useState(initialReconciliationId || null);
  const [workspace, setWorkspace] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshWorkspace = useCallback(async (id) => {
    const target = id || null;
    if (!target) {
      setWorkspace(null);
      return null;
    }
    const data = await getReconciliationWorkspace(target);
    setWorkspace(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!paymentAccountId) {
        setLoading(false);
        setError('Missing payment account.');
        return;
      }
      setLoading(true);
      try {
        const data = await listReconcilableAccounts();
        const found = (data.accounts || []).find((row) => row.id === paymentAccountId) || null;
        if (cancelled) return;
        setAccount(found);
        setError(found ? '' : 'This payment account is not available for reconciliation.');
        if (initialReconciliationId) {
          setReconciliationId(initialReconciliationId);
          await refreshWorkspace(initialReconciliationId);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentAccountId, initialReconciliationId, refreshWorkspace]);

  const stepKey = WIZARD_STEPS[stepIndex] || 'statement';

  const handleActivated = async (id) => {
    setReconciliationId(id);
    setError('');
    try {
      await refreshWorkspace(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleImported = async () => {
    setError('');
    try {
      if (reconciliationId) await refreshWorkspace(reconciliationId);
    } catch (e) {
      setError(
        e.message ||
          tt('Import succeeded but workspace refresh failed. You can continue on Match or go back to Import.')
      );
    }
    setStepIndex(MATCH_STEP_INDEX);
  };

  const canLeaveStatement = Boolean(reconciliationId);
  const goToStep = (index) => {
    if (index < 0 || index >= WIZARD_STEPS.length) return;
    if (index > 0 && !canLeaveStatement) return;
    setStepIndex(index);
  };

  return (
    <div className="w-full max-w-none space-y-6 px-4 pb-10 sm:px-6 lg:px-8 xl:px-10">
      <PosStylePageHeader
        title={account?.name ? `${tt('Reconcile')} ${account.name}` : tt('Reconcile account')}
        description={
          account
            ? `${account.accountType || ''} ${account.coaAccount?.code ? `· ${account.coaAccount.code}` : ''}`.trim()
            : tt('Confirm the statement period and balances to start or continue a reconciliation.')
        }
        actions={
          <PosStyleHeaderButton type="button" onClick={() => router.push('/payments')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tt('Back to Accounts')}
          </PosStyleHeaderButton>
        }
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <nav aria-label={tt('Reconciliation steps')} className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((key, index) => {
          const active = index === stepIndex;
          const locked = index > 0 && !canLeaveStatement;
          return (
            <button
              key={key}
              type="button"
              disabled={locked}
              onClick={() => goToStep(index)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                active
                  ? 'bg-indigo-600 text-white'
                  : locked
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {index + 1}. {tt(STEP_LABELS[key])}
            </button>
          );
        })}
      </nav>

      <PosStylePanel className="p-5 sm:p-6">
        {loading ? (
          <p className="text-sm text-gray-500">{tt('Loading account…')}</p>
        ) : null}

        {!loading && stepKey === 'statement' ? (
          <StatementStep
            paymentAccountId={paymentAccountId}
            reconciliationId={reconciliationId}
            workspace={workspace}
            onActivated={handleActivated}
          />
        ) : null}

        {!loading && stepKey === 'import' ? (
          <ImportStep
            paymentAccountId={paymentAccountId}
            reconciliationId={reconciliationId}
            workspace={workspace}
            onConfirmed={handleImported}
          />
        ) : null}
        {!loading && stepKey === 'match' ? (
          <MatchStep
            paymentAccountId={paymentAccountId}
            reconciliationId={reconciliationId}
            workspace={workspace}
            onRefresh={refreshWorkspace}
          />
        ) : null}
        {!loading && stepKey === 'resolve' ? (
          <ResolveStep
            reconciliationId={reconciliationId}
            workspace={workspace}
            onRefresh={refreshWorkspace}
          />
        ) : null}
        {!loading && stepKey === 'complete' ? <PlaceholderStep name="Complete" /> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={stepIndex === 0}
            onClick={() => goToStep(stepIndex - 1)}
          >
            {tt('Back')}
          </Button>
          <Button
            type="button"
            disabled={stepIndex >= WIZARD_STEPS.length - 1 || (stepIndex === 0 && !canLeaveStatement)}
            onClick={() => goToStep(stepIndex + 1)}
          >
            {tt('Next')}
          </Button>
        </div>
      </PosStylePanel>
    </div>
  );
}
