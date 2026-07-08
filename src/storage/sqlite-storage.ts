import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Storage, CreateTaskParams, Task, Result, SocialCredential, SaveCredentialParams } from './storage.js';

/**
 * Credentials encryption helpers.
 * Uses AES-256-GCM with a key derived from CREDS_ENCRYPTION_KEY env var
 * (or a fallback derived from the Telegram token when not set).
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.CREDS_ENCRYPTION_KEY || process.env.TOKEN || 'node-shorts-default-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptJSON(data: Record<string, any>): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack as: iv(12) || tag(16) || ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptJSON(packed: string): Record<string, any> {
  const key = getEncryptionKey();
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export class SQLiteStorage implements Storage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initTables();
  }

  static async create(dbPath: string): Promise<SQLiteStorage> {
    const dir = path.dirname(dbPath);
    await fs.mkdir(dir, { recursive: true });
    return new SQLiteStorage(dbPath);
  }

  private initTables(): void {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        source_path TEXT,
        source_url TEXT,
        mode TEXT,
        clip_count INTEGER,
        start_time REAL,
        end_time REAL,
        trend_choice TEXT,
        mp3_path TEXT,
        audio_start_time REAL,
        audio_end_time REAL,
        quality INTEGER,
        playback_speed REAL,
        platform TEXT,
        status TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add columns if they don't exist (migration)
    const columns = this.getColumnInfo('tasks');
    const columnsToCheck = [
      'mode', 'start_time', 'end_time', 'mp3_path', 'source_url',
      'audio_start_time', 'audio_end_time', 'quality', 'playback_speed',
      'platform'
    ];

    // Column type mapping for migrations (newly added columns).
    // Numeric columns must be REAL, otherwise SQLite stores numbers as TEXT
    // and better-sqlite3 returns them as strings, which breaks Number methods
    // like `.toFixed()` downstream (e.g. playback_speed, start_time, ...).
    const columnTypes: Record<string, string> = {
      mode: 'TEXT',
      start_time: 'REAL',
      end_time: 'REAL',
      mp3_path: 'TEXT',
      source_url: 'TEXT',
      audio_start_time: 'REAL',
      audio_end_time: 'REAL',
      quality: 'INTEGER',
      playback_speed: 'REAL',
      platform: 'TEXT'
    };

    for (const col of columnsToCheck) {
      if (!columns.includes(col)) {
        try {
          const type = columnTypes[col] || 'TEXT';
          this.db.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${type}`);
        } catch (err) {
          // Column might already exist, ignore
        }
      }
    }

    // Results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        clip_path TEXT,
        caption TEXT
      )
    `);

    // Social credentials table (encrypted JSON)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_credentials (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        platform TEXT,
        label TEXT,
        credentials BLOB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_creds_user ON social_credentials(user_id)`);
  }

  private getColumnInfo(tableName: string): string[] {
    const result = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;
    return result.map(row => row.name);
  }

  async createTask(params: CreateTaskParams): Promise<string> {
    const taskId = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, user_id, source_path, source_url, mode, clip_count,
        start_time, end_time, trend_choice, mp3_path,
        audio_start_time, audio_end_time, quality, playback_speed,
        platform, status, meta
      ) VALUES (
        @id, @userId, @sourcePath, @sourceUrl, @mode, @clipCount,
        @startTime, @endTime, @trendChoice, @mp3Path,
        @audioStartTime, @audioEndTime, @quality, @playbackSpeed,
        @platform, @status, @meta
      )
    `);

    stmt.run({
      id: taskId,
      userId: params.userId,
      sourcePath: params.sourcePath,
      sourceUrl: params.sourceUrl ?? null,
      mode: params.mode,
      clipCount: params.clipCount,
      startTime: params.startTime ?? null,
      endTime: params.endTime ?? null,
      trendChoice: params.trendChoice ?? null,
      mp3Path: params.mp3Path ?? null,
      audioStartTime: params.audioStartTime ?? null,
      audioEndTime: params.audioEndTime ?? null,
      quality: params.quality ?? null,
      playbackSpeed: params.playbackSpeed ?? null,
      platform: params.platform ?? null,
      status: 'queued',
      meta: JSON.stringify(params.meta ?? {})
    });

    return taskId;
  }

  async updateTaskStatus(taskId: string, status: string, meta?: Record<string, any>): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE tasks SET status = ?, meta = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(status, JSON.stringify(meta || {}), taskId);
  }

  async addResultClip(taskId: string, clipPath: string, caption: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO results (task_id, clip_path, caption) VALUES (?, ?, ?)
    `);
    stmt.run(taskId, clipPath, caption);
  }

  // Coerce a value that might be stored as TEXT (legacy schema) back to a number.
  // Returns null for null/undefined/empty so callers keep their `| null` contract.
  private static toNumber(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async getTask(taskId: string): Promise<Task> {
    const stmt = this.db.prepare(`
      SELECT id, user_id, source_path, source_url, mode, clip_count,
             start_time, end_time, trend_choice, mp3_path,
             audio_start_time, audio_end_time, quality, playback_speed,
             platform, status, meta
      FROM tasks WHERE id = ?
    `);
    
    const row = stmt.get(taskId) as any;
    if (!row) {
      throw new Error('Task not found');
    }

    return {
      id: row.id,
      userId: row.user_id,
      sourcePath: row.source_path,
      sourceUrl: row.source_url,
      mode: row.mode || 'top_moments',
      clipCount: row.clip_count,
      startTime: SQLiteStorage.toNumber(row.start_time),
      endTime: SQLiteStorage.toNumber(row.end_time),
      trendChoice: row.trend_choice,
      mp3Path: row.mp3_path,
      audioStartTime: SQLiteStorage.toNumber(row.audio_start_time),
      audioEndTime: SQLiteStorage.toNumber(row.audio_end_time),
      quality: SQLiteStorage.toNumber(row.quality),
      playbackSpeed: SQLiteStorage.toNumber(row.playback_speed),
      platform: row.platform || null,
      status: row.status,
      meta: JSON.parse(row.meta || '{}')
    };
  }

  async getResults(taskId: string): Promise<Result[]> {
    const stmt = this.db.prepare(`
      SELECT clip_path, caption FROM results WHERE task_id = ?
    `);
    
    const rows = stmt.all(taskId) as Array<{ clip_path: string; caption: string }>;
    return rows.map(row => ({
      clipPath: row.clip_path,
      caption: row.caption
    }));
  }

  // --- Social credentials ---

  async saveCredential(params: SaveCredentialParams): Promise<string> {
    const id = uuidv4();
    const encrypted = encryptJSON(params.credentials);
    const stmt = this.db.prepare(`
      INSERT INTO social_credentials (id, user_id, platform, label, credentials)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, params.userId, params.platform, params.label, encrypted);
    return id;
  }

  async getCredentials(userId: number, platform?: string): Promise<SocialCredential[]> {
    const sql = platform
      ? `SELECT id, user_id, platform, label, credentials, created_at FROM social_credentials WHERE user_id = ? AND platform = ? ORDER BY created_at DESC`
      : `SELECT id, user_id, platform, label, credentials, created_at FROM social_credentials WHERE user_id = ? ORDER BY created_at DESC`;
    const stmt = this.db.prepare(sql);
    const rows = (platform ? stmt.all(userId, platform) : stmt.all(userId)) as Array<{
      id: string;
      user_id: number;
      platform: string;
      label: string;
      credentials: string;
      created_at: string;
    }>;
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      label: row.label,
      credentials: decryptJSON(row.credentials),
      createdAt: row.created_at
    }));
  }

  async getCredentialById(id: string): Promise<SocialCredential | null> {
    const stmt = this.db.prepare(`
      SELECT id, user_id, platform, label, credentials, created_at FROM social_credentials WHERE id = ?
    `);
    const row = stmt.get(id) as
      | {
          id: string;
          user_id: number;
          platform: string;
          label: string;
          credentials: string;
          created_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      label: row.label,
      credentials: decryptJSON(row.credentials),
      createdAt: row.created_at
    };
  }

  async deleteCredential(id: string, userId: number): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM social_credentials WHERE id = ? AND user_id = ?`);
    stmt.run(id, userId);
  }

  close(): void {
    this.db.close();
  }
}
