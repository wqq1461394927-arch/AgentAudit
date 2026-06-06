import { NavLink, useLocation } from 'react-router-dom';

const links = [
  { to: '/', icon: '📊', label: '控制台' },
  { to: '/module1', icon: '📋', label: '任务市场' },
  { to: '/module2', icon: '🤖', label: 'AI审计引擎' },
  { to: '/module3', icon: '🔐', label: 'Commit-Reveal' },
  { to: '/module4', icon: '🔗', label: '漏洞聚类' },
  { to: '/module5', icon: '💰', label: '结算与声誉' },
];

export default function Sidebar() {
  const loc = useLocation();
  const isActive = (to: string) => {
    if (to === '/') return loc.pathname === '/';
    return loc.pathname.startsWith(to);
  };

  return (
    <aside style={{
      width: 240, minHeight: '100vh', background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)', padding: '24px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ padding: '0 12px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>
          ⚡ AgentAudit
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
          智能审计平台 v1.0
        </div>
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            borderRadius: 'var(--radius)', fontSize: '0.9rem', fontWeight: 500,
            color: isActive(l.to) ? '#fff' : 'var(--text-dim)',
            background: isActive(l.to) ? 'var(--primary)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <span>{l.icon}</span>
          {l.label}
        </NavLink>
      ))}
      <div style={{ marginTop: 'auto', padding: '16px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>系统运行中</span>
        </div>
      </div>
    </aside>
  );
}
