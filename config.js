// EchoMirror 設定ファイル
// 環境に応じて設定を変更してください

module.exports = {
    // Twilio TURN認証情報
    twilio: {
        username: process.env.TWILIO_USERNAME || 'AC9ba2f55255eea783f6292e0091ff890b',
        password: process.env.TWILIO_PASSWORD || '3bf730da8aa4d94367b5c11402337db6',
        enabled: process.env.TWILIO_ENABLED === 'true' || false
    },
    
    // ローカル開発環境（同一PC内でのテスト）
    local: {
        serverUrl: 'http://localhost:3000',
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        autoDiscovery: false // ローカルでは自動発見を無効
    },
    
    // ローカルネットワーク環境（同一ネットワーク内の異なるPC）
    localNetwork: {
        serverUrl: 'http://192.168.10.12:3000', // 手動設定（自動発見が失敗した場合のフォールバック）
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ],
        autoDiscovery: true, // 自動サーバー発見を有効
        discoveryTimeout: 5000 // 発見タイムアウト（ミリ秒）
    },
    
    // クラウド環境（インターネット経由）
    cloud: {
        serverUrl: 'https://your-server-domain.com:3000', // 実際のサーバーURLに変更
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        autoDiscovery: false // クラウドでは自動発見を無効
    },
    
    // 開発環境設定
    development: {
        serverUrl: 'http://192.168.10.12:3000', // ローカルネットワーク用
        autoDiscover: true,
        discoveryTimeout: 5000
    },
    
    // 本番環境設定
    production: {
 // Railwayデプロイ後のURL
        autoDiscover: false, // 本番環境では自動発見を無効
        discoveryTimeout: 3000
    },
    
    // 現在の環境
    current: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    
    // デバッグ設定
    debug: {
        enabled: true,
        logLevel: 'info', // 'error', 'warn', 'info', 'debug'
        showConnectionDetails: true
    },
    
    // WebRTC設定
    webrtc: {
        maxRetries: 3,
        connectionTimeout: 10000,
        iceTimeout: 5000
    },
    
    // 設定取得メソッド
    getServerUrl: function() {
        return this[this.current].serverUrl;
    },
    
    getAutoDiscover: function() {
        return this[this.current].autoDiscover;
    },
    
    getDiscoveryTimeout: function() {
        return this[this.current].discoveryTimeout;
    }
}; 