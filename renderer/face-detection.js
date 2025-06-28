// TensorFlow.js を使用した人検出機能
class FaceDetectionManager {
    constructor() {
        this.isDetecting = false;
        this.onPersonDetected = null;
        this.detectionInterval = null;
        this.lastDetectionTime = 0;
        this.detectionThreshold = 1000; // 1秒間検出されなかったら「見ていない」と判定
        this.canvas = null;
        this.ctx = null;
        this.videoElement = null;
    }

    // 初期化
    async initialize(videoElement, onPersonDetectedCallback) {
        try {
            console.log('Face Detection Manager を初期化中...');
            
            this.onPersonDetected = onPersonDetectedCallback;
            this.videoElement = videoElement;
            
            // キャンバスの作成（検出用）
            this.canvas = document.createElement('canvas');
            this.canvas.width = 640;
            this.canvas.height = 480;
            this.ctx = this.canvas.getContext('2d');
            
            console.log('Face Detection Manager の初期化が完了しました');
            return true;

        } catch (error) {
            console.error('Face Detection Manager の初期化に失敗しました:', error);
            return false;
        }
    }

    // 検出開始
    async startDetection() {
        if (this.isDetecting) return;

        try {
            console.log('人検出を開始します...');
            this.isDetecting = true;
            
            // 定期的に検出を実行
            this.detectionInterval = setInterval(() => {
                this.detectPerson();
            }, 100); // 100ms間隔で検出

        } catch (error) {
            console.error('人検出の開始に失敗しました:', error);
            this.isDetecting = false;
        }
    }

    // 検出停止
    stopDetection() {
        console.log('人検出を停止します...');
        this.isDetecting = false;
        
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }

    // 人検出の実行
    detectPerson() {
        if (!this.videoElement || !this.ctx) return;
        
        try {
            // ビデオフレームをキャンバスに描画
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
            
            // 画像データを取得
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // 簡単な人検出アルゴリズム（顔の特徴を検出）
            const hasPerson = this.detectFaceFeatures(imageData);
            
            if (hasPerson) {
                this.lastDetectionTime = Date.now();
                console.log('人を検出しました');
            }
            
            // 検出状態を更新
            this.updateDetectionState(hasPerson);
            
        } catch (error) {
            console.error('人検出エラー:', error);
        }
    }

    // 顔の特徴を検出（簡易版）
    detectFaceFeatures(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // 肌色の検出（簡易的な人検出）
        let skinPixels = 0;
        let totalPixels = width * height;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // 肌色の判定（簡易版）
            if (this.isSkinColor(r, g, b)) {
                skinPixels++;
            }
        }
        
        const skinRatio = skinPixels / totalPixels;
        const hasPerson = skinRatio > 0.1; // 10%以上が肌色なら人と判定
        
        return hasPerson;
    }

    // 肌色の判定
    isSkinColor(r, g, b) {
        // 肌色の範囲を定義（簡易版）
        const isRedDominant = r > g && r > b;
        const isGreenReasonable = g > 50 && g < 200;
        const isBlueReasonable = b > 30 && b < 150;
        const isBrightEnough = (r + g + b) / 3 > 80;
        
        return isRedDominant && isGreenReasonable && isBlueReasonable && isBrightEnough;
    }

    // 検出タイムアウトのチェック
    checkDetectionTimeout() {
        const now = Date.now();
        const timeSinceLastDetection = now - this.lastDetectionTime;
        
        if (timeSinceLastDetection > this.detectionThreshold) {
            // 一定時間検出されなかった場合
            this.updateDetectionState(false);
        }
    }

    // 検出状態の更新
    updateDetectionState(isPersonDetected) {
        if (this.onPersonDetected) {
            this.onPersonDetected(isPersonDetected);
        }
    }

    // 設定の更新
    updateSettings(settings) {
        if (settings.detectionThreshold) {
            this.detectionThreshold = settings.detectionThreshold;
        }
    }

    // クリーンアップ
    cleanup() {
        this.stopDetection();
        
        if (this.canvas) {
            this.canvas = null;
            this.ctx = null;
        }
        
        this.videoElement = null;
    }
}

// グローバルにエクスポート
window.FaceDetectionManager = FaceDetectionManager; 