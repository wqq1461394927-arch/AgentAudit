import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_KEY || '',
  },
  rpc: {
    url: process.env.RPC_URL || 'http://localhost:8545',
    chainId: parseInt(process.env.CHAIN_ID || '31337', 10),
  },
  contracts: {
    taskManager: process.env.TASK_MANAGER_ADDRESS || '',
    bountyEscrow: process.env.BOUNTY_ESCROW_ADDRESS || '',
    agentRegistry: process.env.AGENT_REGISTRY_ADDRESS || '',
    deadlineController: process.env.DEADLINE_CONTROLLER_ADDRESS || '',
  },
} as const;

export type Config = typeof config;

export function validateConfig(): void {
  const required: string[] = [];
  if (!config.supabase.url) required.push('SUPABASE_URL');
  if (!config.supabase.key) required.push('SUPABASE_SERVICE_KEY');
  if (!config.contracts.taskManager) required.push('TASK_MANAGER_ADDRESS');
  if (!config.contracts.bountyEscrow) required.push('BOUNTY_ESCROW_ADDRESS');
  if (!config.contracts.agentRegistry) required.push('AGENT_REGISTRY_ADDRESS');
  if (!config.contracts.deadlineController) required.push('DEADLINE_CONTROLLER_ADDRESS');

  if (required.length > 0) {
    console.warn(
      `[Config] Missing environment variables: ${required.join(', ')}. ` +
      `Some features may not work correctly.`
    );
  }
}
