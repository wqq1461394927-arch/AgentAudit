import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';
import tasksRouter from './routes/tasks';
import agentsRouter from './routes/agents';
import bountiesRouter from './routes/bounties';

const app = express();

// ── Middleware ──────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ───────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Routes ─────────────────────────────────────
app.use('/api/tasks', tasksRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/bounties', bountiesRouter);

// ── Start ──────────────────────────────────────
validateConfig();

app.listen(config.port, () => {
  console.log(`[Server] Listening on http://localhost:${config.port}`);
  console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
});

export default app;
