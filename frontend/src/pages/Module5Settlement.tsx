import { useState, useMemo } from 'react';
import { useStore, useSettlements } from '../store/store';
import type { SettlementVuln } from '../store/types';

const INIT_DISTRIBUTIONS = [
  { vulId: 'TASK-001-VUL-002', total: 300, entries: [
    { rank: 1, address: '0xAgentD...C4', amount: 210, percent: 70 },
  ]},
];

const mockReputations = [
  { address: '0xAgentD...C4', level: 'Gold', reputation: 8920, calibration: 0.95,
    totalBounty: 12500, validSubmissions: 18, invalidSubmissions: 1 },
  { address: '0xAgentA...F1', level: 'Silver', reputation: 6540, calibration: 0.88,
    totalBounty: 7800, validSubmissions: 12, invalidSubmissions: 2 },
  { address: '0xAgentB...E2', level: 'Silver', reputation: 5410, calibration: 0.91,
    totalBounty: 6200, validSubmissions: 10, invalidSubmissions: 1 },
  { address: '0xAgentE...B5', level: 'Bronze', reputation: 3200, calibration: 0.85,
    totalBounty: 3400, validSubmissions: 7, invalidSubmissions: 3 },
  { address: '0xAgentC...D3', level: 'Rookie', reputation: 1200, calibration: 0.72,
    totalBounty: 800, validSubmissions: 3, invalidSubmissions: 2 },
];

const levelColor = (l: string) =>
  ({ Elite: '#FFD700', Gold: '#f59e0b', Silver: '#C0C0C0', Bronze: '#CD7F32', Rookie: 'var(--text-dim)' } as any)[l] || 'var(--text-dim)';

