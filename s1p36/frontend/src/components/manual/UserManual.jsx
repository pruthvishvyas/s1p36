import { useId, useMemo, useState } from 'react';
import { useTerm } from '../../context/TerminologyContext.jsx';
import { useContract } from '../../hooks/useContract.js';
import { Icon } from '../shared/Icon.jsx';
import { GlossaryTable } from './GlossaryTable.jsx';

function Highlight({ text, query }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <span>{text}</span>;
  const lower = text.toLowerCase();
  const parts = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at === -1) {
      parts.push(<span key={'t' + k}>{text.slice(i)}</span>);
      break;
    }
    if (at > i) parts.push(<span key={'t' + k++}>{text.slice(i, at)}</span>);
    parts.push(<mark key={'m' + k++}>{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  return <span>{parts}</span>;
}

function buildSections(term, domain) {
  const rev = term('revenue', { lower: true });
  const prods = term('product', { plural: true, lower: true });
  const prod = term('product', { lower: true });
  const cust = term('customer', { plural: true, lower: true });
  const orders = term('transaction', { plural: true, lower: true });
  const where = domain ? ' for this ' + domain + ' project' : '';
  return [
    { id: 'start', title: 'How to use this dashboard', body: [
      'Understand shows what happened: the key numbers, the charts, the groups and the unusual records.',
      'Decide shows what to do about it: findings, prioritised actions, a what-if tool and goals.',
      'Monitor shows what is coming and what needs attention: the forecast, the Predict page, goal progress and alerts.',
    ] },
    { id: 'overview', title: 'Overview', body: [
      'What you see: key numbers at the top, then charts, each with the question it answers' + where + '.',
      'What it means: the numbers summarise ' + rev + ', ' + orders + ' and ' + prods + ' in the latest analysis run.',
      'What to do: start with a number that moved, then open the chart that explains it.',
    ] },
    { id: 'segments', title: 'Segments', body: [
      'What you see: cards for each group of similar records, with size and share, plus a bar chart of sizes.',
      'What it means: records in one group behave alike. Click a card to see its averages and description.',
      'What to do: focus on the groups that are large or that stand apart on the measures you care about.',
    ] },
    { id: 'anomalies', title: 'Anomalies', body: [
      'What you see: a table of unusual records with the value, what was expected and why it was flagged.',
      'What it means: an anomaly is an unusual day or record that does not match normal behavior. It is a prompt to look, not proof of a problem.',
      'What to do: sort by score, check the top rows, and decide whether they are errors or real events.',
    ] },
    { id: 'insights', title: 'Insights', body: [
      'What you see: findings with evidence and a suggested action, filtered by severity.',
      'What it means: High needs attention first, Medium soon, Low when convenient.',
      'What to do: read the action on each High finding and assign an owner.',
    ] },
    { id: 'recommendations', title: 'Recommendations', body: [
      'What you see: actions grouped as Urgent, High, Medium and Routine, with impact and timing.',
      'What it means: the order is the order to act in.',
      'What to do: work down from Urgent.',
    ] },
    { id: 'whatif', title: 'What-if simulator', body: [
      'What you see: a scenario picker and a slider with baseline and scenario results side by side.',
      'What it means: values between the calculated points are interpolated, so treat results as estimates. The assumptions are listed under the results.',
      'What to do: move the slider to test a change before you commit to it.',
    ] },
    { id: 'goals', title: 'Goals and progress', body: [
      'What you see: each goal with its target, and on the Progress page how far each one has come.',
      'What it means: On track, At risk and Off track compare the latest actual value with the target. Targets you type are saved on this device only.',
      'What to do: check At risk and Off track goals first.',
    ] },
    { id: 'forecast', title: 'Forecast', body: [
      'What you see: history as a solid line, the forecast as a dashed line and, when available, a shaded likely range.',
      'What it means: a forecast is an estimate of the future based on past patterns. The typical error shows how far off it was on recent history it had not seen, compared with a simple baseline.',
      'What to do: plan around the range, not a single point.',
    ] },
    { id: 'predict', title: 'Predict', body: [
      'What you see: a form with the few inputs that matter and a Predict button.',
      'What it means: the result is an estimate from past patterns for the details you enter. Inputs outside the range seen in the data get a caution.',
      'What to do: change one input at a time to see what moves the estimate. Nothing you enter leaves your browser.',
    ] },
    { id: 'alerts', title: 'Alerts', body: [
      'What you see: active alerts sorted by severity, with how long each has been active.',
      'What it means: an alert means a measure crossed a threshold. No alerts is a good result.',
      'What to do: open High alerts first.',
    ] },
    { id: 'explore', title: 'Explore', body: [
      'What you see: filters at the top, a chart over time, one chart per ' + prod + ' attribute and a table.',
      'What it means: every chart recomputes from the filters. Click a bar to filter by it, and click it again to clear. Figures are aggregated, so no individual ' + cust + ' or record is shown.',
      'What to do: use Copy summary to paste the current totals into a message.',
    ] },
    { id: 'charts', title: 'How to read the charts', body: [
      'Bar charts compare groups. Line charts show change over time. Histograms show how values are spread. Scatter charts show whether two measures move together. Heatmaps use stronger color for larger values.',
    ] },
    { id: 'health', title: 'Data health', body: [
      'What you see: when the data was last updated, how many rows it covers, which steps ran and which sections have data.',
      'What to do: if a section is empty, look here first for the reason.',
    ] },
  ];
}

export function UserManual() {
  const term = useTerm();
  const contract = useContract();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const domain = contract.data ? contract.data.project.domain : '';
  const sections = useMemo(() => buildSections(term, domain), [term, domain]);
  const needle = query.trim().toLowerCase();
  const shown = needle ? sections.filter(s => (s.title + ' ' + s.body.join(' ')).toLowerCase().includes(needle)) : sections;
  return (
    <div className="manual">
      <div className="no-print chips">
        <div className="field">
          <label htmlFor={searchId}>Search the guide</label>
          <input id={searchId} type="search" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          <Icon name="print" /> Print
        </button>
      </div>
      {shown.length === 0 ? <p className="card">Nothing in the guide matches that search.</p> : null}
      {shown.map(s => (
        <section key={s.id} aria-labelledby={'guide-' + s.id}>
          <h2 id={'guide-' + s.id}><Highlight text={s.title} query={query} /></h2>
          {s.body.map((p, i) => <p key={i + '-' + s.id}><Highlight text={p} query={query} /></p>)}
        </section>
      ))}
      <section aria-labelledby="guide-glossary">
        <h2 id="guide-glossary">Glossary</h2>
        <GlossaryTable />
      </section>
    </div>
  );
}
