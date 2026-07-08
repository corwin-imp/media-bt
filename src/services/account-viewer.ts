// Account viewer service
// Fetches recent videos + account summary for TikTok, Instagram, YouTube
// using yt-dlp (already a project prerequisite) as the data source.

import { spawn } from 'child_process';

export type Platform = 'tiktok' | 'instagram' | 'youtube';

export interface VideoStat {
  url: string;
  title: string;
  uploadDate: Date | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface AccountInfo {
  platform: Platform;
  username: string;
  displayName: string;
  url: string;
  followers: number | null;
  videoCount: number | null;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  verified: boolean;
  createdAt: Date | null;
  videos: VideoStat[];
}

export interface ParsedAccount {
  platform: Platform;
  username: string;
  url: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

/**
 * Detect platform + normalize input (full URL or bare @username) into a
 * canonical channel/videos URL understandable by yt-dlp.
 * Bare @username defaults to TikTok.
 */
export function parseAccountInput(input: string): ParsedAccount | null {
  const s = (input || '').trim();
  if (!s) return null;

  // TikTok
  if (/tiktok\.com\//i.test(s)) {
    const m = s.match(/tiktok\.com\/@?([A-Za-z0-9._\-]+)/i);
    const username = m ? m[1] : '';
    if (!username) return null;
    return { platform: 'tiktok', username, url: `https://www.tiktok.com/@${username}` };
  }

  // Instagram
  if (/instagram\.com\//i.test(s)) {
    const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    const username = m ? m[1] : '';
    if (!username || ['p', 'reel', 'reels', 'tv', 'explore', 'accounts'].includes(username.toLowerCase())) return null;
    return { platform: 'instagram', username, url: `https://www.instagram.com/${username}/` };
  }

  // YouTube
  if (/youtube\.com\//i.test(s) || /youtu\.be\//i.test(s)) {
    let m = s.match(/youtube\.com\/@([A-Za-z0-9._\-]+)/i);
    if (m) return { platform: 'youtube', username: `@${m[1]}`, url: `https://www.youtube.com/@${m[1]}/videos` };
    m = s.match(/youtube\.com\/channel\/([A-Za-z0-9._\-]+)/i);
    if (m) return { platform: 'youtube', username: m[1], url: `https://www.youtube.com/channel/${m[1]}/videos` };
    m = s.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9._\-]+)/i);
    if (m) return { platform: 'youtube', username: m[1], url: `https://www.youtube.com/user/${m[1]}/videos` };
    return null;
  }

  // Bare @username or username -> default TikTok
  const bare = s.replace(/^@/, '');
  if (/^[A-Za-z0-9._\-]+$/.test(bare)) {
    return { platform: 'tiktok', username: bare, url: `https://www.tiktok.com/@${bare}` };
  }

  return null;
}

/** Spawn yt-dlp and collect newline-delimited JSON objects. */
function ytdlpJSON(args: string[], timeoutMs = 120000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timeout'));
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code: number) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      const out: any[] = [];
      for (const line of lines) {
        try { out.push(JSON.parse(line)); } catch { /* skip non-json line */ }
      }
      resolve(out);
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