export default function Module5Settlement() {
  const { state, dispatch: storeDispatch } = useStore();
  const { updateSettlement, syncFromBackend } = useSettlements();
  const vulnerabilities = state.settlements;

  const [distributions, setDistributions] = useState(INIT_DISTRIBUTIONS);
  const [activeTab, setActiveTab] = useState<'settlement' | 'reputation' | 'distribution'>('settlement');
  const [challengeForm, setChallengeForm] = useState({ vulId: '', reason: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'warning'>('success');

  // 排序：待确认优先 → 按截止时间 → vullId；已接受/已挑战/已驳回放在后面
  const statusOrder: Record<string, number> = { pending: 0, accepted: 1, challenged: 2, rejected: 3 };
  const sortedVulns = useMemo(() => [...vulnerabilities].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 9;
    const sb = statusOrder[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.vulId.localeCompare(b.vulId);
  }), [vulnerabilities]);

  const handleAccept = async (vulId: string) => {
    const vul = vulnerabilities.find(v => v.vulId === vulId);
    if (!vul) return;
    const submitterMap: Record<string, string[]> = {
      'TASK-001-VUL-001': ['0xAgentA...F1', '0xAgentB...E2', '0xAgentC...D3'],
      'TASK-001-VUL-003': ['0xAgentE...B5', '0xAgentF...A6'],
    };
    const subs = submitterMap[vulId] || ['0xAgentX...ZZ'];
    const ratios = [70, 20, 10];
    const entries = subs.map((addr, i) => ({
      rank: i + 1, address: addr,
      amount: Math.round(vul.bounty * ratios[i] / 100), percent: ratios[i],
    }));
    setDistributions(prev => [...prev, { vulId, total: vul.bounty, entries }]);
    updateSettlement(vulId, 'accepted');
    setMessage(`漏洞 ${vulId} 已接受。奖金将按70/20/10分配。`);
    setMessageType('success');
    setTimeout(() => setMessage(''), 4000);
  };

  const handleChallenge = async () => {
    const vul = vulnerabilities.find(v => v.vulId === challengeForm.vulId);
    const bounty = vul ? vul.bounty : 500;
    const bond = Math.max(50, bounty * 0.2);
    updateSettlement(challengeForm.vulId, 'challenged');
    setMessage(`挑战已发起！需支付保证金 ${bond} USDC。等待仲裁裁决。`);
    setMessageType('warning');
    setTimeout(() => setMessage(''), 4000);
    setChallengeForm({ vulId: '', reason: '' });
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>模块5: 结算与声誉</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
        Challenge, Arbitration & Settlement - 挑战仲裁、奖励分配、声誉系统
      </p>

      {message && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)',
          background: messageType === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
          color: messageType === 'warning' ? 'var(--warning)' : 'var(--success)', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      {/* 仲裁裁决面板 */}
      {vulnerabilities.some(v => v.status === 'challenged') && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 12, color: 'var(--warning)' }}>
            仲裁裁决 — 已挑战漏洞待处理 ({vulnerabilities.filter(v => v.status === 'challenged').length})
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 16 }}>
            规则: 简单多数决 · 仲裁员恶意投票 → Slash质押 · 挑战失败 → 没收保证金注入奖金池
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {vulnerabilities.filter(v => v.status === 'challenged').map(v => {
              const bond = Math.max(50, v.bounty * 0.2);
              return (
                <div key={v.vulId} style={{
                  background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 'var(--radius)', padding: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--warning)', fontSize: '0.9rem' }}>{v.vulId}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}>已挑战</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 8 }}>{v.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 12 }}>
                    赏金 {v.bounty} USDC · 保证金 {bond} USDC · {v.submitters} 位提交者
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      updateSettlement(v.vulId, 'accepted');
                      const subs = ['0xAgentA...F1', '0xAgentB...E2', '0xAgentC...D3'].slice(0, v.submitters);
                      const ratios = [70, 20, 10];
                      const entries = subs.map((addr, i) => ({
                        rank: i + 1, address: addr, amount: Math.round(v.bounty * ratios[i] / 100), percent: ratios[i],
                      }));
                      setDistributions(prev => [...prev, { vulId: v.vulId, total: v.bounty + bond, entries }]);
                      setMessage(`仲裁裁决: ${v.vulId} 挑战失败！漏洞有效，保证金${bond} USDC没收。`);
                      setMessageType('success');
                      setTimeout(() => setMessage(''), 5000);
                    }}
                      style={{ flex: 1, padding: '8px 12px', background: 'var(--success)', border: 'none', color: '#fff',
                        borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                      挑战失败 (漏洞有效)
                    </button>
                    <button onClick={() => {
                      updateSettlement(v.vulId, 'rejected');
                      setMessage(`仲裁裁决: ${v.vulId} 挑战成功！漏洞无效，退还保证金${bond} USDC。`);
                      setMessageType('warning');
                      setTimeout(() => setMessage(''), 5000);
                    }}
                      style={{ flex: 1, padding: '8px 12px', background: 'var(--danger)', border: 'none', color: '#fff',
                        borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                      挑战成功 (漏洞无效)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {([
          { k: 'settlement', label: '漏洞确认与挑战', icon: '⚖️' },
          { k: 'distribution', label: '奖励分配', icon: '💰' },
          { k: 'reputation', label: '声誉系统', icon: '⭐' },
        ] as const).map(tab => (
          <button key={tab.k} onClick={() => setActiveTab(tab.k)}
            style={{
              padding: '10px 20px', border: 'none', borderRadius: 'var(--radius)',
              background: activeTab === tab.k ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === tab.k ? '#fff' : 'var(--text-dim)', fontWeight: 600, fontSize: '0.9rem',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'settlement' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>
              漏洞列表 · 待确认 {vulnerabilities.filter(v => v.status === 'pending').length} 个
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
                (已接受 {vulnerabilities.filter(v => v.status === 'accepted').length} 个 · 7天确认期)
              </span>
              <button onClick={() => { storeDispatch({ type: 'RESET' }); setDistributions(INIT_DISTRIBUTIONS); }}
                style={{ marginLeft: 12, background: 'none', border: '1px solid var(--border)',
                  color: 'var(--text-dim)', padding: '2px 10px', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer' }}>
                重置列表
              </button>
              <button onClick={async () => {
                await syncFromBackend();
                setMessage('已从后端数据库同步最新数据'); setMessageType('success');
                setTimeout(() => setMessage(''), 3000);
              }}
                style={{ marginLeft: 6, background: 'none', border: '1px solid var(--success)',
                  color: 'var(--success)', padding: '2px 10px', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer' }}
                title="从模块5后端 (:3005) 同步最新数据">
                从后端同步
              </button>
            </h2>
            {sortedVulns.map(v => (
              <div key={v.vulId} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{v.vulId}</span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                    background: v.status === 'accepted' ? 'rgba(16,185,129,0.15)' :
                                v.status === 'challenged' ? 'rgba(245,158,11,0.15)' :
                                v.status === 'rejected' ? 'rgba(107,114,128,0.12)' : 'rgba(59,130,246,0.15)',
                    color: v.status === 'accepted' ? 'var(--success)' :
                           v.status === 'challenged' ? 'var(--warning)' :
                           v.status === 'rejected' ? 'var(--text-dim)' : 'var(--primary)',
                  }}>
                    {({ pending: '待确认', accepted: '已接受', challenged: '已挑战', rejected: '已驳回' } as any)[v.status]}
                  </span>
                </div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{v.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  <span>赏金: {v.bounty} USDC · {v.submitters} 位提交者</span>
                  {v.deadline && <span>截止: {v.deadline}</span>}
                </div>

                {v.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => handleAccept(v.vulId)}
                      style={{ flex: 1, background: 'var(--success)', border: 'none', color: '#fff',
                        padding: '8px', borderRadius: 'var(--radius)', fontWeight: 600 }}>接受漏洞</button>
                    <button onClick={() => setChallengeForm(prev => ({ ...prev, vulId: v.vulId }))}
                      style={{ flex: 1, background: 'var(--danger)', border: 'none', color: '#fff',
                        padding: '8px', borderRadius: 'var(--radius)', fontWeight: 600 }}>发起挑战</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>发起挑战</h2>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>VUL-ID</label>
                <input style={{ width: '100%', marginTop: 4 }} value={challengeForm.vulId}
                  onChange={e => setChallengeForm(prev => ({ ...prev, vulId: e.target.value }))}
                  placeholder="TASK-001-VUL-001" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>挑战理由</label>
                <textarea style={{ width: '100%', minHeight: 80, resize: 'vertical', marginTop: 4 }}
                  value={challengeForm.reason}
                  onChange={e => setChallengeForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="说明为何此漏洞无效..." />
              </div>
              <div style={{ marginBottom: 16, padding: '10px 14px',
                background: 'rgba(245,158,11,0.12)',
                borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--warning)' }}>
                {(() => {
                  const vul = challengeForm.vulId ? vulnerabilities.find(v => v.vulId === challengeForm.vulId) : null;
                  if (vul) {
                    const bond = Math.max(50, vul.bounty * 0.2);
                    return `挑战保证金: ${bond} USDC (赏金${vul.bounty} USDC × 20% = ${vul.bounty * 0.2}, ≥ 50 USDC) · 挑战失败将没收保证金`;
                  }
                  return '挑战保证金: MAX(赏金×20%, 50 USDC) · 挑战失败将没收保证金';
                })()}
              </div>
              <button onClick={handleChallenge} disabled={!challengeForm.vulId}
                style={{ width: '100%', background: 'var(--danger)', border: 'none', color: '#fff',
                  padding: '10px', borderRadius: 'var(--radius)', fontWeight: 600 }}>
                支付保证金并发起挑战
              </button>
            </div>

            <div style={{ marginTop: 24, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>仲裁规则提示</h3>
              <ul style={{ fontSize: '0.82rem', color: 'var(--text-dim)', paddingLeft: 20, lineHeight: 2 }}>
                <li>MVP阶段为人工仲裁确认</li>
                <li>正式版：随机抽选质押仲裁员投票</li>
                <li>仲裁员恶意投票将Slash质押</li>
                <li>7天无操作→自动接受漏洞</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'distribution' && (
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>奖励分配规则</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
              {[{ rank: '第一名', pct: '70%', color: '#FFD700', icon: '🥇' },
                { rank: '第二名', pct: '20%', color: '#C0C0C0', icon: '🥈' },
                { rank: '第三名', pct: '10%', color: '#CD7F32', icon: '🥉' }].map(r =>
                <div key={r.rank} style={{ textAlign: 'center', padding: 16, background: 'var(--bg)',
                  borderRadius: 'var(--radius)', border: `1px solid ${r.color}33` }}>
                  <div style={{ fontSize: '1.5rem' }}>{r.icon}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '8px 0' }}>{r.rank}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: r.color }}>{r.pct}</div>
                </div>
              )}
            </div>
          </div>

          {distributions.map(d => (
            <div key={d.vulId} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 20, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                {d.vulId} · 总赏金 {d.total} USDC
              </div>
              {d.entries.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: i < d.entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>#{e.rank}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{e.address}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: 'var(--success)' }}>{e.amount} USDC</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{e.percent}%</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {distributions.length === 0 && <p style={{ color: 'var(--text-dim)' }}>暂无已完成的奖励分配</p>}
        </div>
      )}

      {activeTab === 'reputation' && (
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>审计师声誉排行榜</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 16 }}>
              基于历史正确率、校准度、总赏金的综合评分
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>排名</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>地址</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px' }}>等级</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>声誉分</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>校准度</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>总赏金</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>有效/总数</th>
                </tr>
              </thead>
              <tbody>
                {mockReputations.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.address}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600,
                        background: `${levelColor(r.level)}15`, color: levelColor(r.level) }}>{r.level}</span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{r.reputation.toLocaleString()}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      <span style={{ color: r.calibration >= 0.9 ? 'var(--success)' : 'var(--warning)' }}>{(r.calibration * 100).toFixed(0)}%</span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{r.totalBounty.toLocaleString()} USDC</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      <span style={{ color: 'var(--success)' }}>{r.validSubmissions}</span>
                      <span style={{ color: 'var(--text-dim)' }}>/{r.validSubmissions + r.invalidSubmissions}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
