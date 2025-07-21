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

// 新しい画面表示要素
const blackScreen = document.getElementById('black-screen');
const fullscreenRemote = document.getElementById('fullscreen-remote');
const fullscreenRemoteVideo = document.getElementById('fullscreen-remote-video');
const normalUI = document.getElementById('normal-ui');

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
// サーバーURLを動的に設定（HTTPS対応）
let SERVER_URL;
if (window.location.protocol === 'https:') {
    // 現在のページがHTTPSの場合はHTTPSで接続
    SERVER_URL = 'https://100.81.210.75:8080';
} else {
    // HTTPの場合はHTTPで接続（カメラアクセスに制限がある可能性）
    SERVER_URL = 'http://100.81.210.75:8080';
}

// 開発環境では現在のホストを使用
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    SERVER_URL = window.location.origin;
}

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
    
    // 初期表示状態を設定
    showBlackScreen();
    
    // カメラが正常に初期化された場合、自動でサーバーに接続
    if (localStream) {
        console.log('カメラ初期化完了 - 自動でサーバーに接続します');
        await connectToServer();
    }
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
        // カメラアクセス許可の確認
        console.log('カメラアクセスを要求中...');
        
        // より詳細なカメラ設定
        const constraints = {
            video: {
                width: { ideal: 640, min: 320, max: 1280 },
                height: { ideal: 480, min: 240, max: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30, min: 15, max: 60 }
            },
            audio: false
        };
        
        // 利用可能なデバイスを確認
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('利用可能なビデオデバイス:', videoDevices);
        
        if (videoDevices.length === 0) {
            throw new Error('利用可能なカメラが見つかりません');
        }
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        localVideo.srcObject = localStream;
        updateStatus('カメラが初期化されました');
        
        // 人検出の初期化
        await initializeFaceDetection();
        
    } catch (error) {
        console.error('カメラの初期化に失敗しました:', error);
        
        // エラーの種類に応じたメッセージ
        let errorMessage = 'カメラの初期化に失敗しました';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'カメラアクセスが拒否されました。ブラウザの設定でカメラを許可してください。';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'カメラが見つかりません。カメラが接続されているか確認してください。';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'カメラが他のアプリケーションで使用中です。';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = '要求されたカメラ設定が利用できません。';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'セキュリティ上の理由でカメラにアクセスできません。HTTPS接続を確認してください。';
        }
        
        updateStatus(errorMessage);
        
        // カメラアクセス許可ボタンを表示
        showCameraPermissionButton();
    }
}

// カメラアクセス許可ボタンの表示
function showCameraPermissionButton() {
    const permissionDiv = document.createElement('div');
    permissionDiv.id = 'camera-permission';
    permissionDiv.innerHTML = `
        <div style="text-align: center; padding: 20px; background: #fed7d7; border-radius: 10px; margin: 10px 0;">
            <h3>カメラアクセスが必要です</h3>
            <p>EchoMirrorを使用するには、カメラへのアクセス許可が必要です。</p>
            <button onclick="requestCameraPermission()" style="padding: 10px 20px; background: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer;">
                カメラアクセスを許可
            </button>
            <p style="font-size: 0.9em; margin-top: 10px;">
                <strong>注意:</strong> SafariではHTTPS接続が必要な場合があります。
            </p>
        </div>
    `;
    
    // 既存のボタンを無効化
    connectBtn.disabled = true;
    detectionToggleBtn.disabled = true;
    
    // 許可ボタンを挿入
    const container = document.querySelector('.container');
    container.insertBefore(permissionDiv, container.firstChild);
}

