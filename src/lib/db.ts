import Database from 'better-sqlite3';
import path from 'path';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = path.join(process.cwd(), 'kuzgu.db');
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');

    // Ensure honeypot tables exist
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS honeypot_logs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        device_type TEXT,
        lat REAL,
        lng REAL,
        city TEXT,
        country TEXT,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return dbInstance;
}
