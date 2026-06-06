"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Loader2,
  Info,
  Github,
  Coins,
  Users,
  Link2,
} from "lucide-react";
import Header from "@/components/Header";
import AgentConfigPanel from "@/components/AgentConfigPanel";
import { createTask } from "@/lib/api";
import { AgentType } from "@/lib/contracts";

type SubmitStep = "form" | "submitting" | "success" | "error";

export default function CreateTaskPage() {
  const router = useRouter();
  const [step, setStep] = useState<SubmitStep>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [createdTaskId, setCreatedTaskId] = useState<number | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [bountyToken, setBountyToken] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [maxAgents, setMaxAgents] = useState("3");
  const [metadataURI, setMetadataURI] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<AgentType[]>([]);

  const handleToggleAgent = (agentType: AgentType) => {
    setSelectedAgents((prev) =>
      prev.includes(agentType)
        ? prev.filter((a) => a !== agentType)
        : [...prev, agentType]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !repo || !bountyAmount || !bountyToken) {
      setErrorMsg("请填写所有必填字段");
      return;
    }

    try {
      setStep("submitting");
      setErrorMsg("");

      const result = await createTask({
        name,
        repo,
        bountyToken,
        bountyAmount,
        maxAgents: Number(maxAgents),
        metadataURI,
      });

      setCreatedTaskId(result.id || result.taskId);
      setStep("success");
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "创建任务失败");
    }
  };

  // Success view
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-950">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-10 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
            <h2 className="mt-4 text-2xl font-bold text-gray-100">
              任务创建成功!
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              您的审计任务已提交到区块链。请等待代理分配后开始审计。
            </p>
            {createdTaskId && (
              <p className="mt-3 font-mono text-sm text-blue-400">
                任务 ID: #{createdTaskId}
              </p>
            )}
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="rounded-xl bg-gray-800 px-6 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
              >
                返回仪表盘
              </button>
              {createdTaskId && (
                <button
                  onClick={() => router.push(`/task/${createdTaskId}`)}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  查看任务详情
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error view
  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-950">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center">
            <Info className="mx-auto h-16 w-16 text-red-400" />
            <h2 className="mt-4 text-2xl font-bold text-gray-100">
              创建失败
            </h2>
            <p className="mt-2 text-sm text-red-400">{errorMsg}</p>
            <button
              onClick={() => setStep("form")}
              className="mt-6 rounded-xl bg-gray-800 px-6 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              重新尝试
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-100">创建审计任务</h1>
          <p className="mt-1 text-sm text-gray-500">
            提交智能合约进行去中心化安全审计
          </p>

          {step === "submitting" ? (
            <div className="mt-12 flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
              <p className="mt-4 text-sm text-gray-400">正在提交交易...</p>
              <div className="mt-4 space-y-2 text-xs text-gray-600">
                <p>1. 连接钱包确认</p>
                <p>2. 锁定赏金代币</p>
                <p>3. 创建任务记录</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Task Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  任务名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如: Uniswap V4 安全审计"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* GitHub Repo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Github className="inline h-3.5 w-3.5 mr-1.5" />
                  GitHub 仓库 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="owner/repo (例如: uniswap/v4-core)"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Bounty Token */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Coins className="inline h-3.5 w-3.5 mr-1.5" />
                  赏金代币地址 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={bountyToken}
                  onChange={(e) => setBountyToken(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-mono text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Bounty Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Coins className="inline h-3.5 w-3.5 mr-1.5" />
                  赏金数量 (ETH) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={bountyAmount}
                  onChange={(e) => setBountyAmount(e.target.value)}
                  placeholder="1.0"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Max Agents */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Users className="inline h-3.5 w-3.5 mr-1.5" />
                  最大代理数量
                </label>
                <input
                  type="number"
                  value={maxAgents}
                  onChange={(e) => setMaxAgents(e.target.value)}
                  min={1}
                  max={10}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Metadata URI */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Link2 className="inline h-3.5 w-3.5 mr-1.5" />
                  元数据 URI
                </label>
                <input
                  type="text"
                  value={metadataURI}
                  onChange={(e) => setMetadataURI(e.target.value)}
                  placeholder="ipfs://... 或 https://..."
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Agent Selection */}
              <AgentConfigPanel
                selectedAgents={selectedAgents}
                onToggle={handleToggleAgent}
              />

              {/* Error Message */}
              {errorMsg && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-sm text-red-400">{errorMsg}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-[0.99]"
              >
                <Send className="h-4 w-4" />
                创建审计任务 & 锁定赏金
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
