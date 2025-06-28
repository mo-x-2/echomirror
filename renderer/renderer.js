// DOM要素の取得
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remotePlaceholder = document.getElementById('remote-placeholder');
const statusText = document.getElementById('status-text');
const clientCount = document.getElementById('client-count');
const webrtcStatus = document.getElementById('webrtc-status');
const lookingStatus = document.getElementById('looking-status');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const testBtn = document.getElementById('test-btn');
const detectionToggleBtn = document.getElementById('detection-toggle');

// デバッグ要素
const debugConnection = document.getElementById('debug-connection');
const debugWebRTC = document.getElementById('debug-webrtc');
const debugLocalDetection = document.getElementById('debug-local-detection');
const debugPeerDetection = document.getElementById('debug-peer-detection');
const debugConfidence = document.getElementById('debug-confidence');

// グローバル変数
let socket = null;
let localStream = null;
let peerConnection = null;
let isConnected = false;
let peerLookingState = false;
let localLookingState = false;
let isInitiator = false;
let hasRemoteStream = false;
let connectionAttempts = 0;
let connectedPeers = new Set();
let faceDetectionManager = null;
let isDetectionActive = false;
let discoveredServers = [];

// 設定
// サーバーURLを直接指定
let SERVER_URL = 'https://echomirror-production.up.railway.app';
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};

// 初期化
async function initialize() {
    setupEventListeners();
    await initializeLocalVideo();
    updateDebugInfo();
    updateStatus(`接続先: ${SERVER_URL}`);
}

// イベントリスナーの設定
function setupEventListeners() {
    connectBtn.addEventListener('click', connectToServer);
    disconnectBtn.addEventListener('click', disconnectFromServer);
    testBtn.addEventListener('click', openSecondWindow);
    detectionToggleBtn.addEventListener('click', toggleDetection);
}

// ローカルビデオの初期化
async function initializeLocalVideo() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        
        localVideo.srcObject = localStream;
        updateStatus('カメラが初期化されました');
        
        // 人検出の初期化
        await initializeFaceDetection();
        
    } catch (error) {
        console.error('カメラの初期化に失敗しました:', error);
        updateStatus('カメラの初期化に失敗しました');
    }
}

// 人検出の初期化
async function initializeFaceDetection() {
    try {
        console.log('人検出機能を初期化中...');
        
        // FaceDetectionManagerの初期化
        faceDetectionManager = new window.FaceDetectionManager();
        
        const success = await faceDetectionManager.initialize(
            localVideo,
            (isPersonDetected) => {
                updateLookingState(isPersonDetected);
            }
        );
        
        if (success) {
            updateStatus('人検出機能が初期化されました');
            detectionToggleBtn.disabled = false;
            lookingStatus.textContent = '人検出状態: 準備完了';
        } else {
            updateStatus('人検出機能の初期化に失敗しました');
            lookingStatus.textContent = '人検出状態: エラー';
        }
        
    } catch (error) {
        console.error('人検出の初期化に失敗しました:', error);
        updateStatus('人検出の初期化に失敗しました');
        lookingStatus.textContent = '人検出状態: エラー';
    }
}

// 人検出の開始/停止
async function toggleDetection() {
    if (!faceDetectionManager) return;
    
    if (isDetectionActive) {
        // 検出停止
        faceDetectionManager.stopDetection();
        isDetectionActive = false;
        detectionToggleBtn.textContent = '人検出: 開始';
        detectionToggleBtn.classList.remove('active');
        lookingStatus.textContent = '人検出状態: 停止中';
        updateLookingState(false);
    } else {
        // 検出開始
        await faceDetectionManager.startDetection();
        isDetectionActive = true;
        detectionToggleBtn.textContent = '人検出: 停止';
        detectionToggleBtn.classList.add('active');
        lookingStatus.textContent = '人検出状態: 検出中';
    }
}

// 視線状態の更新（人検出結果）
function updateLookingState(isPersonDetected) {
    localLookingState = isPersonDetected;
    
    const statusText = isPersonDetected ? '人を検出中' : '人を検出していません';
    const statusColor = isPersonDetected ? '#c6f6d5' : '#fed7d7';
    const textColor = isPersonDetected ? '#22543d' : '#742a2a';
    
    lookingStatus.textContent = `人検出状態: ${statusText}`;
    lookingStatus.style.background = statusColor;
    lookingStatus.style.color = textColor;
    
    // サーバーに視線状態を送信
    if (socket && isConnected) {
        socket.emit('updateLookingState', { isLooking: isPersonDetected });
    }
    
    // 相手の映像表示制御
    updateRemoteVideoVisibility();
    updateDebugInfo();
}

