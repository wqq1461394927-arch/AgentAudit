import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/bounties/locked/:taskId
router.get('/locked/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) { res.status(400).json({ success: false, error: 'Invalid task ID' }); return; }
    try {
      const { getBountyEscrowContract } = await import('../services/contracts');
      const contract = getBountyEscrowContract();
      const tokenAddress = (req.query.token as string) || '0x0000000000000000000000000000000000000000';
      const locked = tokenAddress
        ? await contract.getLockedBounty(tokenAddress, taskId)
        : await contract.lockedBounties('0x0000000000000000000000000000000000000000', taskId);
      res.json({ success: true, data: { taskId, token: tokenAddress, lockedAmount: locked.toString() } });
    } catch {
      res.json({ success: true, data: { taskId, token: '0x0000...0000', lockedAmount: '1000000000' }, demo: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/bounties/total
router.get('/total', async (req: Request, res: Response) => {
  try {
    try {
      const { getBountyEscrowContract } = await import('../services/contracts');
      const contract = getBountyEscrowContract();
      const tokenAddress = (req.query.token as string) || '0x0000000000000000000000000000000000000000';
      const total = await contract.totalLockedByToken(tokenAddress);
      res.json({ success: true, data: { token: tokenAddress, totalLocked: total.toString() } });
    } catch {
      res.json({ success: true, data: { token: '0x0000...0000', totalLocked: '1500000000' }, demo: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
