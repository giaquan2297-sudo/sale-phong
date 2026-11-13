import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { google } from 'googleapis';
import db, { IMAGES_DIR } from '../db.js';

const execFileAsync = promisify(execFile);

/**
 * Extracts Google Drive Folder ID from various URL patterns
 */
export function extractDriveFolderId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && !str.includes('/file/d/')) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(str)) return str;
  return null;
}

/**
 * Extracts Google Drive File ID from various URL patterns
 */
export function extractDriveFileId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const fileMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch && (str.includes('/open') || str.includes('/uc'))) return openMatch[1];
  return null;
}

/**
 * Parses flip-entry items from https://drive.google.com/embeddedfolderview?id=<id>#list
 */
export function parseEmbeddedFolderView(html) {
  const entries = [];
  if (!html) return entries;
  const entryRegex =
    /<div class="flip-entry" id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
  let m;
  while ((m = entryRegex.exec(html)) !== null) {
    const id = m[1];
    const href = m[2];
    const title = m[3].trim();
    const isFolder = href.includes('/folders/') || m[0].includes('aria-label="Folder"');
    const isVideo =
      m[0].includes('type/video') ||
      m[0].includes('alt="Video"') ||
      /\.(mp4|mov|avi|wmv|mkv|webm)$/i.test(title);
    entries.push({ id, href, title, isFolder, isVideo });
  }
  return entries;
}

/**
 * Fetches HTML of embedded folderview
 */
export async function fetchEmbeddedFolderHtml(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

/**
 * Helper to get a Google Drive API client using GCLI_ACCESS_TOKEN if present
 */
function getDriveApiClient() {
  const token = process.env.GCLI_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    return google.drive({ version: 'v3', auth: oauth2Client });
  } catch {
    return null;
  }
}

/**
 * Lists files in a Drive folder using Drive API v3 (when access token is available)
 */
async function listDriveApiFiles(folderId) {
  const drive = getDriveApiClient();
  if (!drive) return null;
  try {
    const q = `'${folderId}' in parents and trashed = false`;
    const res = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, webContentLink, thumbnailLink)',
      pageSize: 50,
    });
    return res.data?.files || [];
  } catch {
    return null;
  }
}

/**
 * Resolves image items from a Google Drive folder:
 * - Checks subfolders like 'Ảnh Mới'
 * - Filters out videos
 * - Constructs direct JPEG URLs via lh3.googleusercontent.com
 */
