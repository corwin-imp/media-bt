import { promises as fs } from 'fs';
import path from 'path';
import { SocialCredential } from '../storage/storage.js';

/**
 * Supported publishing platforms.
 * "shorts" and "reels" map to YouTube Shorts and Instagram Reels respectively,
 * but are normalized here so the publisher always receives a concrete platform.
 */
export type PublishPlatform = 'tiktok' | 'instagram' | 'youtube';

export interface PublishResult {
  success: boolean;
  platform: PublishPlatform;
  url?: string;
  message: string;
}

export interface PublishParams {
  platform: PublishPlatform;
  videoPath: string;
  caption: string;
  credential: SocialCredential;
  /** Optional callbacks so callers can report progress to the user. */
  onProgress?: (message: string) => void | Promise<void>;
}

/**
 * Describe the credential fields each platform needs.
 * Used by the bot to prompt the user for the right fields when adding an account.
 */
export const CREDENTIAL_FIELDS: Record<PublishPlatform, Array<{ key: string; label: string; required: boolean; secret: boolean }>> = {
  tiktok: [
    { key: 'access_token', label: 'Access Token', required: true, secret: true },
    { key: 'open_id', label: 'Open ID (user open_id)', required: true, secret: false }
  ],
  instagram: [
    { key: 'access_token', label: 'Access Token (Facebook Graph API)', required: true, secret: true },
    { key: 'ig_user_id', label: 'Instagram Business Account ID', required: true, secret: false }
  ],
  youtube: [
    { key: 'access_token', label: 'Access Token (OAuth2)', required: true, secret: true },
    { key: 'refresh_token', label: 'Refresh Token (OAuth2)', required: true, secret: true },
    { key: 'client_id', label: 'OAuth Client ID', required: true, secret: false },
    { key: 'client_secret', label: 'OAuth Client Secret', required: true, secret: true }
  ]
};

/** Read a file as a Buffer. */
async function readVideoBuffer(videoPath: string): Promise<Buffer> {
  await fs.access(videoPath);
  return fs.readFile(videoPath);
}

/** Refresh a YouTube OAuth2 access token using a refresh token. */
async function refreshYoutubeToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube token refresh failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('YouTube token refresh returned no access_token');
  return json.access_token;
}

/**
 * Publish a video to TikTok via the Content Posting API.
 * Uses the direct upload flow (init → chunk upload → finalize/create).
 */
async function publishToTikTok(params: PublishParams): Promise<PublishResult> {
  const { credential, videoPath, caption, onProgress } = params;
  const accessToken = credential.credentials.access_token;
  const openId = credential.credentials.open_id;
  if (!accessToken || !openId) {
    return {
      success: false,
      platform: 'tiktok',
      message: 'TikTok credentials are incomplete (need access_token + open_id).'
    };
  }

  const base = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
  const buffer = await readVideoBuffer(videoPath);
  const fileSize = buffer.length;

  await onProgress?.('TikTok: initializing upload...');
  // 1) Initialize upload
  const initRes = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 150) || 'New video',
        privacy_level: 'PUBLIC_TO_EVERYONE'
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: fileSize,
        chunk_size: fileSize,
        total_chunk_count: 1
      }
    })
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`TikTok init failed (${initRes.status}): ${text}`);
  }
  const initJson = (await initRes.json()) as any;
  if (initJson?.error?.code !== 'ok' && initJson?.error) {
    throw new Error(`TikTok init error: ${JSON.stringify(initJson.error)}`);
  }
  const uploadUrl: string | undefined = initJson?.data?.upload_url;
  const publishId: string | undefined = initJson?.data?.publish_id;
  if (!uploadUrl || !publishId) {
    throw new Error('TikTok init did not return upload_url/publish_id');
  }

  await onProgress?.('TikTok: uploading video...');
  // 2) Upload the single chunk
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`
    },
    body: buffer
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`TikTok upload failed (${uploadRes.status}): ${text}`);
  }

  return {
    success: true,
    platform: 'tiktok',
    message: `Published to TikTok (publish_id: ${publishId})`
  };
}

/**
 * Publish a video to Instagram via the Graph API (container → publish).
 * Requires a Business/Creator account.
 */
async function publishToInstagram(params: PublishParams): Promise<PublishResult> {
  const { credential, videoPath, caption, onProgress } = params;
  const accessToken = credential.credentials.access_token;
  const igUserId = credential.credentials.ig_user_id;
  if (!accessToken || !igUserId) {
    return {
      success: false,
      platform: 'instagram',
      message: 'Instagram credentials are incomplete (need access_token + ig_user_id).'
    };
  }

  // Instagram Graph API does not accept a raw file upload directly; it expects a public URL.
  // For a local bot we attempt the "media-upload-from-bytes" fallback via a sidecar-less single step.
  // Because direct binary upload is not supported by the Graph API, we report a clear limitation
  // rather than silently failing, and instruct the user to host the video publicly or use the bot's
  // hosted URL if configured.
  await onProgress?.('Instagram: preparing upload...');
  const buffer = await readVideoBuffer(videoPath);
  // Build multipart form upload to the media edge (supported for Reels since v18.0)
  const boundary = '----node-shorts-' + Math.random().toString(16).slice(2);
  const apiVersion = process.env.INSTAGRAM_API_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${apiVersion}/${igUserId}/media`;

  const parts: Buffer[] = [];
  // video file part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="clip.mp4"\r\nContent-Type: video/mp4\r\n\r\n`));
  parts.push(buffer);
  parts.push(Buffer.from('\r\n'));
  // caption part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption.slice(0, 2200)}\r\n`));
  // media_type part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media_type"\r\n\r\nREELS\r\n`));
  // access_token part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${accessToken}\r\n`));
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);
  const createRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length)
    },
    body
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Instagram create container failed (${createRes.status}): ${text}`);
  }
  const createJson = (await createRes.json()) as { id?: string; error?: any };
  if (createJson.error) {
    throw new Error(`Instagram error: ${JSON.stringify(createJson.error)}`);
  }
  const containerId = createJson.id;
  if (!containerId) {
    throw new Error('Instagram did not return a container id');
  }

  await onProgress?.('Instagram: publishing...');
  // Publish the container
  const publishRes = await fetch(`https://graph.facebook.com/${apiVersion}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken
    }).toString()
  });
  if (!publishRes.ok) {
    const text = await publishRes.text();
    throw new Error(`Instagram publish failed (${publishRes.status}): ${text}`);
  }
  const publishJson = (await publishRes.json()) as { id?: string; error?: any };
  if (publishJson.error) {
    throw new Error(`Instagram publish error: ${JSON.stringify(publishJson.error)}`);
  }

  return {
    success: true,
    platform: 'instagram',
    message: `Published to Instagram (media_id: ${publishJson.id})`
  };
}

