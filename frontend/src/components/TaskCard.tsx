"use client";

import React from "react";
import Link from "next/link";
import { Calendar, Coins, Users } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { TaskStatus, formatEther, formatDate, formatAddress } from "@/lib/contracts";

interface TaskCardProps {
  task: {
    id: number;
    name: string;
    owner: string;
    bountyToken: string;
    bountyAmount: string | bigint;
    status: number;
    deadline: number | bigint;
    agentCount: number;
  };
  onClick?: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const bountyValue =
    typeof task.bountyAmount === "bigint"
      ? formatEther(task.bountyAmount)
      : (Number(task.bountyAmount) / 1e18).toFixed(4);

  return (
    <Link
      href={`/task/${task.id}`}
      onClick={onClick}
      className="group block rounded-xl border border-gray-800 bg-gray-900/60 p-5 transition-all hover:border-blue-600/50 hover:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">#{task.id}</span>
            <h3 className="truncate text-base font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">
              {task.name}
            </h3>
          </div>
          <p className="mt-1 text-xs text-gray-500 font-mono">
            {formatAddress(task.owner)}
          </p>
        </div>
        <StatusBadge status={task.status} size="sm" />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Coins className="h-3.5 w-3.5 text-yellow-500" />
          <span className="font-mono text-gray-200">{bountyValue}</span>
          <span className="text-gray-500">ETH</span>
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-blue-400" />
          {task.agentCount}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Calendar className="h-3.5 w-3.5 text-gray-500" />
          {formatDate(task.deadline)}
        </span>
      </div>
    </Link>
  );
}
