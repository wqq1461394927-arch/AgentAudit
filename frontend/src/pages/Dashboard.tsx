import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';

const MOCK_LEADERBOARD = [
  { address: '0xAgentD000000000000000000000000C4', reputation: 8920, score: 8920 },
  { address: '0xAgentA000000000000000000000000F1', reputation: 6540, score: 6540 },
  { address: '0xAgentB000000000000000000000000E2', reputation: 5410, score: 5410 },
];

export default function Dashboard() {
  const nav = useNavigate();
  const { state } = useStore();
  const { tasks, clusters, settlements } = state;

  // 实时从共享状态计算统计
  const totalBounty = tasks.reduce((sum, t) => sum + Number(t.metadata?.bounty || 0), 0);
  const stats = [
    { title: '活跃任务', value: tasks.length, icon: '📋', color: '#3b82f6', to: '/module1' },
    { title: '注册Agent', value: 3, icon: '🤖', color: '#8b5cf6', to: '/module2' },
    { title: '已聚类漏洞', value: clusters.length, icon: '🔗', color: '#10b981', to: '/module4' },
    { title: '总锁定赏金', value: `${totalBounty.toFixed(2)} USDC`, icon: '💰', color: '#f59e0b', to: '/module5' },
  ];

  const phaseLabel = (p: number) =>
    ({ 0: '等待中', 1: '审计中', 2: 'Reveal阶段', 3: '聚类中', 4: '确认中', 5: '已结算' } as any)[p] || `阶段${p}`;

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>AgentAudit 控制台</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 28 }}>去中心化智能审计平台 - 协议闭环总览</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map((s) => (
          <div key={s.title} onClick={() => nav(s.to)}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = s.color)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{s.title}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>最近任务
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
              ({tasks.length} 个)
            </span>
          </h2>
          {tasks.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>暂无任务，前往模块1创建</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>名称</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>状态</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>赏金</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 5).map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>#{t.id}</td>
                    <td style={{ padding: '8px 4px', fontSize: '0.85rem' }}>{t.metadata?.name || `Task ${t.id}`}</td>
                    <td style={{ padding: '8px 4px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem',
                        background: t.status === 5 ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                        color: t.status === 5 ? 'var(--success)' : 'var(--primary)',
                      }}>
                        {phaseLabel(typeof t.status === 'number' ? t.status : parseInt(t.phase || '0'))}
                      </span>
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {(Number(t.bountyAmount || 0) / 1e6).toFixed(0)} USDC
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>审计师声誉榜</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>排名</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>地址</th>
                <th style={{ textAlign: 'right', padding: '8px 4px' }}>声誉分</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_LEADERBOARD.map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>
                    {i + 1 <= 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                  </td>
                  <td style={{ padding: '8px 4px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {a.address?.slice(0, 10)}...{a.address?.slice(-4)}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {a.reputation || a.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 32, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>协议闭环流程</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {[
            { m: '模块1', label: '任务创建\n资金锁仓', color: '#3b82f6' },
            { m: '模块2', label: 'AI审计\n漏洞发现', color: '#8b5cf6' },
            { m: '模块3', label: 'Commit\nReveal', color: '#06b6d4' },
            { m: '模块4', label: '漏洞聚类\nVUL-ID', color: '#10b981' },
            { m: '模块5', label: '挑战结算\n奖励分配', color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div onClick={() => nav(`/module${i + 1}`)}
                style={{ background: s.color, padding: '12px 20px', borderRadius: 'var(--radius)',
                  textAlign: 'center', cursor: 'pointer', minWidth: 120, whiteSpace: 'pre-line',
                  fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.5 }}>
                {s.label}
              </div>
              {i < 4 && <span style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
