"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Shield,
  Loader2,
  Search,
  Coins,
  FileCode,
  Cpu,
  Star,
  CheckCircle2,
  Filter,
} from "lucide-react";
import Header from "@/components/Header";
import { fetchAgents } from "@/lib/api";
import {
  AgentType,
  AGENT_TYPE_LABELS,
  formatAddress,
} from "@/lib/contracts";

interface AgentItem {
  address: string;
  name: string;
  agentType: number;
  endpoint: string;
  reputation: string;
  tasksCompleted: string;
  registered: boolean;
  stakeAmount: string;
}

const AGENT_ICONS: Record<number, React.ElementType> = {
  [AgentType.Security]: Shield,
  [AgentType.Tokenomics]: Coins,
  [AgentType.Static]: FileCode,
};

const AGENT_COLORS: Record<number, string> = {
  [AgentType.Security]: "border-red-500/30 hover:border-red-500/50",
  [AgentType.Tokenomics]: "border-yellow-500/30 hover:border-yellow-500/50",
  [AgentType.Static]: "border-blue-500/30 hover:border-blue-500/50",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchAgents();
        setAgents(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredAgents = useMemo(() => {
    if (filterType === null) return agents;
    return agents.filter((a) => a.agentType === filterType);
  }, [agents, filterType]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100">代理节点</h1>
          <p className="mt-1 text-sm text-gray-500">
            已注册的 AI 审计代理列表
          </p>
        </div>

        {/* Filter */}
        <div className="mb-6 flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <button
            onClick={() => setFilterType(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === null
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            全部
          </button>
          {[AgentType.Security, AgentType.Tokenomics, AgentType.Static].map(
            (type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterType === type
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {AGENT_TYPE_LABELS[type]}
              </button>
            )
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-16 text-center">
            <Cpu className="mx-auto h-12 w-12 text-gray-700" />
            <p className="mt-4 text-gray-500">
              {filterType !== null
                ? "该类型暂无注册代理"
                : "暂无注册代理"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const Icon = AGENT_ICONS[agent.agentType] || Cpu;
              const borderColor =
                AGENT_COLORS[agent.agentType] ||
                "border-gray-800 hover:border-gray-700";

              return (
                <div
                  key={agent.address}
                  className={`rounded-xl border bg-gray-900/60 p-5 transition-all ${borderColor}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          agent.agentType === AgentType.Security
                            ? "bg-red-500/10"
                            : agent.agentType === AgentType.Tokenomics
                            ? "bg-yellow-500/10"
                            : "bg-blue-500/10"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            agent.agentType === AgentType.Security
                              ? "text-red-400"
                              : agent.agentType === AgentType.Tokenomics
                              ? "text-yellow-400"
                              : "text-blue-400"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-100">
                          {agent.name}
                        </h3>
                        <span
                          className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            agent.agentType === AgentType.Security
                              ? "bg-red-500/20 text-red-300"
                              : agent.agentType === AgentType.Tokenomics
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-blue-500/20 text-blue-300"
                          }`}
                        >
                          {AGENT_TYPE_LABELS[agent.agentType as AgentType] || "未知"}
                        </span>
                      </div>
                    </div>
                    {agent.registered && (
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span className="text-gray-500">地址</span>
                      <span className="font-mono">
                        {formatAddress(agent.address)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">端点</span>
                      <span className="font-mono truncate max-w-[140px]">
                        {agent.endpoint || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" /> 信誉
                      </span>
                      <span className="font-mono">
                        {(Number(agent.reputation) / 1e18).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">完成任务</span>
                      <span className="font-mono">
                        {Number(agent.tasksCompleted || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">质押量</span>
                      <span className="font-mono">
                        {(Number(agent.stakeAmount) / 1e18).toFixed(2)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">状态</span>
                      <span
                        className={
                          agent.registered ? "text-green-400" : "text-gray-500"
                        }
                      >
                        {agent.registered ? "已注册" : "未注册"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
