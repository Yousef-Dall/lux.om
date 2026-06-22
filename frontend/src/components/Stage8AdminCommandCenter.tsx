import { useEffect, useState } from 'react';

import { getAdminContractDrafts, type JsonRecord } from '../api/contracts';
import { getMarketInsights } from '../api/marketInsights';
import { getAdminReports } from '../api/reports';
import { getAdminReviews } from '../api/reviews';
import { getAdminMarketplaceTransactions } from '../api/transactions';
import { getAdminVerifications } from '../api/verification';

function count(value?: JsonRecord[] | null) {
  return value?.length ?? 0;
}

export default function Stage8AdminCommandCenter({ token }: { token: string | null }) {
  const [summary, setSummary] = useState({
    contracts: 0,
    verifications: 0,
    reports: 0,
    reviews: 0,
    transactions: 0,
    insights: 0
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function load() {
      try {
        const [contracts, verifications, reports, reviews, transactions, insights] = await Promise.all([
          getAdminContractDrafts(token!),
          getAdminVerifications(token!),
          getAdminReports(token!),
          getAdminReviews(token!),
          getAdminMarketplaceTransactions(token!),
          getMarketInsights()
        ]);

        if (!active) return;

        setSummary({
          contracts: count(contracts.contracts),
          verifications: count(verifications.verifications),
          reports: count(reports.reports),
          reviews: count(reviews.reviews),
          transactions: count(transactions.transactions),
          insights: count(insights.insights)
        });
      } catch {
        if (!active) return;
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  if (!token || !loaded) return null;

  const items = [
    ['Contract drafts', summary.contracts],
    ['Verification queue', summary.verifications],
    ['Reports/moderation', summary.reports],
    ['Review moderation', summary.reviews],
    ['Transactions', summary.transactions],
    ['Market insight locations', summary.insights]
  ] as const;

  return (
    <section className="stage8-operations-panel stage8-operations-panel--admin" aria-labelledby="stage8-admin-title">
      <div>
        <p className="eyebrow">Stage 8 command center</p>
        <h2 id="stage8-admin-title">Verification, safety, contracts, reviews, and transactions</h2>
        <p>
          Monitor the integration-ready workflows without claiming live government, escrow, AI, or external verification services.
        </p>
      </div>

      <div className="stage8-operations-grid">
        {items.map(([label, value]) => (
          <article key={label} className="stage8-operations-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