// 相手の映像表示制御
function updateRemoteVideoVisibility() {
    const shouldShow = localLookingState && peerLookingState && hasRemoteStream;
    
    if (shouldShow) {
        showRemoteVideo();
    } else {
        hideRemoteVideo();
    }
}

// 相手の映像を表示
function showRemoteVideo() {
    if (remotePlaceholder.classList.contains('hidden')) return;
    
    remotePlaceholder.classList.add('fade-out');
    setTimeout(() => {
        remotePlaceholder.classList.add('hidden');
        remoteVideo.classList.add('fade-in');
    }, 300);
}

// 相手の映像を非表示
function hideRemoteVideo() {
    if (!remotePlaceholder.classList.contains('hidden')) return;
    
    remoteVideo.classList.remove('fade-in');
    remotePlaceholder.classList.remove('hidden', 'fade-out');
}

// サーバーへの接続
async function connectToServer() {
    if (socket) return;
    updateStatus(`サーバーに接続中... (${SERVER_URL})`);
    socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
    });
    
    socket.on('connect', () => {
        isConnected = true;
        updateStatus('サーバーに接続されました');
        updateButtons(true);
        console.log('サーバーに接続されました:', socket.id);
        
        updateDebugInfo();
    });
    
    socket.on('disconnect', () => {
        isConnected = false;
        updateStatus('サーバーから切断されました');
        updateButtons(false);
        console.log('サーバーから切断されました');
        resetWebRTCConnection();
        updateDebugInfo();
    });
    
    socket.on('clientCount', (count) => {
        clientCount.textContent = `接続数: ${count}`;
        console.log(`接続中のクライアント数: ${count}`);
        
        // 2人以上接続したらWebRTC接続を開始
        if (count >= 2) {
            console.log('2人以上接続しました。WebRTC接続を開始します...');
            setTimeout(() => {
                startWebRTCConnection();
            }, 1000); // 少し遅延を入れて確実に接続
        }
    });
    
    socket.on('peerLookingState', (data) => {
        peerLookingState = data.isLooking;
        console.log(`相手の人検出状態: ${data.isLooking}`);
        updateRemoteVideoVisibility();
        updateDebugInfo();
    });
    
    // WebRTCシグナリング
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('peerDisconnected', handlePeerDisconnected);
    socket.on('peerConnected', handlePeerConnected);
    
    socket.on('connect_error', (error) => {
        console.error('接続エラー:', error);
        updateStatus(`接続エラー: ${error.message}`);
    });
    
    socket.on('connect_timeout', () => {
        console.error('接続タイムアウト');
        updateStatus('接続タイムアウトが発生しました');
    });
}

// サーバーからの切断
function disconnectFromServer() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    resetWebRTCConnection();
    isConnected = false;
    updateStatus('切断されました');
    updateButtons(false);
    hideRemoteVideo();
    updateDebugInfo();
}

// WebRTC接続の開始
function startWebRTCConnection() {
    if (!localStream) {
        console.error('ローカルストリームがありません');
        return;
    }
    
    if (peerConnection) {
        console.log('既にWebRTC接続が存在します');
        return;
    }
    
    console.log('WebRTC接続を開始します...');
    connectionAttempts++;
    console.log(`接続試行回数: ${connectionAttempts}`);
    
    createPeerConnection();
    
    // 最初に接続したクライアントがinitiatorになる
    if (isInitiator) {
        console.log('InitiatorとしてOfferを作成します');
        setTimeout(() => {
            createOffer();
        }, 500);
    } else {
        console.log('Responderとして待機中...');
    }
}

// WebRTC接続のリセット
function resetWebRTCConnection() {
    if (peerConnection) {
        console.log('WebRTC接続をリセットします');
        peerConnection.close();
        peerConnection = null;
    }
    hasRemoteStream = false;
    isInitiator = false;
    connectionAttempts = 0;
    connectedPeers.clear();
    remoteVideo.srcObject = null;
    hideRemoteVideo();
    updateWebRTCStatus('未接続');
    updateDebugInfo();
}

// ボタンの状態更新
function updateButtons(connected) {
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
}

// ステータスの更新
function updateStatus(message) {
    statusText.textContent = message;
    console.log(message);
}

// WebRTC状態の更新
function updateWebRTCStatus(status) {
    webrtcStatus.textContent = `WebRTC: ${status}`;
    if (status === 'connected') {
        webrtcStatus.classList.add('connected');
    } else {
        webrtcStatus.classList.remove('connected');
    }
}

