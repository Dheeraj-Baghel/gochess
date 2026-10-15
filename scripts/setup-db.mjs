import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
// This project has its own database. Idempotent schema setup never alters other apps.
await sql`CREATE TABLE IF NOT EXISTS knightfall_rooms (id text PRIMARY KEY, version integer NOT NULL DEFAULT 0, data jsonb NOT NULL, expires_at timestamptz NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS knightfall_rooms_expiry ON knightfall_rooms (expires_at)`;
await sql`CREATE TABLE IF NOT EXISTS knightfall_limits (id text PRIMARY KEY, hits integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS knightfall_limits_expiry ON knightfall_limits (expires_at)`;
console.log("Knightfall database is ready (rooms, optimistic locking, expiring rate limits).");