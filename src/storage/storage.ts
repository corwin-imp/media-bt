export interface SocialCredential {
  id: string;
  userId: number;
  platform: string;
  label: string;
  credentials: Record<string, any>;
  createdAt: string;
}

export interface Storage {
  createTask(params: CreateTaskParams): Promise<string>;
  updateTaskStatus(taskId: string, status: string, meta?: Record<string, any>): Promise<void>;
  addResultClip(taskId: string, clipPath: string, caption: string): Promise<void>;
  getTask(taskId: string): Promise<Task>;
  getResults(taskId: string): Promise<Result[]>;

  // Social credentials (for publishing to TikTok/Instagram/YouTube)
  saveCredential(params: SaveCredentialParams): Promise<string>;
  getCredentials(userId: number, platform?: string): Promise<SocialCredential[]>;
  getCredentialById(id: string): Promise<SocialCredential | null>;
  deleteCredential(id: string, userId: number): Promise<void>;
}

export interface SaveCredentialParams {
  userId: number;
  platform: string;
  label: string;
  credentials: Record<string, any>;
}

export interface CreateTaskParams {
  userId: number;
  sourcePath: string;
  sourceUrl?: string | null;
  mode: string;
  clipCount: number;
  startTime?: number | null;
  endTime?: number | null;
  trendChoice?: string | null;
  mp3Path?: string | null;
  audioStartTime?: number | null;
  audioEndTime?: number | null;
  quality?: number | null;
  playbackSpeed?: number | null;
  platform?: string | null;
  /** Arbitrary metadata (e.g. publishTo credential id for cross-posting). */
  meta?: Record<string, any>;
}

export interface Task {
  id: string;
  userId: number;
  sourcePath: string;
  sourceUrl?: string | null;
  mode: string;
  clipCount: number;
  startTime?: number | null;
  endTime?: number | null;
  trendChoice?: string | null;
  mp3Path?: string | null;
  audioStartTime?: number | null;
  audioEndTime?: number | null;
  quality?: number | null;
  playbackSpeed?: number | null;
  platform?: string | null;
  status: string;
  meta: Record<string, any>;
}

export interface Result {
  clipPath: string;
  caption: string;
}