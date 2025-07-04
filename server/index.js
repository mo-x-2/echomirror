const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');

const app = express();

// HTTPS設定（開発用の自己署名証明書）
let server;
let isHttps = false;

try {
    // 自己署名証明書の生成（開発用）
    const { execSync } = require('child_process');
    const certPath = path.join(__dirname, 'cert');
    
    // 証明書ディレクトリが存在しない場合は作成
    if (!fs.existsSync(certPath)) {
        fs.mkdirSync(certPath);
    }
    
    // 証明書ファイルが存在しない場合は生成
    if (!fs.existsSync(path.join(certPath, 'key.pem'))) {
        console.log('自己署名証明書を生成中...');
        execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${path.join(certPath, 'key.pem')} -out ${path.join(certPath, 'cert.pem')} -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Tokyo/O=EchoMirror/CN=localhost"`, { stdio: 'inherit' });
    }
    
    const options = {
        key: fs.readFileSync(path.join(certPath, 'key.pem')),
        cert: fs.readFileSync(path.join(certPath, 'cert.pem'))
    };
    
    server = https.createServer(options, app);
    isHttps = true;
    console.log('HTTPSサーバーを起動します');
} catch (error) {
    console.log('HTTPS証明書の生成に失敗しました。HTTPサーバーを起動します:', error.message);
    server = http.createServer(app);
    isHttps = false;
}

const io = socketIo(server, {
    cors: {
        origin: "*", // 本番環境では適切なドメインを指定
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8080;

// 静的ファイルの配信設定
app.use(express.static(path.join(__dirname, '../renderer')));

// CORS設定
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        clients: io.engine.clientsCount,
        https: isHttps
    });
});

// ルートエンドポイント - HTMLファイルを配信
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../renderer/index.html'));
});

// APIエンドポイント
app.get('/api/status', (req, res) => {
    res.json({ 
        message: 'EchoMirror Server is running',
        version: '1.0.0',
        clients: io.engine.clientsCount,
        https: isHttps
    });
});

// Socket.IO接続管理
const connectedClients = new Map();

io.on('connection', (socket) => {
    console.log('クライアントが接続しました:', socket.id);
    connectedClients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        isLooking: false
    });

    // 接続中のクライアント数をブロードキャスト
    io.emit('clientCount', connectedClients.size);

    // initiatorIdは2人になったときだけemit
    if (connectedClients.size === 2) {
        const initiatorId = Array.from(connectedClients.keys())[0];
        io.emit('initiatorId', initiatorId);
    }

    // 人検出状態の更新
    socket.on('personDetected', (isDetected) => {
        const client = connectedClients.get(socket.id);
        if (client) {
            client.isLooking = isDetected;
            console.log(`クライアント ${socket.id} の人検出状態: ${isDetected ? '検出中' : '未検出'}`);
            
            // 他のクライアントに通知
            socket.broadcast.emit('peerPersonDetected', {
                clientId: socket.id,
                isDetected: isDetected
            });
        }
    });

    // WebRTCシグナリング
    socket.on('offer', (data) => {
        socket.broadcast.emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.broadcast.emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
        socket.broadcast.emit('ice-candidate', data);
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log('クライアントが切断されました:', socket.id);
        connectedClients.delete(socket.id);
        io.emit('clientCount', connectedClients.size);
        // クライアントが2人になった場合のみ再emit
        if (connectedClients.size === 2) {
            const initiatorId = Array.from(connectedClients.keys())[0];
            io.emit('initiatorId', initiatorId);
        }
        // 他のクライアントに切断を通知
        socket.broadcast.emit('peerDisconnected', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`EchoMirror サーバーがポート ${PORT} で起動しました`);
    console.log(`ヘルスチェック: http://localhost:${PORT}/health`);
    console.log(`サーバー情報: http://localhost:${PORT}/`);
}); 