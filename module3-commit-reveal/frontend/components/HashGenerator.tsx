import React, { useState } from "react";
import { useAccount } from "wagmi";
import { generateSalt, generateReportHash } from "../utils/hash";
import type { Report } from "../utils/hash";

/**
 * HashGenerator — 哈希生成器组件
 *
 * 作用:
 *   1. 输入漏洞报告内容
 *   2. 点击按钮生成 salt + reportHash
 *   3. 展示 hash 供后续 Commit 使用
 *
 * 输入: taskId, report (title/severity/confidence/description/recommendation)
 * 输出: reportHash = keccak256(taskId, submitter, reportJson, salt)
 */

interface Props {
  taskId: bigint;
  onHashGenerated: (data: {
    salt: `0x${string}`;
    reportHash: `0x${string}`;
    reportJson: string;
  }) => void;
}

const DEFAULT_REPORT: Report = {
  title: "",
  severity: "Medium",
  confidence: 80,
  description: "",
  recommendation: "",
};

export default function HashGenerator({ taskId, onHashGenerated }: Props) {
  const { address } = useAccount();
  const [report, setReport] = useState<Report>(DEFAULT_REPORT);
  const [generatedHash, setGeneratedHash] = useState<`0x${string}` | null>(null);
  const [generatedSalt, setGeneratedSalt] = useState<`0x${string}` | null>(null);

  const handleGenerate = () => {
    if (!address) return alert("请先连接钱包");
    if (!report.title || !report.description) return alert("请填写报告标题和描述");

    const newSalt = generateSalt();
    const newHash = generateReportHash({
      taskId,
      agentAddress: address,
      report,
      salt: newSalt,
    });

    setGeneratedSalt(newSalt);
    setGeneratedHash(newHash);

    onHashGenerated({
      salt: newSalt,
      reportHash: newHash,
      reportJson: JSON.stringify(report),
    });
  };

  return (
    <div style={styles.container}>
      <h3>1. Hash Generator — 生成提交哈希</h3>
      <p style={styles.hint}>
        hash = keccak256(taskId, submitter, reportJson, salt)
      </p>

      <div style={styles.field}>
        <label>报告标题</label>
        <input
          style={styles.input}
          value={report.title}
          onChange={(e) => setReport({ ...report, title: e.target.value })}
          placeholder='例: Reentrancy in withdraw()'
        />
      </div>

      <div style={styles.field}>
        <label>严重程度</label>
        <select
          style={styles.select}
          value={report.severity}
          onChange={(e) =>
            setReport({ ...report, severity: e.target.value as Report["severity"] })
          }
        >
          <option value='Critical'>Critical</option>
          <option value='High'>High</option>
          <option value='Medium'>Medium</option>
          <option value='Low'>Low</option>
          <option value='Info'>Info</option>
        </select>
      </div>

      <div style={styles.field}>
        <label>置信度: {report.confidence}%</label>
        <input
          style={styles.input}
          type='range'
          min={0}
          max={100}
          value={report.confidence}
          onChange={(e) =>
            setReport({ ...report, confidence: Number(e.target.value) })
          }
        />
      </div>

      <div style={styles.field}>
        <label>漏洞描述</label>
        <textarea
          style={styles.textarea}
          rows={4}
          value={report.description}
          onChange={(e) => setReport({ ...report, description: e.target.value })}
          placeholder='描述漏洞原理和影响...'
        />
      </div>

      <div style={styles.field}>
        <label>修复建议</label>
        <textarea
          style={styles.textarea}
          rows={3}
          value={report.recommendation}
          onChange={(e) =>
            setReport({ ...report, recommendation: e.target.value })
          }
          placeholder='建议修复方案...'
        />
      </div>

      <button style={styles.button} onClick={handleGenerate}>
        Generate Hash
      </button>

      {generatedHash && (
        <div style={styles.result}>
          <p style={styles.label}>Salt:</p>
          <code style={styles.code}>{generatedSalt}</code>
          <p style={styles.label}>Report Hash:</p>
          <code style={styles.code}>{generatedHash}</code>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    background: "#fff",
  },
  hint: {
    fontSize: 13,
    color: "#718096",
    background: "#edf2f7",
    padding: "8px 12px",
    borderRadius: 4,
    fontFamily: "monospace",
  },
  field: {
    marginTop: 16,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #cbd5e0",
    borderRadius: 4,
    fontSize: 14,
    marginTop: 4,
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #cbd5e0",
    borderRadius: 4,
    fontSize: 14,
    marginTop: 4,
  },
  textarea: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #cbd5e0",
    borderRadius: 4,
    fontSize: 14,
    marginTop: 4,
    resize: "vertical",
  },
  button: {
    marginTop: 20,
    padding: "10px 24px",
    background: "#4A90D9",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    cursor: "pointer",
  },
  result: {
    marginTop: 16,
    padding: 12,
    background: "#f7fafc",
    borderRadius: 4,
  },
  label: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 4,
    marginTop: 8,
  },
  code: {
    fontSize: 12,
    wordBreak: "break-all",
    background: "#edf2f7",
    padding: "4px 8px",
    borderRadius: 3,
    display: "block",
  },
};
