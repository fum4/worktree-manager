import { app, BrowserWindow, Menu, shell, Tray, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Custom protocol for opening projects: wok3://open?port=3100
const PROTOCOL = 'wok3';

// Track all open windows by their server URL
const windows = new Map<string, BrowserWindow>();
let tray: Tray | null = null;

function createWindow(serverUrl: string): BrowserWindow {
  // If a window for this URL already exists, focus it
  const existing = windows.get(serverUrl);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'wok3',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(currentDir, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(serverUrl);

  win.on('close', (event) => {
    if (tray && windows.size <= 1) {
      // Last window — hide to tray instead of closing
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    windows.delete(serverUrl);
    updateTrayMenu();
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  windows.set(serverUrl, win);
  updateTrayMenu();
  return win;
}

function updateTrayMenu() {
  if (!tray) return;

  const windowItems: Electron.MenuItemConstructorOptions[] = [];

  for (const [url, win] of windows) {
    const title = win.isDestroyed() ? url : (win.getTitle() || url);
    windowItems.push({
      label: title,
      click: () => {
        if (!win.isDestroyed()) {
          win.show();
          win.focus();
        }
      },
    });
  }

  const contextMenu = Menu.buildFromTemplate([
    ...(windowItems.length > 0
      ? [...windowItems, { type: 'separator' as const }]
      : []),
    {
      label: 'Quit',
      click: () => {
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAPCAYAAADtc08vAAAAiklEQVQoz2NgGAUkAEYGBob/DAwM/6E0MZiJgYHhPwMDwwIGBoYCBgYGBWIMAGkGaVxAjAuwuQCbN4gCjAwMDAsYGBgKQBwGBgYFBgYGRmI0I7sAm2aQy0B8dBcQDECuB7mMGE3IAYjNyIYBNaMAmS8oYCRgUGBgYEiANHIxMBAbgBwwkABGAQAAJ1cwK/7gzBkAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('wok3 - Worktree Manager');

  tray.on('click', () => {
    // Show the most recently focused window, or the first one
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      const win = allWindows[0];
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
      }
    }
  });

  updateTrayMenu();
}

function handleProtocolUrl(url: string) {
  // wok3://open?port=3100  or  wok3://open?url=http://localhost:3100
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'open') {
      const port = parsed.searchParams.get('port');
      const serverUrl = parsed.searchParams.get('url')
        || (port ? `http://localhost:${port}` : null);
      if (serverUrl) {
        createWindow(serverUrl);
      }
    }
  } catch {
    // Ignore malformed URLs
  }
}

// Register as handler for wok3:// protocol
if (process.defaultApp) {
  // Dev mode: register with path to electron + script
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// macOS: handle protocol URLs when app is already running
app.on('open-url', (_event, url) => {
  handleProtocolUrl(url);
});

// Ensure single instance — second instance forwards its args to the first
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // On macOS, open-url fires instead. On other platforms, check argv.
    const urlArg = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (urlArg) {
      handleProtocolUrl(urlArg);
    }
  });
}

app.whenReady().then(async () => {
  createTray();

  // Check if launched with a protocol URL (macOS passes via open-url event,
  // but on first launch it may be in argv)
  const protocolArg = process.argv.find((arg) =>
    arg.startsWith(`${PROTOCOL}://`),
  );
  if (protocolArg) {
    handleProtocolUrl(protocolArg);
  }

  // If no windows were opened by protocol URL, check for --port flag
  // (used by the CLI to open a window directly)
  if (windows.size === 0) {
    const portIdx = process.argv.indexOf('--port');
    if (portIdx !== -1 && process.argv[portIdx + 1]) {
      const port = process.argv[portIdx + 1];
      createWindow(`http://localhost:${port}`);
    }
  }

  // If still no windows, show nothing — the app sits in the tray
  // waiting for the CLI to request a window via protocol URL

  app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length === 0) {
      // No windows and no URL — nothing to show
      return;
    }
    const win = allWindows[0];
    win.show();
    win.focus();
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on macOS
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('before-quit', () => {
  tray = null;
});
