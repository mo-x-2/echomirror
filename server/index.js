const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // 本番環境では適切なドメインに制限することを推奨
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: "*", // 本番環境では適切なドメインに制限することを推奨
  credentials: true
}));
app.use(express.json());

// 接続中のクライアントを管理
const connectedClients = new Map();
let connectionCount = 0;

io.on('connection', (socket) => {
  console.log(`クライアントが接続しました: ${socket.id} (${socket.handshake.address})`);
  
  // クライアント情報を保存
  connectedClients.set(socket.id, {
    id: socket.id,
    isLooking: false,
    connectedAt: new Date(),
    ip: socket.handshake.address
  });

  connectionCount++;
  
  // 全クライアントに接続数を通知
  io.emit('clientCount', connectionCount);
  
  // 他のクライアントに新しいピアの接続を通知
  socket.broadcast.emit('peerConnected', {
    peerId: socket.id
  });
  console.log(`ピア接続通知を送信: ${socket.id}`);

  // 視線状態の更新
  socket.on('updateLookingState', (data) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.isLooking = data.isLooking;
      console.log(`クライアント ${socket.id} の人検出状態: ${data.isLooking}`);
      
      // 他のクライアントに視線状態を送信
      socket.broadcast.emit('peerLookingState', {
        peerId: socket.id,
        isLooking: data.isLooking
      });
    }
  });

  // WebRTCシグナリング
  socket.on('offer', (data) => {
    console.log(`Offer from ${socket.id} to all peers`);
    socket.broadcast.emit('offer', {
      from: socket.id,
      offer: data.offer
    });
  });

  socket.on('answer', (data) => {
    console.log(`Answer from ${socket.id} to all peers`);
    socket.broadcast.emit('answer', {
      from: socket.id,
      answer: data.answer
    });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`ICE candidate from ${socket.id} to all peers`);
    socket.broadcast.emit('ice-candidate', {
      from: socket.id,
      candidate: data.candidate
    });
  });

  // 切断処理
  socket.on('disconnect', () => {
    console.log(`クライアントが切断されました: ${socket.id}`);
    connectedClients.delete(socket.id);
    connectionCount--;
    
    // 他のクライアントに切断を通知
    socket.broadcast.emit('peerDisconnected', {
      peerId: socket.id
    });
    
    // 全クライアントに接続数を通知
    io.emit('clientCount', connectionCount);
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connections: connectionCount
  });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'EchoMirror Server',
    version: '1.0.0',
    connections: connectionCount,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`サーバーが起動しました`);
  console.log(`ホスト: ${HOST}`);
  console.log(`ポート: ${PORT}`);
  console.log(`ローカル接続URL: http://localhost:${PORT}`);
  console.log(`ネットワーク接続URL: http://${getLocalIP()}:${PORT}`);
  console.log('WebRTCシグナリングサーバーとして動作中...');
  console.log('詳細なログが有効になっています...');
});

// ローカルIPアドレスを取得する関数
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // IPv4で、ループバックでないアドレスを取得
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// エラーハンドリング
server.on('error', (error) => {
  console.error('サーバーエラー:', error);
});

process.on('SIGINT', () => {
  console.log('\nサーバーを停止中...');
  server.close(() => {
    console.log('サーバーが停止しました');
    process.exit(0);
  });
}); 