import { useContract } from '../../hooks/useContract.js';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

export function Header() {
  const contract = useContract();
  const summary = useDataset('summary');
  const fmt = useFormat();
  const name = contract.data ? contract.data.project.name : 'Dashboard';
  const when = summary.data && summary.data.lastRun ? summary.data.lastRun : contract.data ? contract.data.generatedAt : '';
  const ago = when ? fmt.ago(when) : '';
  return (
    <header className="header no-print">
      <div>
        <div className="header-title">{name}</div>
        {contract.data && contract.data.project.description ? <p className="muted">{contract.data.project.description}</p> : null}
      </div>
      <div className="header-side">
        {ago ? <span className="muted">{'Updated ' + ago}</span> : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
