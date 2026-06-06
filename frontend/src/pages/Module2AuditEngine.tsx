import { useState, useCallback } from 'react';
import { useStore } from '../store/store';
import type { AuditReport } from '../store/types';

const mockAgents = [
  { id: 'security-1', name: '🔒 安全审计专家', type: 'Security', desc: '专注于重入攻击、权限控制、整数溢出等常见漏洞', confidence: 0.87, reports: 23 },
  { id: 'tokenomics-1', name: '📊 代币经济审计师', type: 'Tokenomics', desc: '分析经济模型、闪电贷攻击、MEV风险', confidence: 0.82, reports: 15 },
  { id: 'static-1', name: '🔍 静态代码分析器', type: 'Static', desc: '基于AST和模式匹配的自动代码检测', confidence: 0.91, reports: 41 },
];

function getReports(taskId: string): Omit<AuditReport, 'id' | 'taskId' | 'timestamp'>[] {
  const seed = taskId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const pools: Record<string, { title: string; severity: string; confidence: number; poc: string; agent: string }[]> = {
    vault: [
      { title: 'Vault.withdraw() 重入攻击漏洞', severity: 'Critical', confidence: 92, poc: '通过fallback函数在余额更新前递归调用withdraw()', agent: '🔒 安全审计专家' },
      { title: '价格预言机可被闪电贷操纵', severity: 'High', confidence: 78, poc: '通过大额借贷临时扭曲Uniswap价格', agent: '📊 代币经济审计师' },
      { title: 'stake()函数存在未检查的整数溢出', severity: 'Medium', confidence: 95, poc: 'uint256加法在Solidity<0.8时会溢出', agent: '🔍 静态代码分析器' },
      { title: 'Ownable权限未正确初始化', severity: 'Low', confidence: 88, poc: '构造函数未传递owner参数给Ownable', agent: '🔒 安全审计专家' },
    ],
    dex: [
      { title: 'swap()函数缺少滑点保护可被三明治攻击', severity: 'Critical', confidence: 91, poc: '攻击者在用户交易前后插入买卖以操纵价格', agent: '📊 代币经济审计师' },
      { title: '流动性移除未检查deadline参数', severity: 'High', confidence: 85, poc: '过时交易可能被矿工恶意打包造成损失', agent: '🔒 安全审计专家' },
      { title: 'feeTo地址可被零地址锁定', severity: 'Medium', confidence: 93, poc: 'feeTo一旦设为零地址无法再更改', agent: '🔍 静态代码分析器' },
      { title: 'approve()未使用safeApprove模式', severity: 'Low', confidence: 89, poc: 'USDT等代币approve必须先清零再设置', agent: '🔍 静态代码分析器' },
    ],
    nft: [
      { title: 'mint()函数可被重入导致超额铸造', severity: 'Critical', confidence: 94, poc: '_mint()在计数器更新前回调用户合约', agent: '🔒 安全审计专家' },
      { title: '版税计算存在精度截断漏洞', severity: 'High', confidence: 80, poc: '整数除法导致小额交易版税被吞', agent: '📊 代币经济审计师' },
      { title: 'tokenURI未校验输入长度可被DoS', severity: 'Medium', confidence: 90, poc: '超长baseURI导致gas超限交易回滚', agent: '🔍 静态代码分析器' },
    ],
    lend: [
      { title: '清算函数缺少健康因子下限检查', severity: 'Critical', confidence: 93, poc: '超额清算可导致用户资产被全部没收', agent: '🔒 安全审计专家' },
      { title: '利率模型参数可被治理攻击操纵', severity: 'High', confidence: 83, poc: '巨鲸通过短期大额借贷扭曲利率曲线', agent: '📊 代币经济审计师' },
      { title: '预言机价格更新存在延迟套利窗口', severity: 'High', confidence: 76, poc: 'Chainlink心跳间隔内价格偏离真实市场', agent: '📊 代币经济审计师' },
      { title: '存款上限检查可被绕过', severity: 'Medium', confidence: 87, poc: '通过多个账户分批存款突破单账户限制', agent: '🔍 静态代码分析器' },
    ],
  };
  const key = taskId.toLowerCase();
  let items: typeof pools['vault'];
  if (key.includes('vault') || key.includes('001')) items = pools.vault;
  else if (key.includes('dex') || key.includes('002')) items = pools.dex;
  else if (key.includes('nft') || key.includes('003')) items = pools.nft;
  else if (key.includes('lend') || key.includes('004')) items = pools.lend;
  else { const ks = Object.keys(pools); items = pools[ks[seed % ks.length]]; }
  return items.slice(0, 3 + (seed % 2)) as Omit<AuditReport, 'id' | 'taskId' | 'timestamp'>[];
}

