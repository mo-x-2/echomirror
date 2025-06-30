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

// Twilio TURN認証情報はwindow.twilioConfigからのみ取得
// .envや環境変数はmain.jsでwindow.twilioConfigに渡される
// ここではグローバル変数やハードコーディングはしない

document.addEventListener('DOMContentLoaded', () => {
  // window.twilioConfigを参照する
  const TWILIO_USERNAME = window.twilioConfig?.username;
  const TWILIO_PASSWORD = window.twilioConfig?.password;

  // 以降、rtcConfigurationや初期化処理もこの中で行う
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Twilio TURNサーバー（NAT越えのため）
      {
        urls: 'turn:global.turn.twilio.com:3478?transport=udp',
        username: TWILIO_USERNAME,
        credential: TWILIO_PASSWORD
      },
      {
        urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
        username: TWILIO_USERNAME,
        credential: TWILIO_PASSWORD
      },
      {
        urls: 'turn:global.turn.twilio.com:443?transport=tcp',
        username: TWILIO_USERNAME,
        credential: TWILIO_PASSWORD
      },
      {
        urls: 'turn:global.turn.twilio.com:443',
        username: TWILIO_USERNAME,
        credential: TWILIO_PASSWORD
      }
    ]
  };

  // ここでinitialize()などを呼ぶ
  initialize(rtcConfiguration);
});

// 初期化
async function initialize(rtcConfiguration) {
    setupEventListeners();
    await initializeLocalVideo();
    updateDebugInfo();
    updateStatus(`接続先: ${SERVER_URL}`);
    
    // Twilio TURN認証情報の確認
    console.log('[DEBUG] Twilio TURN設定確認:');
    console.log('[DEBUG] - Username:', TWILIO_USERNAME);
    console.log('[DEBUG] - Password:', TWILIO_PASSWORD ? '***設定済み***' : '***未設定***');
    console.log('[DEBUG] - TURN有効:', TWILIO_USERNAME !== 'YOUR_TWILIO_USERNAME');
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
        faceDetectionManager.stopDetection();
        isDetectionActive = false;
        detectionToggleBtn.textContent = '人検出: 開始';
        detectionToggleBtn.classList.remove('active');
        lookingStatus.textContent = '人検出状態: 停止中';
        console.log('[DEBUG] 人検出停止: localLookingState=false');
        updateLookingState(false);
    } else {
        await faceDetectionManager.startDetection();
        isDetectionActive = true;
        detectionToggleBtn.textContent = '人検出: 停止';
        detectionToggleBtn.classList.add('active');
        lookingStatus.textContent = '人検出状態: 検出中';
        console.log('[DEBUG] 人検出開始: localLookingState=true');
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
    if (socket && isConnected) {
        console.log(`[DEBUG] サーバーにpersonDetected送信: ${isPersonDetected}`);
        socket.emit('personDetected', isPersonDetected);
    }
    console.log(`[DEBUG] updateLookingState: localLookingState=${localLookingState}, peerLookingState=${peerLookingState}, hasRemoteStream=${hasRemoteStream}`);
    updateRemoteVideoVisibility();
    updateDebugInfo();
}

// 相手の映像表示制御
function updateRemoteVideoVisibility() {
    const shouldShow = localLookingState && peerLookingState && hasRemoteStream && peerConnection && peerConnection.connectionState === 'connected';
    console.log(`[DEBUG] updateRemoteVideoVisibility: shouldShow=${shouldShow}, localLookingState=${localLookingState}, peerLookingState=${peerLookingState}, hasRemoteStream=${hasRemoteStream}, peerConnectionState=${peerConnection ? peerConnection.connectionState : 'none'}`);
    if (shouldShow) {
        showRemoteVideo();
    } else {
        hideRemoteVideo();
    }
}

// 相手の映像を表示
function showRemoteVideo() {
    if (remotePlaceholder.classList.contains('hidden')) return;
    console.log('[DEBUG] showRemoteVideo: 映像表示');
    remotePlaceholder.classList.add('fade-out');
    setTimeout(() => {
        remotePlaceholder.classList.add('hidden');
        remoteVideo.classList.add('fade-in');
    }, 300);
}

