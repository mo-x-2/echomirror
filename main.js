const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// dotenvを使って環境変数を読み込む
require('dotenv').config();
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
  
  // デバッグ: Twilio TURN認証情報を出力
  console.log('[main.js][DEBUG] config.twilio:', config.twilio);
  console.log('[main.js][DEBUG] process.env.TWILIO_USERNAME:', process.env.TWILIO_USERNAME);
  console.log('[main.js][DEBUG] process.env.TWILIO_PASSWORD:', process.env.TWILIO_PASSWORD);

  // 開発時はDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // レンダラープロセスに設定を渡す
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.appConfig = ${JSON.stringify(config)};
      // config.jsからTwilio TURN認証情報を渡す
      window.twilioConfig = {
        username: '${process.env.TWILIO_USERNAME || config.twilio.username}',
        password: '${process.env.TWILIO_PASSWORD || config.twilio.password}',
        enabled: true
      };
      console.log('[renderer][DEBUG] window.twilioConfig:', window.twilioConfig);
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