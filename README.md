# EchoMirror

リアルタイム人検出によるビデオ通話アプリケーション

## 概要

EchoMirrorは、2台のPCで専用アプリケーションを起動し、両者がカメラに映った瞬間に、ネットワーク越しに相手のカメラ映像が自分の画面にフェードインして表示されるアプリケーションです。

## 機能

- **カメラ映像の取得**: 各PCに接続されたウェブカメラから映像ストリームを取得
- **人検出**: カメラ映像から、人が映っているかどうかを検出
- **リアルタイム同期**: 自分と相手の両方が「人を検出」した場合にのみ、相手の映像を表示
- **フェードイン/アウト**: 相手の映像は、表示・非表示が切り替わる際にフェードイン/アウトの演出
- **接続状態表示**: 接続状態をユーザーに通知するUI
- **マルチ環境対応**: ローカル、ローカルネットワーク、クラウド環境での動作

## 技術スタック

- **クライアント**: Electron
- **サーバー**: Node.js + Socket.IO
- **映像通信**: WebRTC
- **人検出**: 肌色検出アルゴリズム

## セットアップ

### 前提条件

- Node.js (v16以上)
- npm または yarn

### インストール

1. リポジトリをクローン
```bash
git clone <repository-url>
cd echomirror
```

2. 依存関係をインストール
```bash
npm install
```

## 使用方法

### 1. ローカル環境（同一PCでのテスト）

```bash
# サーバーを起動
npm run server

# 1つ目のクライアントを起動
npm run client

# 2つ目のクライアントを起動（別のターミナルで）
npm run client
```

### 2. ローカルネットワーク環境（同一LAN内の異なるPC）

#### サーバーPC側
```bash
# サーバーを起動
npm run server
```

サーバー起動時に表示されるネットワーク接続URLをメモしてください：
```
ネットワーク接続URL: http://192.168.1.100:3000
```

#### クライアントPC側
1. `config.js` の `localNetwork.serverUrl` をサーバーPCのIPアドレスに変更
2. アプリケーションを起動
```bash
npm run client
```

### 3. インターネット環境（異なるネットワーク）

#### サーバーのデプロイ

**Herokuでのデプロイ例：**

1. Herokuアカウントを作成
2. Heroku CLIをインストール
3. アプリケーションをデプロイ

```bash
# Herokuにログイン
heroku login

# アプリケーションを作成
heroku create your-echomirror-app

# デプロイ
git push heroku main

# アプリケーションを起動
heroku ps:scale web=1
```

4. デプロイされたURLを取得
```bash
heroku info
```

#### クライアント側の設定

環境変数でサーバーURLを設定：
```bash
# macOS/Linux
export SERVER_URL=https://your-echomirror-app.herokuapp.com
npm run client

# Windows
set SERVER_URL=https://your-echomirror-app.herokuapp.com
npm run client
```

または、`config.js` の `production.serverUrl` を更新。

## 設定

### 環境別設定

`config.js` ファイルで環境別の設定を管理：

- **development**: ローカル開発環境
- **localNetwork**: ローカルネットワーク環境
- **production**: 本番環境（クラウド）

### 環境変数

- `SERVER_URL`: サーバーのURL（環境変数で上書き可能）
- `NODE_ENV`: 実行環境（development/production）
- `PORT`: サーバーのポート番号（デフォルト: 3000）

## トラブルシューティング

### 接続できない場合

1. **ファイアウォールの設定**
   - ポート3000が開放されているか確認
   - ローカルネットワークの場合、ファイアウォールでポートを許可

2. **ネットワーク設定**
   - サーバーPCのIPアドレスが正しいか確認
   - 両PCが同じネットワークに接続されているか確認

3. **WebRTC接続の問題**
   - STUNサーバーが利用可能か確認
   - 企業ネットワークの場合、WebRTCがブロックされている可能性

### 人検出が動作しない場合

1. **カメラの権限**
   - カメラへのアクセスが許可されているか確認
   - ブラウザの設定でカメラを許可

2. **照明条件**
   - 十分な明るさがあるか確認
   - 逆光を避ける

## 開発フェーズ

### フェーズ1: 基盤構築 ✅
- [x] Electronアプリの雛形作成
- [x] Node.jsでSocket.IOサーバー構築
- [x] WebSocketによる接続テスト

### フェーズ2: 映像通信 ✅
- [x] WebRTC導入
- [x] ピアツーピアでカメラ映像送受信
- [x] アプリ起動と同時に映像表示

### フェーズ3: 人検出 ✅
- [x] 人検出機能実装
- [x] リアルタイム検出
- [x] 検出結果のコンソール出力

### フェーズ4: 同期ロジック ✅
- [x] Socket.IOで人検出状態送受信
- [x] 両者の状態一致時の映像表示制御

### フェーズ5: 演出 ✅
- [x] CSSアニメーションでフェードイン/アウト演出

## プロジェクト構造

```
echomirror/
├── main.js                 # Electronメインプロセス
├── package.json            # 依存関係とスクリプト
├── config.js               # 環境別設定
├── server/
│   └── index.js           # Socket.IOサーバー
├── renderer/
│   ├── index.html         # メインHTML
│   ├── styles.css         # スタイルシート
│   ├── renderer.js        # レンダラープロセス
│   └── face-detection.js  # 人検出機能
└── README.md              # このファイル
```

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。 