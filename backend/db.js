// db.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  // or host, user, password, database, etc.
});

export default { pool };
