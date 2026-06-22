import { useEffect, useState } from 'react';

import { getMyContractDrafts } from '../api/contracts';
import { getMyRentSchedules } from '../api/rentPayments';
import { getSavedDashboard, type JsonRecord } from '../api/saved';
import { getMyMarketplaceTransactions } from '../api/transactions';
import { getMyValuations } from '../api/valuations';

function count(value?: JsonRecord[] | null) {
return value?.length ?? 0;
}

export default function Stage8DashboardPanel({ token }: { token: string | null }) {
const [summary, setSummary] = useState({
savedListings: 0,
savedActivities: 0,
savedSearches: 0,
watchlist: 0,
contracts: 0,
rentSchedules: 0,
transactions: 0,
valuations: 0
});
const [loaded, setLoaded] = useState(false);

useEffect(() => {
if (!token) return;


let active = true;

async function load() {
  try {
    const [saved, contracts, rents, transactions, valuations] = await Promise.all([
      getSavedDashboard(token!),
      getMyContractDrafts(token!),
      getMyRentSchedules(token!),
      getMyMarketplaceTransactions(token!),
      getMyValuations(token!)
    ]);

    if (!active) return;

    setSummary({
      savedListings: count(saved.listings),
      savedActivities: count(saved.activities),
      savedSearches: count(saved.searches),
      watchlist: count(saved.watchlist),
      contracts: count(contracts.contracts),
      rentSchedules: count(rents.schedules),
      transactions: count(transactions.transactions),
      valuations: count(valuations.valuations)
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
['Saved listings', summary.savedListings],
['Saved activities', summary.savedActivities],
['Saved searches', summary.savedSearches],
['Investor watchlist', summary.watchlist],
['Contract drafts', summary.contracts],
['Rent schedules', summary.rentSchedules],
['Transactions', summary.transactions],
['Valuation requests', summary.valuations]
] as const;

return ( <section className="stage8-operations-panel" aria-labelledby="stage8-dashboard-title"> <div> <p className="eyebrow">Owner workspace</p> <h2 id="stage8-dashboard-title">Saved items, contracts, payments, and transactions</h2> <p>
Track saved items, contract drafts, rent schedules, payment records, and transaction-readiness workflows. External notifications and official services require approved provider access before activation. </p> </div>


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