// デバッグ情報の更新
function updateDebugInfo() {
    debugConnection.textContent = isConnected ? '接続済み' : '未接続';
    debugWebRTC.textContent = peerConnection ? peerConnection.connectionState : '未接続';
    debugLocalDetection.textContent = localLookingState ? '検出中' : '未検出';
    debugPeerDetection.textContent = peerLookingState ? '検出中' : '未検出';
    debugConfidence.textContent = isDetectionActive ? 'アクティブ' : '非アクティブ';
}

// 2つ目のウィンドウを開く（テスト用）
function openSecondWindow() {
    const { shell } = require('electron');
    shell.openExternal(SERVER_URL);
}

// WebRTC関連の処理
function createPeerConnection() {
    console.log('PeerConnectionを作成中...');
    peerConnection = new RTCPeerConnection(rtcConfiguration);
    
    // ローカルストリームを追加
    if (localStream) {
        console.log('ローカルストリームをPeerConnectionに追加');
        localStream.getTracks().forEach(track => {
            console.log(`トラックを追加: ${track.kind}`);
            peerConnection.addTrack(track, localStream);
        });
    }
    
    // ICE候補の処理
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            console.log('ICE候補を送信:', event.candidate.type);
            socket.emit('ice-candidate', { candidate: event.candidate });
        }
    };
    
    // リモートストリームの処理
    peerConnection.ontrack = (event) => {
        console.log('リモートストリームを受信しました');
        console.log('ストリーム数:', event.streams.length);
        remoteVideo.srcObject = event.streams[0];
        hasRemoteStream = true;
        updateRemoteVideoVisibility();
        updateDebugInfo();
    };
    
    // 接続状態の監視
    peerConnection.onconnectionstatechange = () => {
        console.log('WebRTC接続状態:', peerConnection.connectionState);
        updateWebRTCStatus(peerConnection.connectionState);
        updateDebugInfo();
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE接続状態:', peerConnection.iceConnectionState);
    };
    
    peerConnection.onicegatheringstatechange = () => {
        console.log('ICE収集状態:', peerConnection.iceGatheringState);
    };
    
    return peerConnection;
}

// Offerの作成
async function createOffer() {
    if (!peerConnection) {
        console.error('PeerConnectionがありません');
        return;
    }
    
    try {
        console.log('Offerを作成中...');
        const offer = await peerConnection.createOffer();
        console.log('Offer作成完了:', offer.type);
        await peerConnection.setLocalDescription(offer);
        console.log('ローカルDescription設定完了');
        
        socket.emit('offer', { offer });
        console.log('Offerを送信しました');
    } catch (error) {
        console.error('Offer作成エラー:', error);
    }
}

// Offerの処理
async function handleOffer(data) {
    console.log('Offerを受信しました:', data.from);
    
    if (!peerConnection) {
        console.log('新しいPeerConnectionを作成');
        createPeerConnection();
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('リモートDescription設定完了');
        
        const answer = await peerConnection.createAnswer();
        console.log('Answer作成完了:', answer.type);
        await peerConnection.setLocalDescription(answer);
        console.log('ローカルDescription設定完了');
        
        socket.emit('answer', { answer });
        console.log('Answerを送信しました');
    } catch (error) {
        console.error('Offer処理エラー:', error);
    }
}

// Answerの処理
async function handleAnswer(data) {
    console.log('Answerを受信しました:', data.from);
    
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('リモートDescription設定完了');
        } catch (error) {
            console.error('Answer処理エラー:', error);
        }
    } else {
        console.error('PeerConnectionがありません');
    }
}

// ICE候補の処理
async function handleIceCandidate(data) {
    console.log('ICE候補を受信:', data.from);
    
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('ICE候補追加完了');
        } catch (error) {
            console.error('ICE候補処理エラー:', error);
        }
    } else {
        console.error('PeerConnectionがありません');
    }
}

// ピア接続の処理
function handlePeerConnected(data) {
    console.log('新しいピアが接続されました:', data.peerId);
    connectedPeers.add(data.peerId);
    
    // 最初に接続したクライアントがinitiatorになる
    if (connectedPeers.size === 1) {
        isInitiator = true;
        console.log('最初のピアとしてInitiatorに設定');
    }
    
    updateDebugInfo();
}

// ピア切断の処理
function handlePeerDisconnected(data) {
    console.log('ピアが切断されました:', data.peerId);
    connectedPeers.delete(data.peerId);
    resetWebRTCConnection();
}

// クリーンアップ
function cleanup() {
    if (faceDetectionManager) {
        faceDetectionManager.cleanup();
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', initialize);

// アプリケーション終了時のクリーンアップ
window.addEventListener('beforeunload', cleanup); 