import { useState } from 'react';
import { useStore, useCommits } from '../store/store';

export default function Module3CommitReveal() {
  const { state } = useStore();
  const { tasks, commits } = state;
  const { addCommit, reveal: revealCommit } = useCommits();

  const [taskId, setTaskId] = useState('TASK-001');
  const [reportText, setReportText] = useState('');
  const [salt, setSalt] = useState('');
  const [step, setStep] = useState<'idle' | 'generated' | 'committed' | 'revealed'>('idle');
  const [commitHash, setCommitHash] = useState('');
  const [showHashDetail, setShowHashDetail] = useState(false);

  const generateSalt = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const generateHash = async () => {
    const s = salt || generateSalt();
    if (!salt) setSalt(s);
    const encoder = new TextEncoder();
    const data = JSON.stringify({ taskId, submitter: '0xDemo...ABCD', report: reportText, salt: s });
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    setCommitHash(hashHex);
    setStep('generated');
  };

  const commit = () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const record = {
      id: `C-${commits.length + 1}`, taskId, submitter: '0xDemo...ABCD',
      commitHash, commitTime: now, revealed: false, salt,
    };
    addCommit(record);
    setStep('committed');
  };

  const reveal = () => {
    revealCommit(commitHash, reportText);
    setStep('revealed');
  };

  const reset = () => { setStep('idle'); setCommitHash(''); setReportText(''); setSalt(''); };

  const stepStyle = (s: string) => ({
    background: step === s ? 'var(--primary)' : 'var(--bg-card)',
    color: step === s ? '#fff' : 'var(--text-dim)',
    border: `1px solid ${step === s ? 'var(--primary)' : 'var(--border)'}`,
    padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '0.85rem',
  });

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>模块3: Commit-Reveal</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
        防抄袭存证 - 哈希提交 → 时间戳确权 → 公开揭示
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 24 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>提交流程</h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={stepStyle('generated')}>1. 生成哈希</div>
              <div style={stepStyle('committed')}>2. Commit</div>
              <div style={stepStyle('revealed')}>3. Reveal</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>任务ID</label>
              <input style={{ width: '100%' }} value={taskId}
                onChange={e => setTaskId(e.target.value)} disabled={step !== 'idle'} />
              {/* 提示可用任务 */}
              {tasks.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  可用: {tasks.map(t => `TASK-${String(t.id).padStart(3, '0')}`).join(', ')}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                漏洞报告内容
              </label>
              <textarea style={{ width: '100%', minHeight: 120, resize: 'vertical' }}
                value={reportText} onChange={e => setReportText(e.target.value)}
                disabled={step !== 'idle'}
                placeholder='{"title":"Reentrancy Attack","description":"...","severity":"Critical","confidence":92}' />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                Salt (随机盐值)
                <button onClick={() => { if (step === 'idle') setSalt(generateSalt()); }}
                  disabled={step !== 'idle'}
                  style={{ marginLeft: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--primary)',
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                  随机生成
                </button>
              </label>
              <input style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
                value={salt} onChange={e => setSalt(e.target.value)} disabled={step !== 'idle'}
                placeholder="0x0000...0000 (32字节随机值)" />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {step === 'idle' && (
                <button onClick={generateHash} disabled={!reportText}
                  style={{ flex: 1, background: 'var(--primary)', border: 'none', color: '#fff', padding: '10px',
                    borderRadius: 'var(--radius)', fontWeight: 600 }}>
                  生成哈希
                </button>
              )}
              {step === 'generated' && (
                <>
                  <button onClick={commit}
                    style={{ flex: 1, background: 'var(--success)', border: 'none', color: '#fff', padding: '10px',
                      borderRadius: 'var(--radius)', fontWeight: 600 }}>
                    上链 Commit
                  </button>
                  <button onClick={reset}
                    style={{ background: 'var(--border)', border: 'none', color: 'var(--text-dim)', padding: '10px 20px',
                      borderRadius: 'var(--radius)' }}>重置</button>
                </>
              )}
              {step === 'committed' && (
                <button onClick={reveal}
                  style={{ flex: 1, background: 'var(--purple)', border: 'none', color: '#fff', padding: '10px',
                    borderRadius: 'var(--radius)', fontWeight: 600 }}>
                  公开 Reveal
                </button>
              )}
              {step === 'revealed' && (
                <button onClick={reset}
                  style={{ flex: 1, background: 'var(--primary)', border: 'none', color: '#fff', padding: '10px',
                    borderRadius: 'var(--radius)', fontWeight: 600 }}>
                  提交新报告
                </button>
              )}
            </div>

            {commitHash && (
              <div style={{ marginTop: 20, padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 6 }}>CommitHash (SHA-256)</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', color: 'var(--warning)' }}>
                  {commitHash}
                </div>
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  哈希内容 = taskId + submitter + reportJson + salt
                  <button onClick={() => setShowHashDetail(!showHashDetail)}
                    style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem' }}>
                    {showHashDetail ? '收起' : '查看详情'}
                  </button>
                </div>
                {showHashDetail && (
                  <div style={{ marginTop: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius)', padding: 12,
                    fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
                    taskId: {taskId}<br />
                    submitter: 0xDemo...ABCD<br />
                    report: {reportText.slice(0, 50)}...<br />
                    salt: {salt.slice(0, 20)}...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>链上存证记录</h2>
          {commits.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', padding: '20px 0' }}>暂无提交记录</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {commits.map(r => (
                <div key={r.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{r.id}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                      background: r.revealed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: r.revealed ? 'var(--success)' : 'var(--warning)',
                    }}>
                      {r.revealed ? '已揭示' : '已Commit'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    任务: {r.taskId} · 提交者: {r.submitter}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-dim)',
                    marginTop: 4, wordBreak: 'break-all' }}>
                    Hash: {r.commitHash.slice(0, 42)}...
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    时间: {r.commitTime}
                  </div>
                  {r.revealed && r.reportContent && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg)',
                      borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--success)' }}>
                      揭示内容: {r.reportContent.slice(0, 80)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
