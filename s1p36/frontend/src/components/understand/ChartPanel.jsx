import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useChartColors } from '../../hooks/useChartColors.js';
import { useFormat } from '../../context/FormatContext.jsx';

const short = s => (String(s).length > 14 ? String(s).slice(0, 13) + '...' : String(s));

function guessChartFormat(chart) {
  const text = (chart.title + ' ' + chart.yLabel).toLowerCase();
  if (/(rate|share|%|percent|attainment|pct)/.test(text)) return 'percent';
  if (/(revenue|sales|price|cost|profit|spend)/.test(text)) return 'currency';
  return 'decimal';
}

function axisProps(colors) {
  return { stroke: colors.grid, tick: { fill: colors.text, fontSize: 12 } };
}

function tooltipProps(colors) {
  return {
    contentStyle: { background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary },
    labelStyle: { color: colors.textPrimary },
    itemStyle: { color: colors.textPrimary },
  };
}

function renderBar(chart, colors, fmt, format, selected, onSelect) {
  const rows = chart.rows.length > 40 ? [...chart.rows].sort((a, b) => b.value - a.value).slice(0, 40) : chart.rows;
  const histogram = chart.type === 'histogram';
  const horizontal = !histogram && (rows.some(r => String(r.label).length > 10) || rows.length > 8);
  const onClick = onSelect ? d => onSelect(d && d.payload ? d.payload.label : d.label) : undefined;
  const bars = (
    <Bar dataKey="value" fill={colors.series[0]} isAnimationActive={false} onClick={onClick} cursor={onSelect ? 'pointer' : undefined}>
      {selected
        ? rows.map((r, i) => <Cell key={i + '-' + r.label} fill={r.label === selected ? colors.accent : colors.series[0]} fillOpacity={r.label === selected ? 1 : 0.45} />)
        : null}
    </Bar>
  );
  const tip = <Tooltip {...tooltipProps(colors)} formatter={v => [fmt.value(v, format), chart.yLabel || 'Value']} labelFormatter={l => String(l)} />;
  if (horizontal) {
    return (
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={v => fmt.compact(v)} {...axisProps(colors)} />
        <YAxis type="category" dataKey="label" width={110} tickFormatter={short} interval={rows.length > 16 ? 'preserveStartEnd' : 0} {...axisProps(colors)} />
        {tip}
        {bars}
      </BarChart>
    );
  }
  return (
    <BarChart data={rows} barCategoryGap={histogram ? 0 : '20%'} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
      <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="label" tickFormatter={short} interval="preserveStartEnd" {...axisProps(colors)} />
      <YAxis tickFormatter={v => fmt.compact(v)} width={56} {...axisProps(colors)} />
      {tip}
      {bars}
    </BarChart>
  );
}

