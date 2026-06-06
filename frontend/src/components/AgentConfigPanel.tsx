"use client";

import React from "react";
import { Shield, Coins, FileCode } from "lucide-react";
import { AgentType, AGENT_TYPE_LABELS } from "@/lib/contracts";

interface AgentConfigPanelProps {
  selectedAgents: AgentType[];
  onToggle: (agentType: AgentType) => void;
}

const AGENT_CONFIGS: {
  type: AgentType;
  icon: React.ElementType;
  description: string;
  color: string;
}[] = [
  {
    type: AgentType.Security,
    icon: Shield,
    description: "智能合约安全漏洞检测（重入、溢出、权限等）",
    color: "text-red-400",
  },
  {
    type: AgentType.Tokenomics,
    icon: Coins,
    description: "代币经济模型分析（通胀、分配、激励等）",
    color: "text-yellow-400",
  },
  {
    type: AgentType.Static,
    icon: FileCode,
    description: "代码静态分析（代码规范、复杂度、死代码等）",
    color: "text-blue-400",
  },
];

export default function AgentConfigPanel({ selectedAgents, onToggle }: AgentConfigPanelProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-300">选择审计代理</label>
      <div className="grid gap-3 sm:grid-cols-3">
        {AGENT_CONFIGS.map(({ type, icon: Icon, description, color }) => {
          const isSelected = selectedAgents.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggle(type)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
              }`}
            >
              <Icon className={`h-6 w-6 ${isSelected ? color : "text-gray-500"}`} />
              <span
                className={`text-sm font-medium ${
                  isSelected ? "text-gray-100" : "text-gray-500"
                }`}
              >
                {AGENT_TYPE_LABELS[type]}
              </span>
              <span className="text-[10px] text-gray-600 text-center leading-tight">
                {description}
              </span>
              <div
                className={`mt-1 flex h-5 w-5 items-center justify-center rounded border transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-700 bg-gray-800"
                }`}
              >
                {isSelected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
