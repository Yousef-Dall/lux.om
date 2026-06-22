type MarketInsight = Record<string, unknown>;

type MarketInsightsPanelProps = {
  insights: MarketInsight[];
};

function money(value: unknown) {
  if (value === null || value === undefined) return 'Not enough data';
  const number = Number(value);
  return Number.isFinite(number) ? `OMR ${number.toLocaleString()}` : String(value);
}

export default function MarketInsightsPanel({ insights }: MarketInsightsPanelProps) {
  return (
    <div className="market-insights-grid">
      {insights.map((insight) => (
        <article className="market-insight-card" key={String(insight.locationKey ?? insight.location)}>
          <p className="eyebrow">lux.om data</p>
          <h3>{String(insight.location ?? 'Location')}</h3>
          <dl>
            <div><dt>Avg sale asking price</dt><dd>{money(insight.avgAskingPrice)}</dd></div>
            <div><dt>Avg monthly rent</dt><dd>{money(insight.avgRent)}</dd></div>
            <div><dt>Avg price / sqm</dt><dd>{money(insight.avgPricePerSqm)}</dd></div>
            <div><dt>Sale sample</dt><dd>{String(insight.sampleSizeSale ?? 0)}</dd></div>
          </dl>
          <p>{String(insight.notes ?? '')}</p>
        </article>
      ))}
    </div>
  );
}
