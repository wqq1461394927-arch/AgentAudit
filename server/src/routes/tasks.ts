import { Router, Request, Response } from 'express';

const router = Router();

// 演示数据
const MOCK_TASKS = [
  { id: 1, owner: '0x1234567890abcdef1234567890abcdef12345678', title: 'Vault Security Audit',
    bountyAmount: '1000000000', createdAt: '1749200000', deadline: '1749459200', status: 1, phase: 1,
    metadata: { name: 'Vault Security Audit', repository: 'github.com/defi/vault', bounty: '1000', duration: 72, agents: ['Security','Tokenomics','Static'] } },
  { id: 2, owner: '0xabcdef1234567890abcdef1234567890abcdef12', title: 'DEX Contract Audit',
    bountyAmount: '500000000', createdAt: '1749100000', deadline: '1749700000', status: 5, phase: 5,
    metadata: { name: 'DEX Smart Contract Audit', repository: 'github.com/defi/dex', bounty: '500', duration: 168, agents: ['Security','Static'] } },
];

let useMock = false;

// GET /api/tasks - List all tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    // 尝试从合约读取
    try {
      const { getAllTasks: readTasks } = await import('../services/contracts');
      const tasks = await readTasks();
      const { getTaskMetadata } = await import('../services/supabase');

      const tasksWithMetadata = await Promise.all(
        tasks.map(async (task) => {
          try {
            const metadata = await getTaskMetadata(task.id);
            return { ...task, bountyAmount: task.bountyAmount.toString(), createdAt: task.createdAt.toString(), deadline: task.deadline.toString(), metadata };
          } catch {
            return { ...task, bountyAmount: task.bountyAmount.toString(), createdAt: task.createdAt.toString(), deadline: task.deadline.toString(), metadata: null };
          }
        })
      );
      res.json({ success: true, data: tasksWithMetadata, demo: false });
    } catch {
      // 合约不可用，返回演示数据
      useMock = true;
      res.json({ success: true, data: MOCK_TASKS, demo: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/tasks/:id - Get single task with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ success: false, error: 'Invalid task ID' });
      return;
    }

    try {
      const { getTask } = await import('../services/contracts');
      const task = await getTask(taskId);
      const { getTaskMetadata } = await import('../services/supabase');
      const metadata = await getTaskMetadata(taskId);
      res.json({
        success: true,
        data: { ...task, bountyAmount: task.bountyAmount.toString(), createdAt: task.createdAt.toString(), deadline: task.deadline.toString(), metadata },
      });
    } catch {
      const mock = MOCK_TASKS.find(t => t.id === taskId);
      if (mock) res.json({ success: true, data: mock, demo: true });
      else res.status(404).json({ success: false, error: 'Task not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /api/tasks - Create task metadata
router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, metadata } = req.body;
    if (!taskId || !metadata) {
      res.status(400).json({ success: false, error: 'taskId and metadata are required' });
      return;
    }
    try {
      const { storeTaskMetadata } = await import('../services/supabase');
      await storeTaskMetadata(taskId, metadata);
    } catch {
      // 无Supabase时演示模式静默成功
    }
    res.status(201).json({ success: true, data: { taskId, metadata } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/tasks/:id/agents
router.get('/:id/agents', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) { res.status(400).json({ success: false, error: 'Invalid task ID' }); return; }
    try {
      const { getTaskAgents } = await import('../services/contracts');
      const agents = await getTaskAgents(taskId);
      res.json({ success: true, data: agents });
    } catch {
      res.json({ success: true, data: ['0xAgent000000000000000000000000000001','0xAgent000000000000000000000000000002'], demo: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/tasks/:id/submissions - Get agent commit/reveal status
router.get('/:id/submissions', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ success: false, error: 'Invalid task ID' });
      return;
    }

    const { getTaskAgents, getCommitRecord } = await import('../services/contracts');
    const agents = await getTaskAgents(taskId);

    const submissions = await Promise.all(
      agents.map(async (agent) => {
        try {
          const record = await getCommitRecord(taskId, agent);
          return {
            agent,
            commitHash: record.commitHash,
            revealed: record.revealed,
            timestamp: record.timestamp.toString(),
          };
        } catch {
          return {
            agent,
            commitHash: null,
            revealed: false,
            timestamp: null,
          };
        }
      })
    );

    res.json({ success: true, data: submissions });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

export default router;
