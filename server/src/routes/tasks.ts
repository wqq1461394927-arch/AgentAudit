import { Router, Request, Response } from 'express';
import { getAllTasks, getTask } from '../services/contracts';
import { getTaskMetadata, storeTaskMetadata } from '../services/supabase';

const router = Router();

// GET /api/tasks - List all tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tasks = await getAllTasks();

    const tasksWithMetadata = await Promise.all(
      tasks.map(async (task) => {
        try {
          const metadata = await getTaskMetadata(task.id);
          return {
            ...task,
            bountyAmount: task.bountyAmount.toString(),
            createdAt: task.createdAt.toString(),
            deadline: task.deadline.toString(),
            metadata,
          };
        } catch {
          return {
            ...task,
            bountyAmount: task.bountyAmount.toString(),
            createdAt: task.createdAt.toString(),
            deadline: task.deadline.toString(),
            metadata: null,
          };
        }
      })
    );

    res.json({ success: true, data: tasksWithMetadata });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
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

    const task = await getTask(taskId);
    const metadata = await getTaskMetadata(taskId);

    res.json({
      success: true,
      data: {
        ...task,
        bountyAmount: task.bountyAmount.toString(),
        createdAt: task.createdAt.toString(),
        deadline: task.deadline.toString(),
        metadata,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

// POST /api/tasks - Create task metadata in Supabase
router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, metadata } = req.body;

    if (!taskId || !metadata) {
      res.status(400).json({
        success: false,
        error: 'taskId and metadata are required',
      });
      return;
    }

    await storeTaskMetadata(taskId, metadata);

    res.status(201).json({ success: true, data: { taskId, metadata } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// GET /api/tasks/:id/agents - Get agents assigned to a task
router.get('/:id/agents', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ success: false, error: 'Invalid task ID' });
      return;
    }

    const { getTaskAgents } = await import('../services/contracts');
    const agents = await getTaskAgents(taskId);

    res.json({ success: true, data: agents });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
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