// 相手の映像を非表示
function hideRemoteVideo() {
    if (!remotePlaceholder.classList.contains('hidden')) return;
    console.log('[DEBUG] hideRemoteVideo: 映像非表示');
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
        // clientCountではWebRTC接続を開始しない
    });
    
    socket.on('peerPersonDetected', (data) => {
        console.log(`[DEBUG] peerPersonDetected受信:`, data);
        peerLookingState = data.isDetected;
        updateRemoteVideoVisibility();
        updateDebugInfo();
    });
    
    socket.on('peerLookingState', (data) => {
        console.log(`[DEBUG] peerLookingState受信:`, data);
        peerLookingState = data.isLooking;
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

    // サーバーからinitiatorIdを受信してisInitiatorをセット
    socket.on('initiatorId', (id) => {
        isInitiator = (socket.id === id);
        console.log('[DEBUG] initiatorId受信:', id, '自分のID:', socket.id, 'isInitiator:', isInitiator);
        // initiatorIdを受信したタイミングでWebRTC接続を開始
        startWebRTCConnection();
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
    console.log('[DEBUG] startWebRTCConnection呼び出し');
    if (!localStream) {
        console.error('[DEBUG] ローカルストリームがありません');
        return;
    }
    if (peerConnection) {
        console.log('[DEBUG] 既にWebRTC接続が存在します');
        return;
    }
    console.log('[DEBUG] WebRTC接続を開始します...');
    connectionAttempts++;
    console.log('[DEBUG] 接続試行回数:', connectionAttempts);
    createPeerConnection();
    if (isInitiator) {
        console.log('[DEBUG] InitiatorとしてOfferを作成します');
        setTimeout(() => {
            createOffer();
        }, 500);
    } else {
        console.log('[DEBUG] Responderとして待機中...');
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
    updateRemoteVideoVisibility();
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
    console.log('[DEBUG] PeerConnectionを作成中...');
    peerConnection = new RTCPeerConnection(rtcConfiguration);
    if (localStream) {
        console.log('[DEBUG] ローカルストリームをPeerConnectionに追加');
        localStream.getTracks().forEach(track => {
            console.log('[DEBUG] トラックを追加:', track.kind);
            peerConnection.addTrack(track, localStream);
        });
    } else {
        console.warn('[DEBUG] localStreamが存在しません');
    }
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            console.log('[DEBUG] ICE候補を送信:', event.candidate);
            // ICE候補の詳細情報をログ出力
            if (event.candidate.candidate) {
                const candidateStr = event.candidate.candidate;
                if (candidateStr.includes('relay')) {
                    console.log('[DEBUG] TURNサーバー経由のICE候補:', candidateStr);
                    // TURNサーバーの詳細をログ出力
                    const relayMatch = candidateStr.match(/relay\s+([^\s]+)/);
                    if (relayMatch) {
                        console.log('[DEBUG] 使用中のTURNサーバー:', relayMatch[1]);
                    }
                } else if (candidateStr.includes('srflx')) {
                    console.log('[DEBUG] STUNサーバー経由のICE候補:', candidateStr);
                } else {
                    console.log('[DEBUG] ローカルICE候補:', candidateStr);
                }
            }
            socket.emit('ice-candidate', { candidate: event.candidate });
        }
    };
    peerConnection.ontrack = (event) => {
        console.log('[DEBUG] ontrack: リモートストリームを受信', event.streams);
        remoteVideo.srcObject = event.streams[0];
        hasRemoteStream = true;
        updateRemoteVideoVisibility();
        updateDebugInfo();
    };
    peerConnection.onconnectionstatechange = () => {
        console.log('[DEBUG] WebRTC接続状態:', peerConnection.connectionState);
        updateWebRTCStatus(peerConnection.connectionState);
        updateDebugInfo();
    };
    peerConnection.oniceconnectionstatechange = () => {
        console.log('[DEBUG] ICE接続状態:', peerConnection.iceConnectionState);
        // ICE接続状態の詳細ログ
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('[DEBUG] ICE接続失敗: TURNサーバーが必要な可能性があります');
        }
    };
    peerConnection.onicegatheringstatechange = () => {
        console.log('[DEBUG] ICE収集状態:', peerConnection.iceGatheringState);
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
        console.log('[DEBUG] Offerを作成中...');
        const offer = await peerConnection.createOffer();
        console.log('[DEBUG] Offer作成完了:', offer);
        await peerConnection.setLocalDescription(offer);
        console.log('[DEBUG] ローカルDescription設定完了:', peerConnection.localDescription);
        socket.emit('offer', { offer });
        console.log('[DEBUG] Offerを送信しました:', offer);
    } catch (error) {
        console.error('[DEBUG] Offer作成エラー:', error);
    }
}

// Offerの処理
async function handleOffer(data) {
    console.log('[DEBUG] Offerを受信:', data);
    if (!peerConnection) {
        console.log('[DEBUG] 新しいPeerConnectionを作成');
        createPeerConnection();
    }
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('[DEBUG] リモートDescription設定完了:', peerConnection.remoteDescription);
        const answer = await peerConnection.createAnswer();
        console.log('[DEBUG] Answer作成完了:', answer);
        await peerConnection.setLocalDescription(answer);
        console.log('[DEBUG] ローカルDescription設定完了:', peerConnection.localDescription);
        socket.emit('answer', { answer });
        console.log('[DEBUG] Answerを送信しました:', answer);
    } catch (error) {
        console.error('[DEBUG] Offer処理エラー:', error);
    }
}

// Answerの処理
async function handleAnswer(data) {
    console.log('[DEBUG] Answerを受信:', data);
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('[DEBUG] リモートDescription設定完了:', peerConnection.remoteDescription);
        } catch (error) {
            console.error('[DEBUG] Answer処理エラー:', error);
        }
    } else {
        console.error('[DEBUG] PeerConnectionがありません');
    }
}

// ICE候補の処理
async function handleIceCandidate(data) {
    console.log('[DEBUG] ICE候補を受信:', data);
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('[DEBUG] ICE候補追加完了:', data.candidate);
        } catch (error) {
            console.error('[DEBUG] ICE候補処理エラー:', error);
        }
    } else {
        console.error('[DEBUG] PeerConnectionがありません');
    }
}

// ピア接続の処理
function handlePeerConnected(data) {
    console.log('新しいピアが接続されました:', data.peerId);
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