export default function Module2AuditEngine() {
  const { state, dispatch: storeDispatch } = useStore();
  const { tasks, reports: storedReports } = state;

  const [auditing, setAuditing] = useState(false);
  const [auditTask, setAuditTask] = useState('');
  const [localReports, setLocalReports] = useState<AuditReport[]>([]);
  const [log, setLog] = useState<string[]>([]);

  // 优先显示 store 中的报告，否则用本地报告
  const reports = storedReports.length > 0 ? storedReports : localReports;

  const triggerAudit = useCallback(async () => {
    const task = auditTask.trim() || 'TASK-001';
    setAuditing(true);
    setLocalReports([]);

    const rawReports = getReports(task);
    const agents = [...new Set(rawReports.map(r => r.agent))];
    const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

    setLog([`[系统] 任务 ${task} — 调度 ${agents.length} 个AI Agent进行并行审计...`]);
    await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < agents.length; i++) {
      setLog(l => [...l, `[系统] ${agents[i]}: 正在分析...`]);
      await new Promise(r => setTimeout(r, 350 + Math.random() * 400));
    }
    setLog(l => [...l, `[系统] 所有Agent审计完成，共发现 ${rawReports.length} 个潜在漏洞`]);

    const fullReports: AuditReport[] = rawReports.map((r, i) => ({
      ...r,
      id: `${task}-R${String(i + 1).padStart(3, '0')}`,
      taskId: task,
      timestamp: now(),
    }));

    setLocalReports(fullReports);
    // 同步到共享 store，让模块4/5可以看到这些报告
    storeDispatch({ type: 'SET_REPORTS', payload: fullReports });

    setAuditing(false);
  }, [auditTask, storeDispatch]);

  const severityColor = (s: string) =>
    ({ Critical: 'var(--danger)', High: '#f97316', Medium: 'var(--warning)', Low: 'var(--cyan)' } as any)[s] || 'var(--text-dim)';

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>模块2: AI审计引擎</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>AI Agent Audit Engine - 多智能体并行审计与漏洞发现</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {mockAgents.map(a => (
          <div key={a.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 4 }}>{a.name}</div>
            <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: '0.75rem',
              background: 'rgba(139,92,246,0.15)', color: 'var(--purple)', marginBottom: 8 }}>{a.type}</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 12 }}>{a.desc}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span>校准度: <b style={{ color: 'var(--success)' }}>{(a.confidence * 100).toFixed(0)}%</b></span>
              <span>报告: <b>{a.reports}</b></span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>触发审计</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <input value={auditTask} onChange={e => setAuditTask(e.target.value)}
            placeholder="输入任务ID (如 TASK-001)" style={{ flex: 1 }} />
          <button onClick={triggerAudit} disabled={auditing}
            style={{ background: auditing ? 'var(--border)' : 'var(--primary)', border: 'none', color: '#fff',
              padding: '10px 28px', borderRadius: 'var(--radius)', fontWeight: 600 }}>
            {auditing ? '审计中...' : '开始审计'}
          </button>
        </div>

        {/* 提示当前可用任务 */}
        {tasks.length > 0 && (
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            可用任务: {tasks.map(t => `TASK-${String(t.id).padStart(3, '0')}`).join(', ')}
          </div>
        )}

        {log.length > 0 && (
          <div style={{ marginTop: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 16px',
            border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.82rem', maxHeight: 180, overflow: 'auto' }}>
            {log.map((l, i) => <div key={i} style={{ padding: '2px 0' }}>{l}</div>)}
          </div>
        )}
      </div>

      {reports.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>
            审计报告 ({reports.length} 个漏洞)
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: '0.82rem' }}>{r.id}</span>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{r.title}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                      {r.agent} · {r.timestamp}
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 14px',
                      fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--warning)' }}>
                      PoC: {r.poc}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600,
                      background: `${severityColor(r.severity)}22`, color: severityColor(r.severity) }}>{r.severity}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      置信度: <b style={{ color: r.confidence >= 90 ? 'var(--success)' : 'var(--warning)' }}>{r.confidence}%</b>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