function toDate(entry: any): Date | null {
  if (!entry) return null;
  if (entry.upload_date && /^\d{8}$/.test(entry.upload_date)) {
    const y = +entry.upload_date.slice(0, 4);
    const mo = +entry.upload_date.slice(4, 6);
    const d = +entry.upload_date.slice(6, 8);
    const hh = +((entry.timestamp || 0) % 86400);
    if (entry.timestamp) return new Date(entry.timestamp * 1000);
    return new Date(Date.UTC(y, mo - 1, d));
  }
  if (entry.timestamp) return new Date(entry.timestamp * 1000);
  if (entry.release_timestamp) return new Date(entry.release_timestamp * 1000);
  if (entry.upload_date) {
    const d = new Date(entry.upload_date);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function num(x: any): number {
  const n = typeof x === 'number' ? x : parseInt(x, 10);
  return isNaN(n) ? 0 : n;
}

/** Fetch the N newest videos + account summary for a parsed account. */
export async function fetchAccount(parsed: ParsedAccount, limit = 5): Promise<AccountInfo> {
  const args = [
    '--dump-json',
    '--no-warnings',
    '--no-progress',
    '--playlist-end', String(limit),
    '--retries', '1',
    '--socket-timeout', '30',
    parsed.url,
  ];

  let entries: any[];
  try {
    entries = await ytdlpJSON(args, 150000);
  } catch (err: any) {
    throw new Error(`Не удалось получить данные аккаунта (${parsed.platform}). ${err?.message || err}`);
  }

  if (!entries.length) {
    throw new Error(`Не найдено публичных видео для этого аккаунта (${parsed.platform}). Возможно, аккаунт приватный или неверная ссылка.`);
  }

  const videos: VideoStat[] = entries.map((e) => ({
    url: e.webpage_url || e.url || (parsed.platform === 'tiktok' ? `https://www.tiktok.com/@${parsed.username}/video/${e.id}` : e.id || ''),
    title: e.title || e.description || '(без названия)',
    uploadDate: toDate(e),
    views: num(e.view_count),
    likes: num(e.like_count),
    comments: num(e.comment_count),
    shares: num(e.repost_count ?? e.share_count),
    saves: num(e.favourite_count ?? e.bookmark_count),
  }));

  const first = entries[0] || {};
  const followers = typeof first.channel_follower_count === 'number' ? first.channel_follower_count : null;
  const videoCount = typeof first.playlist_count === 'number' ? first.playlist_count : null;
  const verified = !!first.channel_is_verified;
  const displayName = first.channel || first.uploader || first.uploader_id || parsed.username;
  const createdAt = toDate(first) || null;

  const totalViews = videos.reduce((a, v) => a + v.views, 0);
  const totalLikes = videos.reduce((a, v) => a + v.likes, 0);
  const totalComments = videos.reduce((a, v) => a + v.comments, 0);
  const totalShares = videos.reduce((a, v) => a + v.shares, 0);
  const totalSaves = videos.reduce((a, v) => a + v.saves, 0);

  return {
    platform: parsed.platform,
    username: parsed.username,
    displayName: String(displayName),
    url: parsed.url,
    followers,
    videoCount,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    verified,
    createdAt,
    videos,
  };
}

// ---------- formatting helpers ----------

function pad(n: number): string { return n < 10 ? '0' + n : '' + n; }

function trimDecimal(s: string): string { return s.replace(/\.?0+$/, ''); }

/** Format counts like the requested layout: 15.6K, 1 394, 81.95K, 1.2M. */
export function formatCount(n: number | null | undefined, opts?: { precise?: boolean }): string {
  if (n === null || n === undefined || isNaN(n as number)) return 'Н/Д';
  const v = Math.round(n as number);
  if (v >= 1_000_000) return trimDecimal((n as number / 1_000_000).toFixed(2)) + 'M';
  if (v >= 10_000) {
    const dec = opts?.precise ? 2 : 1;
    return trimDecimal((n as number / 1_000).toFixed(dec)) + 'K';
  }
  // thousands separator with narrow no-break space
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
}

function formatVideoDate(d: Date | null): string {
  if (!d) return 'Н/Д';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

function formatAccountDate(d: Date | null): string {
  if (!d) return 'Н/Д';
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

/** Format the full report message exactly like the requested layout. */
export function formatAccountReport(info: AccountInfo): string {
  const lines: string[] = [];

  let idx = 1;
  for (const v of info.videos) {
    lines.push(`📹 🎞 Відео: ${idx} (${v.url})`);
    lines.push(`├ Завантажено о: ${formatVideoDate(v.uploadDate)}`);
    lines.push(`├ Платформа : ${PLATFORM_LABEL[info.platform]}`);
    lines.push(`├ Тіньовий бан: Н/Д`);
    lines.push(`└ 👁 : ${formatCount(v.views)} ❤️ : ${formatCount(v.likes)} 💬 : ${formatCount(v.comments)} 📢 : ${formatCount(v.shares)} 💾 : ${formatCount(v.saves)}`);
    lines.push('');
    idx++;
  }

  const handle = info.username.startsWith('@') || info.platform !== 'tiktok' ? info.username : `@${info.username}`;
  lines.push(`🌸 Загальна статистика акаунту:`);
  lines.push(`${handle} (${info.url})${info.verified ? ' ✓' : ''} | ${PLATFORM_LABEL[info.platform]}`);
  lines.push(`├ 👁 : ${formatCount(info.totalViews)} ❤️ : ${formatCount(info.totalLikes)} 💬 : ${formatCount(info.totalComments)}`);
  lines.push(`├ 📢 : ${formatCount(info.totalShares)} 💾 : ${formatCount(info.totalSaves)} ⚠️ : 0`);
  lines.push(`├ 📅 : ${formatAccountDate(info.createdAt)}`);
  lines.push(`├ 👥 : ${formatCount(info.followers, { precise: true })} підписників`);
  lines.push(`└ 📹 : ${info.videoCount !== null ? formatCount(info.videoCount) : 'Н/Д'} відео`);

  return lines.join('\n');
}