import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useDataset } from '../../hooks/useDataset.js';
import { useChartColors } from '../../hooks/useChartColors.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { guessUnitFormat } from '../../utils/formatters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

function ForecastView({ forecast }) {
  const colors = useChartColors();
  const fmt = useFormat();
  const format = guessUnitFormat(forecast.unit, forecast.metric);
  const hasBand = forecast.forecast.some(r => r.low !== null && r.high !== null);
  const rows = useMemo(() => {
    const out = forecast.history.map(h => ({ t: h.t, history: h.value }));
    if (out.length > 0 && forecast.forecast.length > 0) out[out.length - 1].forecast = out[out.length - 1].history;
    for (const f of forecast.forecast) {
      out.push({ t: f.t, forecast: f.value, low: f.low === null ? undefined : f.low, high: f.high === null ? undefined : f.high });
    }
    return out;
  }, [forecast]);
  const err = forecast.error;
  return (
    <div className="stack">
      <div className="grid">
        <article className="card">
          <div className="kpi-label">Held-out error</div>
          <div className="kpi-value">
            {err ? (err.mape !== null ? fmt.value(err.mape, 'percent') : fmt.value(err.mae, format)) : 'Not measured'}
          </div>
          <p className="muted">
            {err
              ? 'How far off the forecast was on recent history it had not seen' + (err.period ? ' (' + err.period + ')' : '') + '.'
              : 'No accuracy test was recorded for this forecast.'}
          </p>
          {err && err.baselineMae !== null ? <p className="muted">{'A simple baseline was off by ' + fmt.value(err.baselineMae, format) + ' on average.'}</p> : null}
        </article>
        <article className="card">
          <div className="kpi-label">Horizon</div>
          <div className="kpi-value">{forecast.horizon || String(forecast.forecast.length) + ' periods'}</div>
          {forecast.method ? <p className="muted">{'Method: ' + forecast.method}</p> : null}
        </article>
      </div>
      <article className="card chart-card">
        <h3>{forecast.metric ? 'Forecast: ' + forecast.metric : 'Forecast'}</h3>
        <p className="muted">What do the coming periods look like?</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" interval="preserveStartEnd" stroke={colors.grid} tick={{ fill: colors.text, fontSize: 12 }} />
              <YAxis tickFormatter={v => fmt.compact(v)} width={64} stroke={colors.grid} tick={{ fill: colors.text, fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary }}
                labelStyle={{ color: colors.textPrimary }}
                formatter={v => fmt.value(v, format)}
              />
              {hasBand ? <Area type="monotone" dataKey="high" stroke="none" fill={colors.series[1]} fillOpacity={0.25} isAnimationActive={false} legendType="none" /> : null}
              {hasBand ? <Area type="monotone" dataKey="low" stroke="none" fill={colors.surface} fillOpacity={1} isAnimationActive={false} legendType="none" /> : null}
              <Line type="monotone" dataKey="history" stroke={colors.series[0]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey="forecast" stroke={colors.series[1]} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="muted chart-axis">Solid line is history, dashed line is the forecast{hasBand ? ', shaded area is the likely range' : ''}.</p>
      </article>
      {forecast.note ? <p className="muted">{forecast.note}</p> : null}
      <p className="muted">This is a forecast, not a guarantee.</p>
      <p><a href="#/monitor/predict">Try your own numbers on the Predict page</a></p>
    </div>
  );
}

export function Forecaster() {
  const query = useDataset('forecast');
  if (query.loading || query.error) {
    return <DataState query={query} label="forecast" skeleton={<SkeletonCard count={2} height={160} />} />;
  }
  return <ForecastView forecast={query.data} />;
}
