import { CreditCard, Landmark, LockKeyhole, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  listPmsCharges,
  listPmsDeposits,
  listPmsFinancialPeriods,
  listPmsOwnerPayouts,
  type PmsCharge,
  type PmsDepositAccount,
  type PmsFinancialPeriod,
  type PmsOwnerPayout,
} from '../api/pmsAdvanced';
import { useAuth } from '../auth/AuthContext';
import { PortalEmpty, PortalError, PortalLoading, PortalPanel } from '../features/portal/PortalState';

function money(value: string, currency: string) {
  return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${currency}`;
}

export default function PmsFinancialOperations() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('companyId') ?? undefined;
  const [charges, setCharges] = useState<PmsCharge[]>([]);
  const [deposits, setDeposits] = useState<PmsDepositAccount[]>([]);
  const [periods, setPeriods] = useState<PmsFinancialPeriod[]>([]);
  const [payouts, setPayouts] = useState<PmsOwnerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        setError('');
        const [chargeResult, depositResult, periodResult, payoutResult] = await Promise.all([
          listPmsCharges(token, companyId),
          listPmsDeposits(token, companyId),
          listPmsFinancialPeriods(token, companyId),
          listPmsOwnerPayouts(token, companyId),
        ]);
        if (!active) return;
        setCharges(chargeResult.charges);
        setDeposits(depositResult.accounts);
        setPeriods(periodResult.periods);
        setPayouts(payoutResult.batches);
      } catch (loadError) {
        if (active) setError(loadError instanceof ApiError ? loadError.message : 'Financial operations could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token, companyId]);

  const balances = useMemo(() => charges.reduce<Record<string, number>>((result, charge) => {
    result[charge.currency] = (result[charge.currency] ?? 0) + Number(charge.balanceAmount);
    return result;
  }, {}), [charges]);

  if (loading) return <section className="pms-portal"><PortalLoading label="Loading financial operations…" /></section>;
  if (error) return <section className="pms-portal"><PortalError message={error} /></section>;

  return (
    <section className="pms-portal" aria-labelledby="financial-operations-title">
      <div className="pms-main">
        <header className="pms-header">
          <div><p className="eyebrow">PMS financial control</p><h1 id="financial-operations-title">Charges, allocations, deposits, and owner payouts</h1><p>Structured balances are grouped by currency. Closed periods protect posted financial history.</p></div>
          <Link className="button-link button-link--secondary" to={`/pms/accounting${companyId ? `?companyId=${companyId}` : ''}`}>Legacy accounting</Link>
        </header>

        <section className="pms-metric-grid" aria-label="Financial summary">
          {Object.entries(balances).map(([currency, balance]) => <article key={currency} className="pms-metric-card"><ReceiptText size={20} aria-hidden="true" /><span>Outstanding charges</span><strong>{money(String(balance), currency)}</strong></article>)}
          <article className="pms-metric-card"><Landmark size={20} aria-hidden="true" /><span>Deposit accounts</span><strong>{deposits.length}</strong></article>
          <article className="pms-metric-card"><LockKeyhole size={20} aria-hidden="true" /><span>Closed periods</span><strong>{periods.filter((period) => period.status === 'CLOSED').length}</strong></article>
          <article className="pms-metric-card"><CreditCard size={20} aria-hidden="true" /><span>Payout batches</span><strong>{payouts.length}</strong></article>
        </section>

        <div className="pms-content-grid">
          <PortalPanel title="Recent structured charges">
            {charges.length === 0 ? <PortalEmpty title="No charges" message="New rent schedules and manual charges will appear here." /> : (
              <div className="pms-table-wrap"><table className="pms-table"><thead><tr><th>Charge</th><th>Property</th><th>Status</th><th>Due</th><th>Balance</th></tr></thead><tbody>{charges.slice(0, 30).map((charge) => <tr key={charge.id}><td>{charge.chargeNumber}</td><td>{charge.property?.name ?? '—'}</td><td>{charge.status}</td><td>{new Date(charge.dueDate).toLocaleDateString()}</td><td>{money(charge.balanceAmount, charge.currency)}</td></tr>)}</tbody></table></div>
            )}
          </PortalPanel>

          <PortalPanel title="Security-deposit liabilities">
            {deposits.length === 0 ? <PortalEmpty title="No deposit accounts" message="Lease deposits remain liabilities until approved deductions or refunds are posted." /> : deposits.slice(0, 20).map((account) => <article key={account.id} className="pms-list-card"><div><strong>{account.property.name} · {account.unit.unitNumber}</strong><span>{account.status}</span></div><b>{money(account.liabilityBalance, account.currency)}</b></article>)}
          </PortalPanel>

          <PortalPanel title="Financial periods">
            {periods.length === 0 ? <PortalEmpty title="No periods" message="Create monthly periods to review and close accounting activity." /> : periods.slice(0, 20).map((period) => <article key={period.id} className="pms-list-card"><div><strong>{period.property?.name ?? 'Company-wide'} · {period.currency}</strong><span>{new Date(period.periodStart).toLocaleDateString()} – {new Date(period.periodEnd).toLocaleDateString()}</span></div><b>{period.status}</b></article>)}
          </PortalPanel>

          <PortalPanel title="Owner payout records">
            {payouts.length === 0 ? <PortalEmpty title="No payout batches" message="Approved manual payout records will appear here; no bank transfer is claimed without evidence." /> : payouts.slice(0, 20).map((payout) => <article key={payout.id} className="pms-list-card"><div><strong>{payout.payoutNumber}</strong><span>{payout.status}</span></div><b>{money(payout.payoutAmount, payout.currency)}</b></article>)}
          </PortalPanel>
        </div>
      </div>
    </section>
  );
}
