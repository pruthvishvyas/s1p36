export const DEFAULT_ROUTE = 'understand/overview';

export const ROUTES = [
  { id: 'understand/overview', group: 'Understand', label: 'Overview', title: 'Overview', icon: 'overview', blurb: 'The key numbers and the charts that explain them.' },
  { id: 'understand/segments', group: 'Understand', label: 'Segments', title: 'Segments', icon: 'segments', blurb: 'Groups of similar records and how large each one is.' },
  { id: 'understand/anomalies', group: 'Understand', label: 'Anomalies', title: 'Anomalies', icon: 'anomalies', blurb: 'Unusual records that do not match normal behavior.' },
  { id: 'decide/insights', group: 'Decide', label: 'Insights', title: 'Insights', icon: 'insights', blurb: 'What the analysis found, with the evidence and what to do.' },
  { id: 'decide/recommendations', group: 'Decide', label: 'Recommendations', title: 'Recommendations', icon: 'list', blurb: 'Prioritised actions, most urgent first.' },
  { id: 'decide/what-if', group: 'Decide', label: 'What-if', title: 'What-if simulator', icon: 'sliders', blurb: 'Move a slider and see how the results change.' },
  { id: 'decide/goals', group: 'Decide', label: 'Goals', title: 'Goals', icon: 'target', blurb: 'The targets this project works toward.' },
  { id: 'monitor/forecast', group: 'Monitor', label: 'Forecast', title: 'Forecast', icon: 'trend', blurb: 'An estimate of the coming periods, with how accurate it has been.' },
  { id: 'monitor/predict', group: 'Monitor', label: 'Predict', title: 'Predict', icon: 'spark', blurb: 'Enter details and get an estimate.' },
  { id: 'monitor/progress', group: 'Monitor', label: 'Progress', title: 'Goal progress', icon: 'progress', blurb: 'How far each goal has come.' },
  { id: 'monitor/alerts', group: 'Monitor', label: 'Alerts', title: 'Alerts', icon: 'bell', blurb: 'Things that need attention right now.' },
  { id: 'explore', group: '', label: 'Explore', title: 'Explore', icon: 'explore', blurb: 'Filter and compare the numbers any way you like.' },
  { id: 'guide', group: '', label: 'Guide', title: 'Guide', icon: 'book', blurb: 'A plain-English manual for every page.' },
  { id: 'health', group: '', label: 'Data health', title: 'Data health', icon: 'pulse', blurb: 'When the data was last updated and what is available.' },
];
