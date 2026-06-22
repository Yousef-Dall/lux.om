import { FormEvent, useEffect, useState } from 'react';

import { getMarketInsightForLocation, getMarketInsights } from '../api/marketInsights';
import MarketInsightsPanel from '../components/MarketInsightsPanel';

export default function MarketInsights() {
const [insights, setInsights] = useState<Record<string, unknown>[]>([]);
const [location, setLocation] = useState('Al Mouj');
const [disclaimer, setDisclaimer] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(true);
const [searching, setSearching] = useState(false);

useEffect(() => {
let active = true;


getMarketInsights()
  .then((response) => {
    if (!active) return;

    setInsights(response.insights);
    setDisclaimer(response.disclaimer);
    setError('');
  })
  .catch(() => {
    if (active) setError('Market insights are not available yet.');
  })
  .finally(() => {
    if (active) setLoading(false);
  });

return () => {
  active = false;
};


}, []);

async function handleSubmit(event: FormEvent) {
event.preventDefault();


const trimmedLocation = location.trim();

if (!trimmedLocation) {
  setError('Enter a location to view market insight data.');
  return;
}

try {
  setSearching(true);
  setError('');

  const response = await getMarketInsightForLocation({
    location: trimmedLocation,
    includeSimilarListings: true
  });

  setInsights([response.insight]);
  setDisclaimer(response.disclaimer);
} catch {
  setError('Could not load this location yet.');
} finally {
  setSearching(false);
}


}

return ( <section className="page-section container market-insights-page"> <div className="market-insights-hero"> <p className="eyebrow">Investor intelligence</p> <h1>Market insights from real lux.om data</h1> <p>
Explore conservative asking-price signals from approved lux.om listings. Insights improve as more verified marketplace data becomes available and are not formal valuations. </p> </div>


  <form className="market-insights-search" onSubmit={handleSubmit}>
    <label>
      Search location
      <input
        value={location}
        onChange={(event) => {
          setLocation(event.target.value);
          setError('');
        }}
        placeholder="Al Mouj, Muscat Hills, Qurum..."
      />
    </label>

    <button className="button-link button-link--primary" type="submit" disabled={searching}>
      {searching ? 'Loading...' : 'View insight'}
    </button>
  </form>

  {error ? (
    <p role="alert" className="form-error">
      {error}
    </p>
  ) : null}

  {loading ? (
    <div className="market-insights-empty" role="status">
      <strong>Loading market insights...</strong>
      <p>We are checking approved lux.om listing data.</p>
    </div>
  ) : (
    <MarketInsightsPanel insights={insights} />
  )}

  {disclaimer ? <p className="market-disclaimer">{disclaimer}</p> : null}
</section>


);
}
