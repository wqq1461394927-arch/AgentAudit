import { useState } from 'react';
import { useStore } from '../store/store';
import type { Task } from '../store/types';

const MOCK_AGENTS = [
  { agentAddress: '0xAgent000000000000000000000000000001', name: '🔒 安全审计专家', reputation: 8920, registered: true },
  { agentAddress: '0xAgent000000000000000000000000000002', name: '📊 代币经济审计师', reputation: 6540, registered: true },
  { agentAddress: '0xAgent000000000000000000000000000003', name: '🔍 静态代码分析器', reputation: 9100, registered: true },
];

export default function Module1TaskMarket() {
  const { state, dispatch } = useStore();
  const tasks = state.tasks;

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', repo: '', bounty: '', duration: '72',
    securityAgent: true, tokenomicsAgent: true, staticAgent: true,
  });
  const [createdMsg, setCreatedMsg] = useState('');

  const phaseLabel = (p: number) =>
    ({ 0: '等待中', 1: '审计中', 2: 'Reveal阶段', 3: '聚类中', 4: '确认中', 5: '已结算' } as any)[p] || `阶段${p}`;

  const handleCreate = () => {
    setCreatedMsg('');
    const agentList: string[] = [];
    if (form.securityAgent) agentList.push('Security');
    if (form.tokenomicsAgent) agentList.push('Tokenomics');
    if (form.staticAgent) agentList.push('Static');

    const newTask: Task = {
      id: tasks.length + 1,
      owner: '0xDemo...0000',
      bountyAmount: String(Number(form.bounty || '500') * 1e6),
      createdAt: String(Math.floor(Date.now() / 1000)),
      deadline: String(Math.floor(Date.now() / 1000) + parseInt(form.duration) * 3600),
      status: 1,
      phase: '1',
      metadata: {
        name: form.name || '新任务',
        repository: form.repo,
        bounty: form.bounty,
        duration: parseInt(form.duration),
        agents: agentList,
      },
    };

    dispatch({ type: 'ADD_TASK', payload: newTask });

    setShowCreate(false);
    setForm({ name: '', repo: '', bounty: '', duration: '72', securityAgent: true, tokenomicsAgent: true, staticAgent: true });
    setCreatedMsg('任务创建成功！');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>模块1: 任务市场</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Task Creation & Fund Lock - 创建审计任务并锁定赏金</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setCreatedMsg(''); }}
          style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '10px 24px',
            borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '0.9rem' }}>
          + 创建任务
        </button>
      </div>

      {createdMsg && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)',
          background: createdMsg.includes('成功') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: createdMsg.includes('成功') ? 'var(--success)' : 'var(--danger)', fontSize: '0.9rem' }}>
          {createdMsg}
        </div>
      )}

      {showCreate && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>创建新任务</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>任务名称</label>
              <input style={{ width: '100%' }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="如: Vault Security Audit" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>GitHub仓库</label>
              <input style={{ width: '100%' }} value={form.repo} onChange={e => setForm({ ...form, repo: e.target.value })}
                placeholder="github.com/project/repo" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>赏金 (USDC)</label>
              <input style={{ width: '100%' }} value={form.bounty} onChange={e => setForm({ ...form, bounty: e.target.value })}
                placeholder="1000" type="number" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>审计周期 (小时)</label>
              <select style={{ width: '100%' }} value={form.duration}
                onChange={e => setForm({ ...form, duration: e.target.value })}>
                <option value="24">24 小时</option>
                <option value="72">72 小时</option>
                <option value="168">7 天</option>
                <option value="720">30 天</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 8 }}>选择AI Agent类型</label>
            <div style={{ display: 'flex', gap: 16 }}>
              {([{ k: 'securityAgent', label: '🔒 安全专家', desc: '重入攻击、访问控制等' },
                { k: 'tokenomicsAgent', label: '📊 代币经济师', desc: '经济模型风险' },
                { k: 'staticAgent', label: '🔍 静态分析器', desc: '代码模式检测' }] as const).map(a =>
                <label key={a.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  background: (form as any)[a.k] ? 'rgba(59,130,246,0.1)' : 'var(--bg)',
                  border: `1px solid ${(form as any)[a.k] ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={(form as any)[a.k]}
                    onChange={e => setForm({ ...form, [a.k]: e.target.checked })} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{a.desc}</div>
                  </div>
                </label>
              )}
            </div>
          </div>
          <button onClick={handleCreate}
            style={{ marginTop: 20, background: 'var(--success)', border: 'none', color: '#fff', padding: '10px 32px',
              borderRadius: 'var(--radius)', fontWeight: 600 }}>
            确认创建并锁定资金（链上）
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {tasks.map((t: Task) => (
          <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                <span style={{ color: 'var(--primary)' }}>#{t.id}</span>{' '}
                {t.metadata?.name || `Task ${t.id}`}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 4 }}>
                Owner: {t.owner?.slice(0, 8)}...{t.owner?.slice(-4)} | 创建: {new Date(Number(t.createdAt || 0) * 1000).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{
                padding: '4px 12px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600,
                background: 'rgba(59,130,246,0.15)', color: 'var(--primary)',
              }}>
                {phaseLabel(typeof t.status === 'number' ? t.status : parseInt(t.phase || '0'))}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {(Number(t.bountyAmount || 0) / 1e6).toFixed(0)} USDC
              </span>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p style={{ color: 'var(--text-dim)' }}>暂无任务，点击"创建任务"开始</p>}
      </div>

      <div style={{ marginTop: 32, background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>已注册AI Agent</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {MOCK_AGENTS.map((a: any, i: number) => (
            <div key={i} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.name || 'Agent'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                {a.agentAddress?.slice(0, 10)}...
              </div>
              <div style={{ marginTop: 6, fontSize: '0.82rem' }}>
                声誉: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{Number(a.reputation || 0)}</span>
                {' '}{a.registered ? '已注册' : '待注册'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
