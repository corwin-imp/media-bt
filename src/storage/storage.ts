export interface Storage {
  createTask(params: CreateTaskParams): Promise<string>;
  updateTaskStatus(taskId: string, status: string, meta?: Record<string, any>): Promise<void>;
  addResultClip(taskId: string, clipPath: string, caption: string): Promise<void>;
  getTask(taskId: string): Promise<Task>;
  getResults(taskId: string): Promise<Result[]>;
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
  status: string;
  meta: Record<string, any>;
}

export interface Result {
  clipPath: string;
  caption: string;
}