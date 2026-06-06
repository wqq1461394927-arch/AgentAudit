import { Router, Request, Response } from 'express';
import { getBountyEscrowContract } from '../services/contracts';

const router = Router();

// GET /api/bounties/locked/:taskId - Check locked bounty
router.get('/locked/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ success: false, error: 'Invalid task ID' });
      return;
    }

    const tokenAddress = (req.query.token as string) || undefined;
    const contract = getBountyEscrowContract();

    let locked: bigint;
    if (tokenAddress) {
      locked = await contract.getLockedBounty(tokenAddress, taskId);
    } else {
      // If no token specified, default to zero-address or first parameter
      locked = await contract.lockedBounties(
        '0x0000000000000000000000000000000000000000',
        taskId
      );
    }

    res.json({
      success: true,
      data: {
        taskId,
        token: tokenAddress || '0x0000000000000000000000000000000000000000',
        lockedAmount: locked.toString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// GET /api/bounties/total - Total locked by token
router.get('/total', async (req: Request, res: Response) => {
  try {
    const tokenAddress =
      (req.query.token as string) || '0x0000000000000000000000000000000000000000';
    const contract = getBountyEscrowContract();
    const total = await contract.totalLockedByToken(tokenAddress);

    res.json({
      success: true,
      data: {
        token: tokenAddress,
        totalLocked: total.toString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

export default router;
