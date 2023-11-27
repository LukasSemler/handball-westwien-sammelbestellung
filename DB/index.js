import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

//const connectionString = process.env.DATABASE_URL;
// const connectionString =
//   'postgres://LukasSemler:8kpKtV5Ggvsm@ep-shrill-smoke-70167934.eu-central-1.aws.neon.tech/neondb';

const connectionString =
  'postgres://westwien_sammelbestellung_user:51ayVLWuqYoaQ1xjYWmEFJr4HjRwZtWV@dpg-clgtknfjc5ks73ehol10-a.frankfurt-postgres.render.com/westwien_sammelbestellung';

// const pool = new pg.Pool();
const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const query = (text, params) => pool.query(text, params);

export { pool, query };
