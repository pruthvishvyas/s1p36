const TERMS = [
  ['Anomaly', 'An unusual day or record that does not match normal behavior.'],
  ['Forecast', 'An estimate of the future based on past patterns.'],
  ['Typical error', 'How far off the forecast was when tested on recent history it had not seen.'],
  ['Baseline', 'A simple rule used as a yardstick.'],
  ['Segment', 'A group of records that behave alike.'],
  ['Severity', 'How urgent a finding or alert is: High, Medium or Low.'],
  ['Priority', 'The order to act in: Urgent, High, Medium or Routine.'],
  ['Prediction', 'An estimate for the details you enter, based on past patterns. It is not a guarantee.'],
  ['Aggregated figures', 'Totals and averages for groups. No single record is shown.'],
];

export function GlossaryTable() {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th scope="col">Term</th><th scope="col">Meaning</th></tr></thead>
        <tbody>
          {TERMS.map(([term, meaning]) => <tr key={term}><td>{term}</td><td>{meaning}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
