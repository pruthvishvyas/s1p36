import { useId, useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useContract } from '../../hooks/useContract.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { humanize } from '../../utils/adapters.js';
import { refreshHint } from '../../utils/text.js';
import { guessUnitFormat } from '../../utils/formatters.js';
import { defaultsFor, validateInputs, predict, lookupAt, forecastAt } from '../../utils/predict.js';

export function Predictor() {
  const scorer = useDataset('scorer');
  const lookup = useDataset('forecastLookup');
  const forecast = useDataset('forecast');
  const contract = useContract();

  if (scorer.loading || lookup.loading || forecast.loading) return <SkeletonCard count={2} height={160} />;
  if (scorer.data) return <ModelPredictor scorer={scorer.data} />;
  if (lookup.data) return <LookupPredictor lookup={lookup.data} />;
  if (forecast.data && forecast.data.forecast.length > 0) return <HorizonPredictor forecast={forecast.data} />;
  const reasons = [['Scoring file', scorer.error], ['Lookup file', lookup.error], ['Forecast file', forecast.error]]
    .filter(([, error]) => error)
    .map(([name, error]) => name + ': ' + error.message);
  return <UnavailablePredictor contract={contract.data} reasons={reasons} />;
}

function ModelPredictor({ scorer }) {
  const fmt = useFormat();
  const baseId = useId();
  const [values, setValues] = useState(() => defaultsFor(scorer.fields));
  const [result, setResult] = useState(null);
  const check = useMemo(() => validateInputs(scorer.fields, values), [scorer, values]);

  const setField = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setResult(null);
  };
  const onSubmit = event => {
    event.preventDefault();
    if (check.problems.length > 0) return;
    const prepared = {};
    for (const f of scorer.fields) prepared[f.key] = f.type === 'number' ? Number(values[f.key]) : values[f.key];
    setResult(predict(scorer, prepared));
  };
  const onReset = () => {
    setValues(defaultsFor(scorer.fields));
    setResult(null);
  };
  const labelOf = key => {
    const found = scorer.fields.find(f => f.key === key);
    return found ? found.label : key;
  };

  return (
    <section className="card predictor">
      <header>
        <h2>{scorer.target.label}</h2>
        <p className="muted">Enter the details below and press Predict.</p>
      </header>
      <form className="predictor-form" onSubmit={onSubmit} noValidate>
        <div className="field-grid">
          {scorer.fields.map(field => {
            const id = baseId + '-' + field.key;
            const warning = check.warnings.find(w => w.key === field.key);
            return (
              <div className="field" key={field.key}>
                <label htmlFor={id}>{field.unit ? field.label + ' (' + field.unit + ')' : field.label}</label>
                {field.type === 'number' ? (
                  <input id={id} type="number" inputMode="decimal" value={values[field.key]}
                    min={field.min === null ? undefined : field.min} max={field.max === null ? undefined : field.max}
                    step={field.step} onChange={e => setField(field.key, e.target.value)} />
                ) : (
                  <select id={id} value={values[field.key]} onChange={e => setField(field.key, e.target.value)}>
                    {field.options.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                )}
                {field.help ? <p className="field-help">{field.help}</p> : null}
                {warning ? <p className="field-warning">{warning.message}</p> : null}
              </div>
            );
          })}
        </div>
        {check.problems.length > 0 ? <p className="field-error" role="alert">{check.problems[0].message}</p> : null}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={check.problems.length > 0}>Predict</button>
          <button type="button" className="btn-secondary" onClick={onReset}>Reset</button>
        </div>
      </form>
      <div className="predictor-result" aria-live="polite">
        {result === null ? (
          <p className="muted">Your result will appear here.</p>
        ) : (
          <div>
            <p className="result-value">{fmt.value(result.value, scorer.target.format)}</p>
            {result.label ? <p className="result-label">{'Risk level: ' + result.label}</p> : null}
            {result.low !== null && result.high !== null ? (
              <p className="muted">{'Typical range ' + fmt.value(result.low, scorer.target.format) + ' to ' + fmt.value(result.high, scorer.target.format)}</p>
            ) : null}
            {result.neighbors !== null ? <p className="muted">{'Based on ' + result.neighbors + ' similar records.'}</p> : null}
            {result.drivers.length > 0 ? (
              <ul className="driver-list">
                {result.drivers.filter(d => d.contribution !== 0).map(d => (
                  <li key={d.field}>{labelOf(d.field) + (d.contribution > 0 ? ' raises this estimate' : ' lowers this estimate')}</li>
                ))}
              </ul>
            ) : null}
            <p className="muted">This is an estimate from past patterns, not a guarantee.</p>
            {scorer.fidelity && scorer.fidelity.quality === 'low' ? <p className="field-warning">This estimate is rough for this project.</p> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function LookupPredictor({ lookup }) {
  const fmt = useFormat();
  const id = useId();
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const valid = input !== '' && Number.isFinite(Number(input));
  const first = lookup.table[0].x;
  const last = lookup.table[lookup.table.length - 1].x;

  const onSubmit = event => {
    event.preventDefault();
    if (valid) setResult(lookupAt(lookup.table, Number(input)));
  };
  const onChange = event => {
    setInput(event.target.value);
    setResult(null);
  };

  return (
    <section className="card predictor">
      <header>
        <h2>{lookup.outputLabel}</h2>
        <p className="muted">Enter a value and press Predict.</p>
      </header>
      <form className="predictor-form" onSubmit={onSubmit} noValidate>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={id}>{lookup.inputLabel}</label>
            <input id={id} type="number" inputMode="decimal" value={input} onChange={onChange} />
            <p className="field-help">{'Values between ' + first + ' and ' + last + ' are covered.'}</p>
          </div>
        </div>
        {input !== '' && !valid ? <p className="field-error" role="alert">{lookup.inputLabel + ' needs a number'}</p> : null}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={!valid}>Predict</button>
          <button type="button" className="btn-secondary" onClick={() => { setInput(''); setResult(null); }}>Reset</button>
        </div>
      </form>
      <div className="predictor-result" aria-live="polite">
        {result === null ? (
          <p className="muted">Your result will appear here.</p>
        ) : (
          <div>
            <p className="result-value">{fmt.value(result.value, 'decimal')}</p>
            {result.low !== null && result.high !== null ? (
              <p className="muted">{'Typical range ' + fmt.value(result.low, 'decimal') + ' to ' + fmt.value(result.high, 'decimal')}</p>
            ) : null}
            {result.outside ? <p className="field-warning">This value is outside the range the analysis covers.</p> : null}
            <p className="muted">This is an estimate from past patterns, not a guarantee.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function HorizonPredictor({ forecast }) {
  const fmt = useFormat();
  const id = useId();
  const periods = forecast.forecast.map(row => String(row.t));
  const [period, setPeriod] = useState(periods[0]);
  const [result, setResult] = useState(null);
  const format = guessUnitFormat(forecast.unit, forecast.metric);

  const onSubmit = event => {
    event.preventDefault();
    setResult(forecastAt(forecast, period));
  };

  return (
    <section className="card predictor">
      <header>
        <h2>{forecast.metric ? 'Forecast: ' + forecast.metric : 'Forecast'}</h2>
        <p className="muted">Choose a future period and press Predict.</p>
      </header>
      <form className="predictor-form" onSubmit={onSubmit} noValidate>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={id}>Period</label>
            <select id={id} value={period} onChange={e => { setPeriod(e.target.value); setResult(null); }}>
              {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">Predict</button>
          <button type="button" className="btn-secondary" onClick={() => { setPeriod(periods[0]); setResult(null); }}>Reset</button>
        </div>
      </form>
      <div className="predictor-result" aria-live="polite">
        {result === null ? (
          <p className="muted">Your result will appear here.</p>
        ) : (
          <div>
            <p className="result-value">{fmt.value(result.value, format)}</p>
            {result.low !== null && result.high !== null ? (
              <p className="muted">{'Typical range ' + fmt.value(result.low, format) + ' to ' + fmt.value(result.high, format)}</p>
            ) : null}
            {forecast.error && forecast.error.mape !== null ? (
              <p className="muted">{'Typical error on recent history: ' + fmt.value(forecast.error.mape, 'percent')}</p>
            ) : null}
            <p className="muted">This is a forecast, not a guarantee.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function UnavailablePredictor({ contract, reasons }) {
  const schema = contract && contract.forecaster && Array.isArray(contract.forecaster.input_schema) ? contract.forecaster.input_schema : [];
  const modelFields = contract && contract.model && Array.isArray(contract.model.input_fields) ? contract.model.input_fields : [];
  const preview = schema.length > 0 ? schema : modelFields.map(f => (typeof f === 'object' && f ? f : { name: f }));
  return (
    <section className="card predictor">
      <header>
        <h2>Prediction</h2>
        <p className="muted">
          {'The analysis did not produce a prediction model for this project, or its scoring file is missing. ' + refreshHint()}
        </p>
      </header>
      {reasons.length > 0 ? (
        <ul className="driver-list">
          {reasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      ) : null}
      <form className="predictor-form" onSubmit={event => event.preventDefault()} noValidate>
        <div className="field-grid">
          {preview.map((item, i) => (
            <div className="field" key={String(item.name || item.key || i)}>
              <label>{humanize(item.name || item.key || 'Input')}</label>
              <input type="text" disabled placeholder={Array.isArray(item.range) && item.range.length === 2 ? item.range[0] + ' to ' + item.range[1] : ''} />
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled aria-disabled="true">Predict</button>
        </div>
      </form>
    </section>
  );
}
