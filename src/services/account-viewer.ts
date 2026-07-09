// Account viewer service
// Fetches recent videos + account summary for TikTok, Instagram, YouTube
// using yt-dlp (already a project prerequisite) as the data source.

import { spawn } from 'child_process';
import type { Translations } from '../i18n/types.js';

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
  shadowbanned: boolean;
}

export interface AccountInfo {
  platform: Platform;
  username: string;
  displayName: string;
  url: string;
  followers: number | null;
  videoCount: number | null;
  accountTotalLikes: number | null;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  verified: boolean;
  createdAt: Date | null;
  shadowbanned: boolean;
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

/**
 * Count total entries in a playlist/channel using --flat-playlist --print id.
 * This is fast because it skips downloading individual video metadata.
 * Returns null if it fails or times out.
 */
function ytdlpPlaylistCount(url: string, timeoutMs = 45000): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', [
      '--flat-playlist',
      '--print', 'id',
      '--no-warnings',
      '--no-progress',
      url,
    ], { windowsHide: true });

    let count = 0;
    const timer = setTimeout(() => {
      proc.kill();
      resolve(count > 0 ? count : null);
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => {
      const text = d.toString();
      // Each line is a video id — count non-empty lines
      count += text.split('\n').filter((l) => l.trim()).length;
    });

    proc.on('close', () => {
      clearTimeout(timer);
      resolve(count > 0 ? count : null);
    });

    proc.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function toDate(entry: any): Date | null {
  if (!entry) return null;
  if (entry.upload_date && /^\d{8}$/.test(entry.upload_date)) {
    const y = +entry.upload_date.slice(0, 4);
    const mo = +entry.upload_date.slice(4, 6);
    const d = +entry.upload_date.slice(6, 8);
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

/** How old is this video in hours? Returns null if date is unknown. */
function hoursSinceUpload(entry: any): number | null {
  const d = toDate(entry);
  if (!d) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
}

/**
 * Heuristic shadow-ban detection.
 *
 * A video is considered shadow-banned when:
 * 1. yt-dlp reports a non-public availability (private, premium_only, etc.)
 * 2. The video has 0 views and was uploaded more than 1 hour ago
 *    (TikTok/Instagram videos normally accumulate views within minutes)
 * 3. The video has 0 views and the upload date is unknown (suspicious)
 *
 * This is a heuristic — not 100% accurate, but covers the common cases.
 */
function detectShadowban(entry: any): boolean {
  // 1. Check explicit availability field
  if (entry.availability && entry.availability !== 'public' && entry.availability !== 'unlisted') {
    return true;
  }

  const views = num(entry.view_count);

  // 2. Zero views after 1+ hours = likely shadow-banned
  if (views === 0) {
    const hoursOld = hoursSinceUpload(entry);
    if (hoursOld === null) return true;       // 0 views, unknown date — suspicious
    if (hoursOld > 1) return true;             // 0 views after 1 hour — very likely shadow-banned
  }

  return false;
}

/**
 * Fetch TikTok account-level statistics (followers, total likes, video count,
 * creation date, verification) by scraping the profile page HTML.
 *
 * yt-dlp does NOT provide follower counts for TikTok (unlike YouTube), so we
 * fetch the page directly and parse the embedded `__UNIVERSAL_DATA_FOR_REHYDRATION__`
 * JSON blob which contains a `webapp.user-detail` scope with `userInfo.stats`.
 *
 * Returns null on any failure so the caller can gracefully fall back.
 */
interface TikTokAccountStats {
  followers: number | null;
  totalLikes: number | null;
  videoCount: number | null;
  verified: boolean | null;
  createdAt: Date | null;
  displayName: string | null;
}

async function fetchTikTokAccountStats(url: string): Promise<TikTokAccountStats | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-us,en;q=0.5',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();

    const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;

    const json = JSON.parse(m[1]);
    const scope = json.__DEFAULT_SCOPE__ || {};
    const detail = scope['webapp.user-detail'] || {};
    const userInfo = detail.userInfo || {};
    const user = userInfo.user || {};
    const stats = userInfo.stats || {};

    return {
      followers: typeof stats.followerCount === 'number' ? stats.followerCount : null,
      totalLikes: typeof stats.heartCount === 'number' ? stats.heartCount : null,
      videoCount: typeof stats.videoCount === 'number' ? stats.videoCount : null,
      verified: typeof user.verified === 'boolean' ? user.verified : null,
      createdAt: typeof user.createTime === 'number' ? new Date(user.createTime * 1000) : null,
      displayName: user.nickname || user.uniqueId || null,
    };
  } catch {
    return null;
  }
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
    shadowbanned: detectShadowban(e),
  }));

  const first = entries[0] || {};

  // --- Account-level data from yt-dlp (may be missing for TikTok) ---
  let followers =
    typeof first.channel_follower_count === 'number' ? first.channel_follower_count :
    typeof first.uploader_subscriber_count === 'number' ? first.uploader_subscriber_count :
    typeof first.subscriber_count === 'number' ? first.subscriber_count :
    null;

  // --- Video count: try playlist_count first, fall back to flat-playlist count ---
  let videoCount =
    typeof first.playlist_count === 'number' ? first.playlist_count :
    null;

  // If playlist_count wasn't available, try to count via --flat-playlist (non-blocking on failure)
  if (videoCount === null) {
    try {
      videoCount = await ytdlpPlaylistCount(parsed.url, 45000);
    } catch {
      videoCount = null;
    }
  }

  let verified = !!first.channel_is_verified;
  let displayName = first.channel || first.uploader || first.uploader_id || parsed.username;
  let createdAt = toDate(first) || null;
  let accountTotalLikes: number | null = null;

  // --- TikTok: scrape the profile page for real account-level stats ---
  // yt-dlp does NOT provide follower counts / total likes for TikTok, so we
  // fetch the page directly. This also gives us an accurate videoCount and
  // account creation date.
  if (parsed.platform === 'tiktok') {
    const tt = await fetchTikTokAccountStats(parsed.url);
    if (tt) {
      if (tt.followers !== null) followers = tt.followers;
      if (tt.totalLikes !== null) accountTotalLikes = tt.totalLikes;
      if (tt.videoCount !== null) videoCount = tt.videoCount;
      if (tt.verified !== null) verified = tt.verified;
      if (tt.createdAt) createdAt = tt.createdAt;
      if (tt.displayName) displayName = tt.displayName;
    }
  }

  // --- Sample stats from the displayed videos ---
  // These are NOT account totals — they reflect only the last N videos.
  const sampleViews = videos.reduce((a, v) => a + v.views, 0);
  const sampleLikes = videos.reduce((a, v) => a + v.likes, 0);
  const sampleComments = videos.reduce((a, v) => a + v.comments, 0);
  const sampleShares = videos.reduce((a, v) => a + v.shares, 0);
  const sampleSaves = videos.reduce((a, v) => a + v.saves, 0);

  // For TikTok we have the real total likes; for others it stays null
  const totalLikes = accountTotalLikes !== null ? accountTotalLikes : sampleLikes;

  // Account-level shadow ban: ALL recent videos have 0 views / are flagged
  const shadowbannedVideos = videos.filter((v) => v.shadowbanned);
  const accountShadowbanned = videos.length > 0 && shadowbannedVideos.length === videos.length;

  return {
    platform: parsed.platform,
    username: parsed.username,
    displayName: String(displayName),
    url: parsed.url,
    followers,
    videoCount,
    accountTotalLikes,
    totalViews: sampleViews,
    totalLikes,
    totalComments: sampleComments,
    totalShares: sampleShares,
    totalSaves: sampleSaves,
    verified,
    createdAt,
    shadowbanned: accountShadowbanned,
    videos,
  };
}

