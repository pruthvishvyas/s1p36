import { useContract } from '../../hooks/useContract.js';
import { ROUTES } from '../../utils/routes.js';
import { Icon } from './Icon.jsx';

function NavItem({ item, active }) {
  return (
    <a className={active ? 'nav-item active' : 'nav-item'} href={'#/' + item.id} aria-current={active ? 'page' : undefined}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </a>
  );
}

export function Sidebar({ route }) {
  const contract = useContract();
  const name = contract.data ? contract.data.project.name : 'Dashboard';
  const groups = [];
  for (const r of ROUTES) {
    let g = groups.find(x => x.name === r.group);
    if (!g) {
      g = { name: r.group, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar-brand">{name}</div>
      {groups.map(g => (
        <div className="nav-group" key={g.name || 'more'}>
          {g.name ? <div className="nav-title">{g.name}</div> : null}
          {g.items.map(item => <NavItem key={item.id} item={item} active={item.id === route} />)}
        </div>
      ))}
    </nav>
  );
}
