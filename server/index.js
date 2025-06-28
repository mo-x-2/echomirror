const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // 本番環境では適切なドメインを指定
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

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
        clients: io.engine.clientsCount
    });
});

// ルートエンドポイント
app.get('/', (req, res) => {
    res.json({ 
        message: 'EchoMirror Server is running',
        version: '1.0.0',
        clients: io.engine.clientsCount
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
        
        // 他のクライアントに切断を通知
        socket.broadcast.emit('peerDisconnected', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`EchoMirror サーバーがポート ${PORT} で起動しました`);
    console.log(`ヘルスチェック: http://localhost:${PORT}/health`);
    console.log(`サーバー情報: http://localhost:${PORT}/`);
}); 