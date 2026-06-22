type MarketInsight = Record<string, unknown>;

type MarketInsightsPanelProps = {
insights: MarketInsight[];
};

function money(value: unknown) {
if (value === null || value === undefined) return 'Not enough data';

const number = Number(value);

return Number.isFinite(number) ? `OMR ${number.toLocaleString()}` : String(value);
}

function numberText(value: unknown) {
const number = Number(value ?? 0);

return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function hasEnoughData(insight: MarketInsight) {
return (
!insight.notEnoughData &&
Boolean(insight.avgAskingPrice || insight.avgRent || insight.avgPricePerSqm)
);
}

export default function MarketInsightsPanel({ insights }: MarketInsightsPanelProps) {
if (!insights.length) {
return ( <div className="market-insights-empty"> <strong>No market insight records yet.</strong> <p>Insights will appear as approved lux.om listings create enough useful location data.</p> </div>
);
}

return ( <div className="market-insights-grid">
{insights.map((insight) => {
const enoughData = hasEnoughData(insight);


    return (
      <article
        className={`market-insight-card${enoughData ? '' : ' market-insight-card--limited'}`}
        key={String(insight.locationKey ?? insight.location)}
      >
        <div className="market-insight-card__header">
          <div>
            <p className="eyebrow">lux.om data</p>
            <h3>{String(insight.location ?? 'Location')}</h3>
          </div>

          <span>{enoughData ? 'Data available' : 'Limited data'}</span>
        </div>

        <dl>
          <div>
            <dt>Avg sale asking price</dt>
            <dd>{money(insight.avgAskingPrice)}</dd>
          </div>

          <div>
            <dt>Avg monthly rent</dt>
            <dd>{money(insight.avgRent)}</dd>
          </div>

          <div>
            <dt>Avg price / sqm</dt>
            <dd>{money(insight.avgPricePerSqm)}</dd>
          </div>

          <div>
            <dt>Sale sample</dt>
            <dd>{numberText(insight.sampleSizeSale)}</dd>
          </div>
        </dl>

        <p>
          {String(
            insight.notes ||
              'Insights are based only on available lux.om listing data and improve as more approved records are added.'
          )}
        </p>
      </article>
    );
  })}
</div>


);
}
