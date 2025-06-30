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

- **クライアント**: Electron + TensorFlow.js (BlazeFace)
- **サーバー**: Node.js + Socket.IO
- **映像通信**: WebRTC
- **人検出**: TensorFlow.js (BlazeFace)

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

### Tailscale（仮想LAN）環境での利用（推奨）

#### 前提
- 両方のPCに[Tailscale](https://tailscale.com/)をインストールし、同じTailnetに参加していること
- それぞれのPCにTailscaleのIPアドレス（例: 100.x.x.x）が割り当てられていること

#### サーバーPC側
```bash
# サーバーを起動（デフォルト: 8080ポート）
npm run server
```

#### クライアントPC側
1. `renderer/renderer.js` の `SERVER_URL` をサーバーPCのTailscale IPアドレス＋ポート番号（例: `http://100.81.210.75:8080`）に書き換える
2. アプリケーションを起動
```bash
npm run client
```

#### ポイント
- Tailscaleを使うことで、異なるWi-Fiやネットワーク環境でも安定して通信可能
- サーバーのポート番号（デフォルト: 8080）に注意
- サーバーPCのファイアウォールで8080ポートが開いていることを確認

### その他の環境（参考）

#### ローカル環境（同一PCでのテスト）
```bash
# サーバーを起動
npm run server

# 1つ目のクライアントを起動
npm run client

# 2つ目のクライアントを起動（別のターミナルで）
npm run client
```

#### クラウド環境（Railway等）
- サーバーをクラウドにデプロイし、`SERVER_URL`をクラウドのURLに設定
- ただし、NATやファイアウォールの制限により、WebRTC接続が不安定になる場合がある

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

### サーバーが外部公開できない場合

- `server.listen(PORT, '0.0.0.0', ...)` でバインドしているか確認
- `.railwayignore`で必要なファイルを除外しすぎていないか確認
- RailwayのDeploy Logs/Healthcheckを確認

### WebRTC接続ができない・映像が表示されない場合

- サーバー・クライアント間のInitiator判定やシグナリング開始タイミングに問題がある可能性
- サーバーから`initiatorId`が正しくemitされているか、クライアントで受信できているか確認
- 両方のクライアントで`isInitiator`が正しくセットされているか、DEBUGログで確認
- Offer/Answer/ICE Candidateの送受信ログが出ているか確認
- **NATや企業ネットワーク環境ではWebRTCがブロックされる場合があるため、Tailscaleの使用を推奨**

### 人検出が動作しない場合

- カメラの権限が許可されているか確認
- 照明条件が十分か確認

## 開発フェーズ・進捗

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

### フェーズ6: サーバー外部公開・クラウド対応 ✅
- [x] Railwayでのサーバーデプロイ・外部公開
- [x] ヘルスチェック・CORS対応

### フェーズ7: WebRTC安定化・Tailscale導入 ✅
- [x] WebRTC接続の安定化
- [x] Tailscaleによる仮想LAN構築
- [x] 異なるネットワーク間での安定通信実現

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