export async function resolveDriveFolderImages(urlOrId, options = {}) {
  const folderId = extractDriveFolderId(urlOrId);
  if (!folderId) {
    const fileId = extractDriveFileId(urlOrId);
    if (fileId) {
      return [
        {
          id: fileId,
          name: 'photo',
          url: `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        },
      ];
    }
    return [];
  }

  // 1. Try public embeddedfolderview first
  const rootHtml = await fetchEmbeddedFolderHtml(folderId);
  if (rootHtml) {
    const entries = parseEmbeddedFolderView(rootHtml);
    const subfolders = entries.filter((e) => e.isFolder);
    const rootImages = entries.filter((e) => !e.isFolder && !e.isVideo);

    // Prefer 'Ảnh Mới' or similar subfolder
    const newFolder = subfolders.find((f) => /mới|moi|new/i.test(f.title));
    if (newFolder) {
      const newHtml = await fetchEmbeddedFolderHtml(newFolder.id);
      if (newHtml) {
        const newEntries = parseEmbeddedFolderView(newHtml);
        const newImages = newEntries.filter((e) => !e.isFolder && !e.isVideo);
        if (newImages.length > 0) {
          return newImages.map((img) => ({
            id: img.id,
            name: img.title,
            url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`,
          }));
        }
      }
    }

    if (rootImages.length > 0) {
      return rootImages.map((img) => ({
        id: img.id,
        name: img.title,
        url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`,
      }));
    }

    // Check remaining subfolders (e.g. 'Ảnh Cũ' or others)
    for (const sf of subfolders) {
      const sfHtml = await fetchEmbeddedFolderHtml(sf.id);
      if (sfHtml) {
        const sfEntries = parseEmbeddedFolderView(sfHtml);
        const sfImages = sfEntries.filter((e) => !e.isFolder && !e.isVideo);
        if (sfImages.length > 0) {
          return sfImages.map((img) => ({
            id: img.id,
            name: img.title,
            url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`,
          }));
        }
      }
    }
  }

  // 2. Fallback: Drive API v3 (e.g. when proxy requires OAuth2)
  const apiFiles = await listDriveApiFiles(folderId);
  if (Array.isArray(apiFiles) && apiFiles.length > 0) {
    const subfolders = apiFiles.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
    const rootImages = apiFiles.filter(
      (f) =>
        f.mimeType &&
        f.mimeType.startsWith('image/') &&
        !/\.(mp4|mov|avi|wmv)$/i.test(f.name)
    );

    const newFolder = subfolders.find((f) => /mới|moi|new/i.test(f.name));
    if (newFolder) {
      const subFiles = await listDriveApiFiles(newFolder.id);
      if (Array.isArray(subFiles)) {
        const subImages = subFiles.filter(
          (f) =>
            f.mimeType &&
            f.mimeType.startsWith('image/') &&
            !/\.(mp4|mov|avi|wmv)$/i.test(f.name)
        );
        if (subImages.length > 0) {
          return subImages.map((img) => ({
            id: img.id,
            name: img.name,
            mimeType: img.mimeType,
            url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`,
          }));
        }
      }
    }

    if (rootImages.length > 0) {
      return rootImages.map((img) => ({
        id: img.id,
        name: img.name,
        mimeType: img.mimeType,
        url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`,
      }));
    }

    for (const sf of subfolders) {
      const subFiles = await listDriveApiFiles(sf.id);
      if (Array.isArray(subFiles)) {
        const subImages = subFiles.filter(
          (f) =>
            f.mimeType &&
            f.mimeType.startsWith('image/') &&
            !/\.(mp4|mov|avi|wmv)$/i.test(f.name)
        );
        if (subImages.length > 0) {
          return subImages.map((img) => ({
            id: img.id,
            name: img.name,
            mimeType: img.mimeType,
            url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`,
          }));
        }
      }
    }
  }

  return [];
}

/**
 * Downloads image file buffer from Google Drive:
 * 1. Tries direct HTTPS fetch from lh3.googleusercontent.com (serves converted JPEG)
 * 2. Fallback: Drive API v3 alt=media + sips convert if HEIC on macOS
 */
export async function downloadDriveImageBuffer(fileId, item = {}) {
  // 1. Try public lh3 CDN first
  const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  try {
    const resp = await fetch(cdnUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (resp.ok) {
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.startsWith('image/')) {
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length > 100) {
          return { buffer: buf, ext: '.jpg' };
        }
      }
    }
  } catch {
    // Ignore and fallback
  }

  // 2. Drive API v3 fallback
  const drive = getDriveApiClient();
  if (drive) {
    try {
      const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      let buf = Buffer.from(res.data);
      const isHeic =
        item.mimeType === 'image/heif' ||
        item.mimeType === 'image/heic' ||
        /\.heic$/i.test(item.name || '');

      if (isHeic) {
        // Convert HEIC to JPEG using sips on macOS
        const tmpInput = path.join(
          IMAGES_DIR,
          `_tmp_${fileId}_${Date.now()}.heic`
        );
        const tmpOutput = path.join(
          IMAGES_DIR,
          `_tmp_${fileId}_${Date.now()}.jpg`
        );
        try {
          fs.writeFileSync(tmpInput, buf);
          execFileSync('sips', ['-s', 'format', 'jpeg', tmpInput, '--out', tmpOutput], {
            timeout: 5000,
          });
          if (fs.existsSync(tmpOutput)) {
            buf = fs.readFileSync(tmpOutput);
          }
        } catch {
          // If sips fails, retain original buffer
        } finally {
          fs.rmSync(tmpInput, { force: true });
          fs.rmSync(tmpOutput, { force: true });
        }
      }

      return { buffer: buf, ext: '.jpg' };
    } catch {
      // Fallback failed
    }
  }

  return null;
}

/**
 * Downloads and saves real photos for a room into data/images/<roomId>/
 * Inserts rows into the `images` table with is_cover: 1 on the first photo.
 */
export async function downloadAndSaveRoomPhotos(roomId, driveUrl, options = {}) {
  const maxPhotos = options.maxPhotos || 8;
  const imageItems = await resolveDriveFolderImages(driveUrl, options);
  if (imageItems.length === 0) return { count: 0, photos: [] };

  const roomDir = path.join(IMAGES_DIR, String(roomId));
  fs.mkdirSync(roomDir, { recursive: true });

  const itemsToDownload = imageItems.slice(0, maxPhotos);
  const saved = [];

  const insertImg = db.prepare(`
    INSERT INTO images (room_id, filename, remote_url, size, width, height, is_cover, sort_order)
    VALUES (?, ?, ?, ?, 0, 0, ?, ?)
  `);

  for (let idx = 0; idx < itemsToDownload.length; idx++) {
    const item = itemsToDownload[idx];
    const isCover = idx === 0 ? 1 : 0;
    const downloaded = await downloadDriveImageBuffer(item.id, item);

    let filename = '';
    let size = 0;
    if (downloaded && downloaded.buffer) {
      const ext = downloaded.ext || '.jpg';
      filename = `real-${item.id}${ext}`;
      const destPath = path.join(roomDir, filename);
      fs.writeFileSync(destPath, downloaded.buffer);
      size = downloaded.buffer.length;
    }

    const res = insertImg.run(
      roomId,
      filename,
      item.url,
      size,
      isCover,
      idx
    );

    saved.push({
      id: res.lastInsertRowid,
      roomId,
      filename,
      remoteUrl: item.url,
      isCover,
      sortOrder: idx,
      size,
    });
  }

  return { count: saved.length, photos: saved };
}

/**
 * Purges old placeholder/generic images for rooms belonging to sheetSourceId
 */
export function clearSheetRoomImages(sheetSourceId) {
  const rooms = db
    .prepare('SELECT id FROM rooms WHERE sheet_source_id = ?')
    .all(sheetSourceId);
  if (rooms.length === 0) return 0;

  let clearedCount = 0;
  for (const r of rooms) {
    const images = db.prepare('SELECT id, filename FROM images WHERE room_id = ?').all(r.id);
    const roomDir = path.join(IMAGES_DIR, String(r.id));
    for (const img of images) {
      if (img.filename) {
        const filePath = path.join(roomDir, img.filename);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { force: true });
        }
      }
    }
    db.prepare('DELETE FROM images WHERE room_id = ?').run(r.id);
    clearedCount += images.length;
  }
  return clearedCount;
}
