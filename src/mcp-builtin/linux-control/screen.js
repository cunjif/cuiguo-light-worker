import { run, runQuiet } from './exec.js';

export async function getScreenSize() {
  const result = await run('xdpyinfo | grep dimensions');
  if (!result.success) return result;
  const match = result.data.match(/(\d+)x(\d+)/);
  if (!match) return { success: false, message: 'Failed to parse screen size' };
  return { success: true, data: { width: parseInt(match[1], 10), height: parseInt(match[2], 10) } };
}

export async function getActiveWindow() {
  const idResult = await run('xdotool getactivewindow');
  if (!idResult.success) return idResult;
  const windowId = idResult.data;
  const nameResult = await run(`xdotool getwindowname ${windowId}`);
  const pidResult = await run(`xdotool getwindowpid ${windowId}`);
  const geomResult = await run(`xdotool getwindowgeometry --shell ${windowId}`);
  let geometry = {};
  if (geomResult.success) {
    for (const line of geomResult.data.split('\n')) {
      const [k, v] = line.split('=');
      if (k && v) geometry[k] = parseInt(v, 10);
    }
  }
  return {
    success: true,
    data: {
      windowId,
      title: nameResult.success ? nameResult.data : '',
      pid: pidResult.success ? parseInt(pidResult.data, 10) : 0,
      x: geometry.X || 0,
      y: geometry.Y || 0,
      width: geometry.WIDTH || 0,
      height: geometry.HEIGHT || 0,
    },
  };
}

export async function focusWindow(title) {
  const escaped = title.replace(/"/g, '\\"');
  const result = await runQuiet(`xdotool windowactivate --sync "$(xdotool search --name "${escaped}" | head -1)"`);
  if (!result.success) return result;
  return { success: true };
}

export async function resizeWindow(title, width, height) {
  const escaped = title.replace(/"/g, '\\"');
  const searchResult = await run(`xdotool search --name "${escaped}" | head -1`);
  if (!searchResult.success) return searchResult;
  const windowId = searchResult.data;
  const result = await runQuiet(`xdotool windowsize ${windowId} ${width} ${height}`);
  if (!result.success) return result;
  return { success: true };
}

export async function repositionWindow(title, x, y) {
  const escaped = title.replace(/"/g, '\\"');
  const searchResult = await run(`xdotool search --name "${escaped}" | head -1`);
  if (!searchResult.success) return searchResult;
  const windowId = searchResult.data;
  const result = await runQuiet(`xdotool windowmove ${windowId} ${x} ${y}`);
  if (!result.success) return result;
  return { success: true };
}

export async function getScreenshot(options = {}) {
  const { execSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `screenshot_${Date.now()}.png`);
  const format = options.format || 'jpeg';
  const quality = options.quality || 85;

  try {
    let captureCmd;
    if (options.region) {
      const { x, y, width, height } = options.region;
      captureCmd = `scrot -a ${x},${y},${width},${height} "${tmpFile}"`;
    } else {
      captureCmd = `scrot "${tmpFile}"`;
    }

    try {
      execSync(captureCmd, { timeout: 10000 });
    } catch {
      execSync(`import -window root "${tmpFile}"`, { timeout: 10000 });
    }

    let imageBuffer = fs.readFileSync(tmpFile);

    let resizeWidth = options.resize?.width || 1280;
    if (resizeWidth && imageBuffer.length > 0) {
      try {
        const sharp = await import('sharp');
        let pipeline = sharp.default(imageBuffer);
        const metadata = await pipeline.metadata();
        if (metadata.width && metadata.width > resizeWidth) {
          pipeline = pipeline.resize(resizeWidth, null, { fit: 'inside', withoutEnlargement: true });
        }
        if (options.grayscale !== false) {
          pipeline = pipeline.grayscale();
        }
        if (format === 'jpeg') {
          pipeline = pipeline.jpeg({ quality });
          imageBuffer = await pipeline.toBuffer();
        } else {
          pipeline = pipeline.png({ compressionLevel: options.compressionLevel || 6 });
          imageBuffer = await pipeline.toBuffer();
        }
      } catch {
        // sharp not available, return raw PNG
      }
    }

    const base64 = imageBuffer.toString('base64');
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    return {
      success: true,
      content: [
        {
          type: 'image',
          data: base64,
          mimeType,
        },
      ],
    };
  } catch (err) {
    return { success: false, message: `Failed to capture screenshot: ${err.message}` };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}