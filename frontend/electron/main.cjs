const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let isControlledExit = false;
let isDialogActive = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#050a14',
    title: 'ShadowMind AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept window close event to present exit confirmation dialog
  mainWindow.on('close', (event) => {
    // If exit has been confirmed or already in clean termination, proceed without loop
    if (isControlledExit) {
      return;
    }

    // Prevent immediate close while awaiting user decision
    event.preventDefault();

    // Prevent duplicate confirmation dialogs
    if (isDialogActive) {
      return;
    }

    isDialogActive = true;

    // Use Electron native confirmation dialog matching ShadowMind requirements
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Exit Application'],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
      title: 'Are you sure you want to exit ShadowMind AI?',
      message: 'Are you sure you want to exit ShadowMind AI?',
      detail:
        "You're about to close ShadowMind AI. Your current session will end, and you will need to log in again the next time you open the application.\n\nDo you want to exit now?",
    });

    isDialogActive = false;

    if (choice === 1) {
      // Exit Application confirmed: set controlled exit flag and terminate cleanly
      isControlledExit = true;

      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:clear-session');
        }
      } catch {
        // Ignore communication errors during teardown
      }

      app.quit();
    } else {
      // User cancelled: keep window open and maintain current state
      isControlledExit = false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler when exit is triggered from renderer
ipcMain.on('app:exit-confirmed', () => {
  isControlledExit = true;
  app.quit();
});

app.on('before-quit', (e) => {
  if (!isControlledExit && mainWindow && !mainWindow.isDestroyed()) {
    // Before-quit should also honor window close confirmation if triggered via app quit
    isControlledExit = true;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