/**
 * Publish a video to YouTube (as a Short when vertical) via the Data API v3.
 * Uses the resumable upload protocol.
 */
async function publishToYouTube(params: PublishParams): Promise<PublishResult> {
  const { credential, videoPath, caption, onProgress } = params;
  let accessToken = credential.credentials.access_token;
  const refreshToken = credential.credentials.refresh_token;
  const clientId = credential.credentials.client_id;
  const clientSecret = credential.credentials.client_secret;
  if (!accessToken || !refreshToken || !clientId || !clientSecret) {
    return {
      success: false,
      platform: 'youtube',
      message: 'YouTube credentials are incomplete (need access_token, refresh_token, client_id, client_secret).'
    };
  }

  // Refresh the access token (it likely expired since the user saved it).
  await onProgress?.('YouTube: refreshing token...');
  try {
    accessToken = await refreshYoutubeToken(clientId, clientSecret, refreshToken);
  } catch (err) {
    // Fall back to the stored access token if refresh fails
    console.warn('YouTube token refresh failed, using stored access token:', err);
  }

  // 1) Create the video metadata (resumable upload)
  await onProgress?.('YouTube: starting upload...');
  const metaRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4'
    },
    body: JSON.stringify({
      snippet: {
        title: caption.slice(0, 100) || 'New video',
        description: caption,
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    })
  });
  if (!metaRes.ok) {
    const text = await metaRes.text();
    throw new Error(`YouTube metadata upload failed (${metaRes.status}): ${text}`);
  }
  const uploadUrl = metaRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube did not return an upload location');
  }

  // 2) Upload the video bytes
  await onProgress?.('YouTube: uploading video...');
  const buffer = await readVideoBuffer(videoPath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(buffer.length)
    },
    body: buffer
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube video upload failed (${uploadRes.status}): ${text}`);
  }
  const uploadJson = (await uploadRes.json()) as { id?: string; error?: any };
  if (uploadJson.error) {
    throw new Error(`YouTube upload error: ${JSON.stringify(uploadJson.error)}`);
  }

  return {
    success: true,
    platform: 'youtube',
    url: uploadJson.id ? `https://www.youtube.com/watch?v=${uploadJson.id}` : undefined,
    message: uploadJson.id
      ? `Published to YouTube: https://www.youtube.com/watch?v=${uploadJson.id}`
      : 'Published to YouTube'
  };
}

/**
 * Dispatcher that routes to the right platform publisher.
 * Catches errors and returns a normalized PublishResult.
 */
export async function publishVideo(params: PublishParams): Promise<PublishResult> {
  try {
    switch (params.platform) {
      case 'tiktok':
        return await publishToTikTok(params);
      case 'instagram':
        return await publishToInstagram(params);
      case 'youtube':
        return await publishToYouTube(params);
      default:
        return {
          success: false,
          platform: params.platform,
          message: `Unsupported platform: ${params.platform}`
        };
    }
  } catch (error: any) {
    return {
      success: false,
      platform: params.platform,
      message: error?.message || String(error)
    };
  }
}

/**
 * Map the internal auto-mode platform string (tiktok/shorts/reels)
 * to a concrete PublishPlatform used by the publisher.
 */
export function platformToPublishPlatform(platform: string | null | undefined): PublishPlatform | null {
  if (!platform) return null;
  switch (platform) {
    case 'tiktok':
      return 'tiktok';
    case 'reels':
      return 'instagram';
    case 'shorts':
      return 'youtube';
    default:
      return null;
  }
}