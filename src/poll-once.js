import 'dotenv/config';
import { pollOnce } from './poller.js';
import { pool } from './db.js';

await pollOnce();
await pool.end();
