const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'EchoMirror'
  });

  mainWindow.loadFile('renderer/index.html');
  
  // 開発時はDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // レンダラープロセスに設定を渡す
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.appConfig = ${JSON.stringify(config)};
    `);
  });
}

// 設定取得のIPCハンドラー
ipcMain.handle('get-config', () => {
  return config;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 