function renderLine(chart, colors, fmt, format) {
  return (
    <LineChart data={chart.rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
      <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
      <XAxis dataKey="label" tickFormatter={short} interval="preserveStartEnd" {...axisProps(colors)} />
      <YAxis tickFormatter={v => fmt.compact(v)} width={56} {...axisProps(colors)} />
      <Tooltip {...tooltipProps(colors)} formatter={v => [fmt.value(v, format), chart.yLabel || 'Value']} />
      <Line type="monotone" dataKey="value" stroke={colors.series[0]} strokeWidth={2} dot={chart.rows.length <= 60} isAnimationActive={false} />
    </LineChart>
  );
}

function renderScatter(chart, colors, fmt) {
  return (
    <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
      <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
      <XAxis type="number" dataKey="x" name={chart.xLabel || 'x'} tickFormatter={v => fmt.compact(v)} {...axisProps(colors)} />
      <YAxis type="number" dataKey="y" name={chart.yLabel || 'y'} tickFormatter={v => fmt.compact(v)} width={56} {...axisProps(colors)} />
      <Tooltip {...tooltipProps(colors)} cursor={{ strokeDasharray: '3 3' }} formatter={v => fmt.compact(v)} />
      <Scatter data={chart.rows} fill={colors.series[0]} fillOpacity={0.6} isAnimationActive={false} />
    </ScatterChart>
  );
}

function renderPie(chart, colors, fmt, format) {
  return (
    <PieChart>
      <Pie data={chart.rows} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={chart.type === 'doughnut' ? '55%' : 0} outerRadius="80%" isAnimationActive={false}>
        {chart.rows.map((r, i) => <Cell key={i + '-' + r.label} fill={colors.series[i % colors.series.length]} />)}
      </Pie>
      <Tooltip {...tooltipProps(colors)} formatter={v => fmt.value(v, format)} />
    </PieChart>
  );
}

function HeatMap({ chart, fmt, format }) {
  const rowKeys = [...new Set(chart.rows.map(r => r.row))];
  const colKeys = [...new Set(chart.rows.map(r => r.col))];
  const cells = new Map(chart.rows.map(r => [r.row + '\u0000' + r.col, r.value]));
  const values = chart.rows.map(r => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const showText = colKeys.length <= 10;
  return (
    <div className="chart-box scroll">
      <div className="heatmap" style={{ gridTemplateColumns: 'auto repeat(' + colKeys.length + ', minmax(2.5rem, 1fr))' }}>
        <div />
        {colKeys.map(c => <div key={'h-' + c} className="heat-head" title={c}>{short(c)}</div>)}
        {rowKeys.map(r => [
          <div key={'r-' + r} className="heat-head" title={r}>{short(r)}</div>,
          ...colKeys.map(c => {
            const v = cells.get(r + '\u0000' + c);
            const has = v !== undefined;
            const pct = has ? 10 + ((v - min) / (max - min || 1)) * 80 : 0;
            return (
              <div key={r + '|' + c} className="heat-cell" title={r + ', ' + c + ': ' + (has ? fmt.value(v, format) : '-')}
                style={{ background: 'color-mix(in srgb, var(--color-accent) ' + Math.round(pct) + '%, transparent)' }}>
                {showText && has ? fmt.compact(v) : ''}
              </div>
            );
          }),
        ])}
      </div>
      <table className="sr-only">
        <caption>{chart.title}</caption>
        <thead><tr><th>Row</th><th>Column</th><th>Value</th></tr></thead>
        <tbody>
          {chart.rows.map((r, i) => <tr key={i + '-' + r.row + r.col}><td>{r.row}</td><td>{r.col}</td><td>{fmt.value(r.value, format)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function ChartPanel({ chart, valueFormat, selected, onSelect }) {
  const colors = useChartColors();
  const fmt = useFormat();
  const format = valueFormat || guessChartFormat(chart);
  let body;
  if (chart.type === 'heatmap') {
    body = <HeatMap chart={chart} fmt={fmt} format={format} />;
  } else {
    let inner;
    if (chart.type === 'line') inner = renderLine(chart, colors, fmt, format);
    else if (chart.type === 'scatter') inner = renderScatter(chart, colors, fmt);
    else if (chart.type === 'pie' || chart.type === 'doughnut') inner = renderPie(chart, colors, fmt, format);
    else inner = renderBar(chart, colors, fmt, format, selected, onSelect);
    body = (
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">{inner}</ResponsiveContainer>
      </div>
    );
  }
  const axes = chart.yLabel && chart.xLabel ? chart.yLabel + ' by ' + chart.xLabel : chart.yLabel || chart.xLabel;
  return (
    <article className="card chart-card">
      <h3>{chart.title}</h3>
      {chart.question ? <p className="muted">{chart.question}</p> : null}
      {body}
      {axes ? <p className="muted chart-axis">{axes}</p> : null}
      {chart.rows.length > 40 && chart.type === 'bar' ? <p className="muted">Showing the top 40 by value.</p> : null}
    </article>
  );
}
