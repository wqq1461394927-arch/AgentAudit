"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Plus,
  Search,
  Loader2,
  Eye,
  Coins,
  Users,
  Activity,
} from "lucide-react";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import { fetchTasks } from "@/lib/api";
import {
  formatEther,
  formatAddress,
  formatDate,
  STATUS_LABELS,
} from "@/lib/contracts";

interface TaskItem {
  id: number;
  name: string;
  owner: string;
  bountyToken: string;
  bountyAmount: string;
  status: number;
  deadline: number;
  agentCount: number;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchTasks();
        setTasks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalBounty = tasks.reduce(
    (sum, t) => sum + Number(t.bountyAmount || 0) / 1e18,
    0
  );
  const activeTasks = tasks.filter((t) => t.status >= 0 && t.status < 7);
  const uniqueAgents = new Set<string>();
  tasks.forEach((t) => uniqueAgents.add(t.owner));

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Hero */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                CeatDAO
              </span>
              <span className="text-gray-300"> 漏洞赏金平台</span>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              去中心化智能合约审计 · AI Agent 驱动 · 完全透明
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            创建审计任务
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">
                  {tasks.length}
                </p>
                <p className="text-xs text-gray-500">总任务数</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Coins className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">
                  {totalBounty.toFixed(2)}
                  <span className="text-sm font-normal text-gray-500"> ETH</span>
                </p>
                <p className="text-xs text-gray-500">总赏金锁定</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">
                  {uniqueAgents.size}
                </p>
                <p className="text-xs text-gray-500">活跃审计代理</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="ml-3 text-gray-500">加载任务中...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-16 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-700" />
            <p className="mt-4 text-gray-500">暂无审计任务</p>
            <Link
              href="/create"
              className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus className="h-4 w-4" />
              创建第一个任务
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3 font-medium text-gray-400">ID</th>
                  <th className="px-4 py-3 font-medium text-gray-400">
                    任务名称
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400">赏金</th>
                  <th className="px-4 py-3 font-medium text-gray-400">状态</th>
                  <th className="px-4 py-3 font-medium text-gray-400">阶段</th>
                  <th className="px-4 py-3 font-medium text-gray-400">代理</th>
                  <th className="px-4 py-3 font-medium text-gray-400">截止</th>
                  <th className="px-4 py-3 font-medium text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      #{task.id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-200">{task.name}</p>
                      <p className="text-xs text-gray-600 font-mono">
                        {formatAddress(task.owner)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-gray-200">
                        {(Number(task.bountyAmount) / 1e18).toFixed(4)}
                      </span>
                      <span className="text-xs text-gray-500"> ETH</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {task.agentCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(task.deadline)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/task/${task.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
