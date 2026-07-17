import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { router as apiRouter } from './api.js';
import { pollOnce } from './poller.js';
import { pollNewsOnce } from './news-poller.js';

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

cron.schedule('0 22 * * *', () => {
  pollNewsOnce().catch((err) => console.error('Scheduled news poll failed:', err));
}, { timezone: 'America/Chicago' });

app.listen(port, () => {
  console.log(`Brown News listening on port ${port}`);
});
