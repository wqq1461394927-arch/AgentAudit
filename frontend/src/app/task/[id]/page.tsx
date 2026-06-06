"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Coins,
  User,
  Calendar,
  Shield,
  FileCode,
  Cpu,
  Clock,
  ExternalLink,
} from "lucide-react";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import PhaseTimeline from "@/components/PhaseTimeline";
import { fetchTask, fetchTaskAgents } from "@/lib/api";
import {
  TaskStatus,
  STATUS_LABELS,
  AGENT_TYPE_LABELS,
  AgentType,
  formatEther,
  formatAddress,
  formatDate,
} from "@/lib/contracts";

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  [AgentType.Security]: Shield,
  [AgentType.Tokenomics]: Coins,
  [AgentType.Static]: FileCode,
};

const AGENT_COLORS: Record<AgentType, string> = {
  [AgentType.Security]: "bg-red-500/10 text-red-400 border-red-500/20",
  [AgentType.Tokenomics]: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  [AgentType.Static]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface TaskDetail {
  id: number;
  name: string;
  owner: string;
  repo: string;
  bountyToken: string;
  bountyAmount: string;
  maxAgents: number;
  metadataURI: string;
  status: number;
  createdAt: number;
  deadline: number;
  agentCount: number;
}

interface AgentInfo {
  address: string;
  name: string;
  agentType: number;
  endpoint: string;
  reputation: string;
  tasksCompleted: string;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const [taskData, agentData] = await Promise.all([
          fetchTask(id),
          fetchTaskAgents(id),
        ]);
        setTask(taskData);
        setAgents(agentData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Header />
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <button
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> 返回
          </button>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-12 text-center">
            <p className="text-red-400">{error || "任务不存在"}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>

        {/* Task Info Card */}
        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-500">
                  #{task.id}
                </span>
                <h1 className="text-2xl font-bold text-gray-100">
                  {task.name}
                </h1>
                <StatusBadge status={task.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-mono">{formatAddress(task.owner)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="font-mono text-gray-200">
                    {(Number(task.bountyAmount) / 1e18).toFixed(4)} ETH
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  创建: {formatDate(task.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-500" />
                  截止: {formatDate(task.deadline)}
                </span>
              </div>
            </div>
            {task.repo && (
              <a
                href={`https://github.com/${task.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {task.repo}
              </a>
            )}
          </div>
        </div>

        {/* Phase Timeline */}
        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-400">
            审计阶段进度
          </h2>
          <PhaseTimeline currentStatus={task.status} />
        </div>

        {/* Agents Section */}
        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-400">
            已分配审计代理 ({agents.length})
          </h2>
          {agents.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-600">暂无代理分配到此任务</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => {
                const Icon = AGENT_ICONS[agent.agentType as AgentType] || Cpu;
                const colorClass =
                  AGENT_COLORS[agent.agentType as AgentType] ||
                  "bg-gray-500/10 text-gray-400 border-gray-500/20";
                return (
                  <div
                    key={agent.address}
                    className={`rounded-xl border p-4 ${colorClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">
                          {agent.name}
                        </p>
                        <p className="font-mono text-xs opacity-70 truncate">
                          {formatAddress(agent.address)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs opacity-70">
                      <span>
                        信誉: {Number(agent.reputation) / 1e18 || 0}
                      </span>
                      <span>
                        完成: {Number(agent.tasksCompleted || 0)}
                      </span>
                    </div>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
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
                );
              })}
            </div>
          )}
        </div>

        {/* Submission Status */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-400">
            提交状态
          </h2>
          {task.status < TaskStatus.Committing ? (
            <p className="text-sm text-gray-600">
              审计尚未进入提交阶段，代理将在审计开始后提交发现。
            </p>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.address}
                  className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3"
                >
                  <span className="text-sm text-gray-300">{agent.name}</span>
                  <span
                    className={`text-xs font-medium ${
                      task.status === TaskStatus.Committing
                        ? "text-yellow-400"
                        : task.status === TaskStatus.Revealing
                        ? "text-purple-400"
                        : task.status >= TaskStatus.Settled
                        ? "text-green-400"
                        : "text-gray-500"
                    }`}
                  >
                    {task.status === TaskStatus.Committing
                      ? "待提交"
                      : task.status === TaskStatus.Revealing
                      ? "待公示"
                      : task.status >= TaskStatus.Settled
                      ? "已完成"
                      : "等待中"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
