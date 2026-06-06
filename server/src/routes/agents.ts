import { Router, Request, Response } from 'express';

const router = Router();

const MOCK_AGENTS = [
  { agentAddress: '0xAgent000000000000000000000000000001', name: '🔒 安全审计专家', reputation: 8920, registered: true },
  { agentAddress: '0xAgent000000000000000000000000000002', name: '📊 代币经济审计师', reputation: 6540, registered: true },
  { agentAddress: '0xAgent000000000000000000000000000003', name: '🔍 静态代码分析器', reputation: 9100, registered: true },
];

// GET /api/agents - List all registered agents
router.get('/', async (_req: Request, res: Response) => {
  try {
    try {
      const { getAgentRegistryContract } = await import('../services/contracts');
      const contract = getAgentRegistryContract();
      const agents = await contract.getAllAgents();
      const formatted = agents.map((a: any) => ({
        agentAddress: a.agentAddress, name: a.name, reputation: Number(a.reputation), registered: a.registered,
      }));
      res.json({ success: true, data: formatted, demo: false });
    } catch {
      res.json({ success: true, data: MOCK_AGENTS, demo: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/agents/default - Get default system agents
router.get('/default', async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: MOCK_AGENTS, demo: true }); }
  catch (err) { res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' }); }
});

// GET /api/agents/:address - Get agent details
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!address || address.length < 42) {
      res.status(400).json({ success: false, error: 'Invalid agent address' });
      return;
    }
    try {
      const { getAgentRegistryContract } = await import('../services/contracts');
      const contract = getAgentRegistryContract();
      const agent = await contract.getAgent(address);
      if (!agent || !agent.registered) { res.status(404).json({ success: false, error: 'Agent not found' }); return; }
      res.json({ success: true, data: { agentAddress: agent.agentAddress, name: agent.name, reputation: Number(agent.reputation), registered: agent.registered } });
    } catch {
      const mock = MOCK_AGENTS.find(a => a.agentAddress.toLowerCase() === address.toLowerCase());
      if (mock) res.json({ success: true, data: mock, demo: true });
      else res.status(404).json({ success: false, error: 'Agent not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