// ---------- formatting helpers ----------

function pad(n: number): string { return n < 10 ? '0' + n : '' + n; }

function trimDecimal(s: string): string { return s.replace(/\.?0+$/, ''); }

/** Format counts like the requested layout: 15.6K, 1 394, 81.95K, 1.2M. */
export function formatCount(n: number | null | undefined, opts?: { precise?: boolean; na?: string }): string {
  if (n === null || n === undefined || isNaN(n as number)) return opts?.na || 'Н/Д';
  const v = Math.round(n as number);
  if (v >= 1_000_000) return trimDecimal((n as number / 1_000_000).toFixed(2)) + 'M';
  if (v >= 10_000) {
    const dec = opts?.precise ? 2 : 1;
    return trimDecimal((n as number / 1_000).toFixed(dec)) + 'K';
  }
  // thousands separator with narrow no-break space
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
}

function formatVideoDate(d: Date | null, na: string): string {
  if (!d) return na;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

function formatAccountDate(d: Date | null, na: string): string {
  if (!d) return na;
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Format the full report message.
 * Accepts an optional translations object; when omitted, falls back to the
 * original Ukrainian labels to preserve backward compatibility.
 */
export function formatAccountReport(info: AccountInfo, t?: Translations): string {
  const lines: string[] = [];
  const na = t?.REPORT_NA || 'Н/Д';
  const labelVideo = t?.REPORT_VIDEO || 'Відео';
  const labelUploaded = t?.REPORT_UPLOADED || 'Завантажено о';
  const labelPlatform = t?.REPORT_PLATFORM || 'Платформа';
  const labelShadowban = t?.REPORT_SHADOWBAN || 'Тіньовий бан';
  const labelTotalStats = t?.REPORT_TOTAL_STATS || 'Інформація про акаунт';
  const labelFollowers = t?.REPORT_FOLLOWERS || 'підписників';
  const labelVideos = t?.REPORT_VIDEOS || 'відео';
  const labelTotalLikes = t?.REPORT_TOTAL_LIKES || 'всього лайків';
  const labelSampleStats = t?.REPORT_SAMPLE_STATS || 'Останні відео';
  const shadowbanYes = t?.REPORT_SHADOWBAN_YES || '🚫 Так';
  const shadowbanNo = t?.REPORT_SHADOWBAN_NO || '✅ Ні';

  const fmtCount = (n: number | null | undefined, precise?: boolean) => formatCount(n, { precise, na });

  // --- Account info block (real account-level data) ---
  const handle = info.username.startsWith('@') || info.platform !== 'tiktok' ? info.username : `@${info.username}`;
  lines.push(`🌸 ${labelTotalStats}:`);
  lines.push(`${handle} (${info.url})${info.verified ? ' ✓' : ''} | ${PLATFORM_LABEL[info.platform]}`);
  lines.push(`├ 👥 : ${fmtCount(info.followers, true)} ${labelFollowers}`);
  lines.push(`├ ❤️ : ${fmtCount(info.accountTotalLikes, true)} ${labelTotalLikes}`);
  lines.push(`├ 📹 : ${info.videoCount !== null ? fmtCount(info.videoCount) : na} ${labelVideos}`);
  lines.push(`├ 📅 : ${formatAccountDate(info.createdAt, na)}`);
  lines.push(`└ ${labelShadowban}: ${info.shadowbanned ? shadowbanYes : shadowbanNo}`);
  lines.push('');

  // --- Recent videos block (per-video stats) ---
  lines.push(`📊 ${labelSampleStats}:`);
  let idx = 1;
  for (const v of info.videos) {
    const isLast = idx === info.videos.length;
    const prefix = isLast ? '└' : '├';
    const cont = isLast ? ' ' : '│';
    lines.push(`${prefix} 🎞 ${labelVideo} ${idx}: ${v.url}`);
    lines.push(`${cont}  ${labelUploaded}: ${formatVideoDate(v.uploadDate, na)}`);
    lines.push(`${cont}  ${labelShadowban}: ${v.shadowbanned ? shadowbanYes : shadowbanNo}`);
    lines.push(`${cont}  👁 : ${fmtCount(v.views)} ❤️ : ${fmtCount(v.likes)} 💬 : ${fmtCount(v.comments)} 📢 : ${fmtCount(v.shares)} 💾 : ${fmtCount(v.saves)}`);
    idx++;
  }

  return lines.join('\n');
}
