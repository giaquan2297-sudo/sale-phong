import { spawn } from 'node:child_process';
import fs from 'node:fs';

/**
 * Open a local folder in the OS file manager (Finder / Explorer / xdg-open)
 * so the user can drag-and-drop images directly into Zalo PC.
 */
export function openFolderInOS(folderPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    let command;
    let args;
    if (process.platform === 'darwin') {
      command = 'open';
      args = [folderPath];
    } else if (process.platform === 'win32') {
      command = 'explorer';
      args = [folderPath];
    } else {
      command = 'xdg-open';
      args = [folderPath];
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });

    child.on('error', (err) => reject(err));
    child.unref();
    resolve();
  });
}