// カメラアクセス許可の再要求
async function requestCameraPermission() {
    try {
        await initializeLocalVideo();
        
        // 成功したら許可ボタンを削除
        const permissionDiv = document.getElementById('camera-permission');
        if (permissionDiv) {
            permissionDiv.remove();
        }
        
        // ボタンを有効化
        connectBtn.disabled = false;
        
        // カメラアクセス許可後、自動でサーバーに接続
        if (localStream) {
            console.log('カメラアクセス許可 - 自動でサーバーに接続します');
            await connectToServer();
        }
        
    } catch (error) {
        console.error('カメラアクセス許可の再要求に失敗:', error);
        updateStatus('カメラアクセスの許可に失敗しました。ブラウザの設定を確認してください。');
    }
}

// グローバル関数として公開（HTMLから呼び出し可能）
window.requestCameraPermission = requestCameraPermission;

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
    
    // 新しい表示制御を適用
    updateDisplayMode();
    
    if (shouldShow) {
        showRemoteVideo();
    } else {
        hideRemoteVideo();
    }
}

// 画面表示モードの制御
function updateDisplayMode() {
    // 自分と相手の両方の人検出状態と映像の有無で表示を決定
    const isLocalDetected = localLookingState;
    const isPeerDetected = peerLookingState;
    const hasVideo = hasRemoteStream && peerConnection && peerConnection.connectionState === 'connected';
    
    console.log(`[DEBUG] updateDisplayMode: isLocalDetected=${isLocalDetected}, isPeerDetected=${isPeerDetected}, hasVideo=${hasVideo}`);
    
    if (isLocalDetected && isPeerDetected && hasVideo) {
        // 自分と相手の両方で人が検出されており、映像がある場合：全画面で相手の映像を表示
        showFullscreenRemoteVideo();
    } else {
        // 条件を満たしていない場合：黒い画面を表示
        showBlackScreen();
    }
}

// 全画面で相手の映像を表示
function showFullscreenRemoteVideo() {
    console.log('[DEBUG] showFullscreenRemoteVideo: 全画面リモート映像表示');
    
    // 相手の映像ストリームを全画面用ビデオ要素にも設定
    if (remoteVideo.srcObject) {
        fullscreenRemoteVideo.srcObject = remoteVideo.srcObject;
    }
    
    // 表示の切り替え
    blackScreen.style.display = 'none';
    fullscreenRemote.classList.remove('hidden');
    normalUI.style.display = 'none';
}

// 黒い画面を表示
function showBlackScreen() {
    console.log('[DEBUG] showBlackScreen: 黒い画面表示');
    
    // 表示の切り替え
    fullscreenRemote.classList.add('hidden');
    blackScreen.style.display = 'flex';
    normalUI.style.display = 'none';
}

// デバッグモードの切り替え（開発用）
function toggleDebugMode() {
    document.body.classList.toggle('debug-mode');
    const isDebugMode = document.body.classList.contains('debug-mode');
    console.log(`[DEBUG] デバッグモード: ${isDebugMode ? 'ON' : 'OFF'}`);
    
    if (isDebugMode) {
        normalUI.style.display = 'block';
    } else {
        updateDisplayMode();
    }
}

// キーボードショートカットでデバッグモードを切り替え（開発用）
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        toggleDebugMode();
    }
});

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
        
        // サーバー接続完了後、自動で人検出を開始
        if (faceDetectionManager && !isDetectionActive) {
            console.log('サーバー接続完了 - 自動で人検出を開始します');
            toggleDetection();
        }
        
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
    showBlackScreen(); // 切断時は黒い画面を表示
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
    fullscreenRemoteVideo.srcObject = null; // 全画面表示用もクリア
    hideRemoteVideo();
    showBlackScreen(); // リセット時は黒い画面を表示
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
    // ブラウザ環境では新しいタブで開く
    window.open(SERVER_URL, '_blank');
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
            socket.emit('ice-candidate', { candidate: event.candidate });
        }
    };
    peerConnection.ontrack = (event) => {
        console.log('[DEBUG] ontrack: リモートストリームを受信', event.streams);
        remoteVideo.srcObject = event.streams[0];
        fullscreenRemoteVideo.srcObject = event.streams[0]; // 全画面表示用にも設定
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