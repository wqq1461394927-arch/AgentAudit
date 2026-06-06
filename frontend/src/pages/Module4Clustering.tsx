import { useState } from 'react';
import { useStore } from '../store/store';
import type { VulnCluster } from '../store/types';

export default function Module4Clustering() {
  const { state, dispatch: storeDispatch } = useStore();
  const clusters = state.clusters;

  const [selected, setSelected] = useState<VulnCluster | null>(null);
  const [disputeType, setDisputeType] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeMsg, setDisputeMsg] = useState('');

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>模块4: 漏洞聚类</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
        Vulnerability Clustering - 标准化 → 向量化 → 相似度匹配 → AI裁判 → VUL-ID
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>唯一漏洞列表 (VUL-ID)
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
              ({clusters.length} 个)
            </span>
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {clusters.map(v => (
              <div key={v.vulId} onClick={() => setSelected(v)}
                style={{ background: selected?.vulId === v.vulId ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)',
                  border: `1px solid ${selected?.vulId === v.vulId ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', padding: '16px 20px', cursor: 'pointer', transition: '0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                      {v.vulId}
                    </span>
                    <span style={{
                      padding: '2px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                      background: v.severity === 'Critical' ? 'rgba(239,68,68,0.15)' :
                                  v.severity === 'High' ? 'rgba(249,115,22,0.15)' : 'rgba(245,158,11,0.15)',
                      color: v.severity === 'Critical' ? 'var(--danger)' :
                             v.severity === 'High' ? '#f97316' : 'var(--warning)',
                    }}>{v.severity}</span>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
                    background: v.status === 'finalized' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: v.status === 'finalized' ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {v.status === 'finalized' ? '已确认' : '异议期'}
                  </span>
                </div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{v.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {v.submitters.length} 份报告合并 · 按Commit时间排序
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {selected ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 20, position: 'sticky', top: 32 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--primary)' }}>
                {selected.vulId}
              </h3>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>{selected.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  状态: {selected.status === 'finalized' ? '✅ 已确认最终聚类' : '⏳ 异议窗口开启中'}
                </div>
                {selected.status === 'dispute_open' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: 4 }}>
                    异议截止: {selected.disputeDeadline}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-dim)' }}>
                  提交排名 (按Commit时间)
                </h4>
                {selected.submitters.map((s: string, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s}</span>
                      <span style={{ color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32', fontSize: '0.8rem' }}>
                        ({[70, 20, 10][i]}%)
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>+{i * 2}ms</span>
                  </div>
                ))}
              </div>

              {selected.status === 'dispute_open' && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>提交异议</h4>
                  <select value={disputeType} onChange={e => setDisputeType(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}>
                    <option value="">选择异议类型...</option>
                    <option value="split">拆分 (不应合并)</option>
                    <option value="merge">合并 (应归入其他VUL-ID)</option>
                    <option value="severity">严重性判定有误</option>
                    <option value="rank">排名错误</option>
                  </select>
                  <textarea placeholder="异议理由..." value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                    style={{ width: '100%', minHeight: 60, resize: 'vertical', marginBottom: 8 }} />
                  <button onClick={() => {
                    if (!disputeType || !disputeReason.trim()) {
                      setDisputeMsg('请选择异议类型并填写理由');
                      return;
                    }
                    setDisputeMsg('异议已提交！24小时异议窗口开启中，等待项目方或管理员确认。');
                    setDisputeType('');
                    setDisputeReason('');
                    // 同步到存储：将聚类状态改为已确认（模拟管理员确认后的操作）
                    storeDispatch({ type: 'UPDATE_CLUSTER', payload: { vulId: selected.vulId, changes: { status: 'finalized', disputeDeadline: null } } });
                  }}
                    style={{ width: '100%', background: 'var(--warning)', border: 'none', color: '#000',
                    padding: '10px', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}>
                    提交异议
                  </button>
                  {disputeMsg && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius)',
                      background: disputeMsg.includes('请选择') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      color: disputeMsg.includes('请选择') ? 'var(--danger)' : 'var(--success)', fontSize: '0.82rem' }}>
                      {disputeMsg}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>
              选择一个 VUL-ID 查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
