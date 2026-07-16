import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { router as apiRouter } from './api.js';
import { pollOnce } from './poller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);
app.use(express.static(join(__dirname, '..', 'public')));

const cronSchedule = process.env.POLL_CRON || '0 6 * * *';
cron.schedule(cronSchedule, () => {
  pollOnce().catch((err) => console.error('Scheduled poll failed:', err));
});

app.listen(port, () => {
  console.log(`Brown News listening on port ${port}`);
});
