import { FormEvent, useEffect, useState } from 'react';

import { getMarketInsightForLocation, getMarketInsights } from '../api/marketInsights';
import MarketInsightsPanel from '../components/MarketInsightsPanel';

export default function MarketInsights() {
  const [insights, setInsights] = useState<Record<string, unknown>[]>([]);
  const [location, setLocation] = useState('Al Mouj');
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMarketInsights()
      .then((response) => {
        setInsights(response.insights);
        setDisclaimer(response.disclaimer);
      })
      .catch(() => setError('Market insights are not available yet.'));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    try {
      const response = await getMarketInsightForLocation({ location, includeSimilarListings: true });
      setInsights([response.insight]);
      setDisclaimer(response.disclaimer);
    } catch {
      setError('Could not load this location yet.');
    }
  }

  return (
    <section className="page-section container market-insights-page">
      <p className="eyebrow">Stage 8 investor intelligence</p>
      <h1>Market insights from real lux.om data</h1>
      <p>
        Explore asking-price signals from approved lux.om listings. These insights are intentionally conservative and are not formal valuations.
      </p>

      <form className="market-insights-search" onSubmit={handleSubmit}>
        <label>
          Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Al Mouj, Muscat Hills, Qurum..." />
        </label>
        <button className="button-link button-link--primary" type="submit">View insight</button>
      </form>

      {error ? <p role="alert" className="form-error">{error}</p> : null}
      <MarketInsightsPanel insights={insights} />
      {disclaimer ? <p className="market-disclaimer">{disclaimer}</p> : null}
    </section>
  );
}
