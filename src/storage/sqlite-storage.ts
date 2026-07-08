import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { Storage, CreateTaskParams, Task, Result } from './storage.js';

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
      'audio_start_time', 'audio_end_time', 'quality', 'playback_speed'
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
      playback_speed: 'REAL'
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
        audio_start_time, audio_end_time, quality, playback_speed, status, meta
      ) VALUES (
        @id, @userId, @sourcePath, @sourceUrl, @mode, @clipCount,
        @startTime, @endTime, @trendChoice, @mp3Path,
        @audioStartTime, @audioEndTime, @quality, @playbackSpeed, @status, @meta
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
      status: 'queued',
      meta: JSON.stringify({})
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
             audio_start_time, audio_end_time, quality, playback_speed, status, meta
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

  close(): void {
    this.db.close();
  }
}