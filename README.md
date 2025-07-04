# EchoMirror

リアルタイムカメラ映像共有アプリケーション

## 概要

EchoMirrorは、WebRTCとTensorFlow.jsを使用したリアルタイムカメラ映像共有アプリケーションです。人検出機能により、両者がカメラに映っている時のみ相手の映像が表示されます。

## 機能

- リアルタイムビデオ通話（WebRTC）
- 人検出機能（TensorFlow.js）
- 自動映像表示制御
- レスポンシブデザイン（iPad対応）

## 使用方法

### 1. デスクトップアプリケーションとして使用

```bash
# 依存関係のインストール
npm install

# サーバーの起動
npm run server

# 別のターミナルでクライアントの起動
npm run client
```

### 2. ウェブアプリケーションとして使用（iPad対応）

```bash
# 依存関係のインストール
npm install

# ウェブサーバーの起動
npm run web
```

サーバーが起動したら、ブラウザで以下のURLにアクセス：

- ローカル: `http://localhost:8080`
- リモート: `http://[サーバーのIPアドレス]:8080`

### iPadでの使用方法

1. サーバーを起動したPCと同じWi-FiネットワークにiPadを接続
2. iPadのSafariで `http://[サーバーのIPアドレス]:8080` にアクセス
3. カメラアクセスを許可
4. 「サーバーに接続」ボタンをタップ
5. 「人検出: 開始」ボタンをタップ

## 技術仕様

- **フロントエンド**: HTML5, CSS3, JavaScript
- **バックエンド**: Node.js, Express
- **リアルタイム通信**: Socket.IO
- **ビデオ通信**: WebRTC
- **人検出**: TensorFlow.js Face Detection
- **デスクトップアプリ**: Electron

## ネットワーク設定

### Tailscaleを使用したリモートアクセス

1. Tailscaleをインストールしてアカウントにログイン
2. サーバーPCとiPadの両方でTailscaleを有効化
3. サーバーPCのTailscale IPアドレスを確認
4. iPadで `http://[Tailscale IP]:8080` にアクセス

### ポート設定

デフォルトポート: 8080

環境変数で変更可能：
```bash
PORT=3000 npm run web
```

## トラブルシューティング

### カメラが動作しない場合

1. HTTPS接続を確認（一部のブラウザではHTTPSが必要）
2. カメラアクセス許可を確認
3. ブラウザの設定でカメラを有効化

### 接続ができない場合

1. ファイアウォール設定を確認
2. ポート8080が開放されているか確認
3. 同じネットワークに接続されているか確認

### 人検出が動作しない場合

1. TensorFlow.jsの読み込みを確認
2. ブラウザのコンソールでエラーを確認
3. インターネット接続を確認（モデルダウンロードのため）

## 開発

### 開発モードでの起動

```bash
# サーバーの開発モード
npm run web-dev

# クライアントの開発モード
npm run dev-client
```

### ファイル構成

```
echomirror/
├── server/
│   └── index.js          # サーバーサイド
├── renderer/
│   ├── index.html        # メインHTML
│   ├── renderer.js       # メインJavaScript
│   ├── face-detection.js # 人検出機能
│   └── styles.css        # スタイルシート
├── main.js               # Electronメインプロセス
└── package.json
```

## ライセンス

MIT License