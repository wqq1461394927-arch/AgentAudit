import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.key);
  }
  return supabase;
}

// ──────────── Task Metadata ────────────

export async function storeTaskMetadata(
  taskId: number | string,
  metadata: Record<string, unknown>
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('tasks_metadata')
    .upsert(
      { task_id: Number(taskId), metadata, updated_at: new Date().toISOString() },
      { onConflict: 'task_id' }
    );

  if (error) {
    throw new Error(`Failed to store task metadata: ${error.message}`);
  }
}

export async function getTaskMetadata(
  taskId: number | string
): Promise<Record<string, unknown> | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('tasks_metadata')
    .select('metadata')
    .eq('task_id', Number(taskId))
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get task metadata: ${error.message}`);
  }

  return data?.metadata ?? null;
}

// ──────────── Agent Reports ────────────

export async function storeAgentReport(
  taskId: number | string,
  agentAddress: string,
  report: Record<string, unknown>
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from('agent_reports').insert({
    task_id: Number(taskId),
    agent_address: agentAddress.toLowerCase(),
    report,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to store agent report: ${error.message}`);
  }
}

export async function getAgentReports(
  taskId: number | string
): Promise<Array<{ agent_address: string; report: Record<string, unknown>; created_at: string }>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('agent_reports')
    .select('agent_address, report, created_at')
    .eq('task_id', Number(taskId))
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get agent reports: ${error.message}`);
  }

  return data ?? [];
}

// ──────────── Project Owner ────────────

export async function storeProjectOwner(
  address: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('project_owners')
    .upsert(
      { address: address.toLowerCase(), ...data, updated_at: new Date().toISOString() },
      { onConflict: 'address' }
    );

  if (error) {
    throw new Error(`Failed to store project owner: ${error.message}`);
  }
}

export async function getProjectOwner(
  address: string
): Promise<Record<string, unknown> | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('project_owners')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get project owner: ${error.message}`);
  }

  return data ?? null;
}
