import { Router, Request, Response } from 'express';
import { getAgentRegistryContract } from '../services/contracts';

const router = Router();

// GET /api/agents - List all registered agents
router.get('/', async (_req: Request, res: Response) => {
  try {
    const contract = getAgentRegistryContract();
    const agents = await contract.getAllAgents();

    const formatted = agents.map((a: any) => ({
      agentAddress: a.agentAddress,
      name: a.name,
      reputation: Number(a.reputation),
      registered: a.registered,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// GET /api/agents/default - Get default system agents
router.get('/default', async (_req: Request, res: Response) => {
  try {
    const contract = getAgentRegistryContract();
    const agents = await contract.getAllAgents();

    // Default agents are those with specific role indicators (e.g., zero-address-like pattern or special names)
    // In practice this might filter agents by some criteria; here we return all as default set
    const formatted = agents.map((a: any) => ({
      agentAddress: a.agentAddress,
      name: a.name,
      reputation: Number(a.reputation),
      registered: a.registered,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// GET /api/agents/:address - Get agent details
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address || address.length < 42) {
      res.status(400).json({ success: false, error: 'Invalid agent address' });
      return;
    }

    const contract = getAgentRegistryContract();
    const agent = await contract.getAgent(address);

    if (!agent || !agent.registered) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        agentAddress: agent.agentAddress,
        name: agent.name,
        reputation: Number(agent.reputation),
        registered: agent.registered,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

export default router;
