import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const isProduction = process.env.NODE_ENV === 'production';
  const dbPath = isProduction
    ? '/tmp/learning.db'
    : path.join(process.cwd(), 'data', 'learning.db');

  if (!isProduction) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS unknown_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      last_seen INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_term ON unknown_terms(term);

    CREATE TABLE IF NOT EXISTS question_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      last_seen INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pattern ON question_patterns(pattern);
  `);

  return db;
}

export function logUnknownTerm(term: string): void {
  try {
    const database = getDb();
    const now = Date.now();
    database
      .prepare(
        `INSERT INTO unknown_terms (term, count, last_seen)
         VALUES (?, 1, ?)
         ON CONFLICT(term) DO UPDATE SET count = count + 1, last_seen = ?`
      )
      .run(term, now, now);
  } catch {
    // Non-critical — never block the request
  }
}

export function logQuestionPattern(pattern: string): void {
  try {
    const database = getDb();
    const now = Date.now();
    database
      .prepare(
        `INSERT INTO question_patterns (pattern, count, last_seen)
         VALUES (?, 1, ?)
         ON CONFLICT(pattern) DO UPDATE SET count = count + 1, last_seen = ?`
      )
      .run(pattern, now, now);
  } catch {
    // Non-critical
  }
}
