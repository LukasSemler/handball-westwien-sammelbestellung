import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  'postgres://LukasSemler:8kpKtV5Ggvsm@ep-shrill-smoke-70167934.eu-central-1.aws.neon.tech/neondb';

// const pool = new pg.Pool();
const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const query = (text, params) => pool.query(text, params);

export { pool, query };
