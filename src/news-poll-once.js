import 'dotenv/config';
import { pollNewsOnce } from './news-poller.js';
import { pool } from './db.js';

await pollNewsOnce();
await pool.end();
