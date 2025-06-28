// TensorFlow.js Face Detection ライブラリを使用した人検出機能
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
        this.currentDetectionState = false; // 現在の検出状態
        this.detectionCount = 0; // 連続検出回数
        this.minDetectionCount = 3; // 最小連続検出回数
        this.detector = null;
        this.tf = null;
    }

    // 初期化
    async initialize(videoElement, onPersonDetectedCallback) {
        try {
            console.log('TensorFlow.js Face Detection Manager を初期化中...');
            
            this.onPersonDetected = onPersonDetectedCallback;
            this.videoElement = videoElement;
            
            // キャンバスの作成（検出用）
            this.canvas = document.createElement('canvas');
            this.canvas.width = 640;
            this.canvas.height = 480;
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            
            // TensorFlow.js Face Detection の初期化
            await this.initializeFaceDetection();
            console.log('TensorFlow.js Face Detection Manager の初期化が完了しました');
            return true;

        } catch (error) {
            console.error('TensorFlow.js Face Detection Manager の初期化に失敗しました:', error);
            return false;
        }
    }

    // TensorFlow.js Face Detection の初期化
    async initializeFaceDetection() {
        try {
            console.log('TensorFlow.js Face Detection を読み込み中...');
            
            // TensorFlow.js の読み込み
            await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');
            
            // TensorFlow.js Face Detection の読み込み
            await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/face-detection@1.0.1/dist/face-detection.js');
            
            // TensorFlow が利用可能になるまで待機
            let retryCount = 0;
            while (typeof tf === 'undefined' && retryCount < 100) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retryCount++;
            }
            
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js が見つかりません');
            }
            
            this.tf = tf;
            console.log('TensorFlow.js の読み込み完了');
            
            // Face Detection モデルの初期化
            await this.initializeFaceDetectionModel();
            
        } catch (error) {
            console.error('TensorFlow.js Face Detection の初期化に失敗:', error);
            throw error;
        }
    }

    // Face Detection モデルの初期化
    async initializeFaceDetectionModel() {
        try {
            console.log('Face Detection モデルを初期化中...');
            
            // FaceDetection モデルを作成
            this.detector = await faceDetection.createDetector(
                faceDetection.SupportedModels.MediaPipeFaceDetector,
                {
                    runtime: 'tfjs',
                    modelType: 'short'
                }
            );
            
            console.log('Face Detection モデルの初期化完了');
            
        } catch (error) {
            console.error('Face Detection モデルの初期化に失敗:', error);
            throw error;
        }
    }

    // スクリプト読み込みヘルパー
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`スクリプト読み込み失敗: ${src}`));
            document.head.appendChild(script);
        });
    }

    // 検出開始
    async startDetection() {
        if (this.isDetecting) return;

        try {
            console.log('TensorFlow.js Face Detection 人検出を開始します...');
            this.isDetecting = true;
            this.detectionCount = 0;
            
            // 定期的に検出を実行
            this.detectionInterval = setInterval(() => {
                this.detectPerson();
            }, 150); // 150ms間隔で検出

        } catch (error) {
            console.error('人検出の開始に失敗しました:', error);
            this.isDetecting = false;
        }
    }

    // 検出停止
    stopDetection() {
        console.log('TensorFlow.js Face Detection 人検出を停止します...');
        this.isDetecting = false;
        this.detectionCount = 0;
        
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }

    // 人検出の実行
    async detectPerson() {
        if (!this.videoElement || !this.ctx || !this.detector) return;
        
        try {
            // ビデオの準備状態をチェック
            if (this.videoElement.readyState < 2) {
                return;
            }
            
            // ビデオフレームをキャンバスに描画
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
            
            // Face Detection で顔検出
            const predictions = await this.detectFacesWithFaceDetection();
            
            // 検出結果の処理
            this.handleDetectionResults(predictions);
            
        } catch (error) {
            console.error('TensorFlow.js Face Detection 検出エラー:', error);
        }
    }

    // Face Detection による顔検出
    async detectFacesWithFaceDetection() {
        try {
            // キャンバスから画像データを取得
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Face Detection で検出
            const faces = await this.detector.estimateFaces(imageData);
            
            console.log('Face Detection 結果:', faces); // デバッグ用
            
            // 検出結果を整形（APIの実際の構造に合わせて修正）
            const results = faces.map(face => {
                // バウンディングボックスの座標を取得
                const box = face.boundingBox;
                let x, y, width, height;
                
                if (box && typeof box.xCenter !== 'undefined') {
                    // MediaPipe形式の場合
                    x = box.xCenter * this.canvas.width - (box.width * this.canvas.width) / 2;
                    y = box.yCenter * this.canvas.height - (box.height * this.canvas.height) / 2;
                    width = box.width * this.canvas.width;
                    height = box.height * this.canvas.height;
                } else if (box && typeof box.x !== 'undefined') {
                    // 通常のバウンディングボックス形式の場合
                    x = box.x;
                    y = box.y;
                    width = box.width;
                    height = box.height;
                } else {
                    // フォールバック
                    x = 0;
                    y = 0;
                    width = 100;
                    height = 100;
                }
                
                return {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    confidence: face.score || 0.8
                };
            });
            
            return results;
            
        } catch (error) {
            console.error('Face Detection 顔検出エラー:', error);
            return [];
        }
    }

    // 検出結果の処理
    handleDetectionResults(predictions) {
        const hasPerson = predictions.length > 0;
        
        // デバッグ情報
        if (predictions.length > 0) {
            console.log(`TensorFlow.js Face Detection 検出結果: ${predictions.length}個の顔を検出`);
            predictions.forEach((prediction, index) => {
                console.log(`  顔${index + 1}: 位置=(${Math.round(prediction.x)}, ${Math.round(prediction.y)}), サイズ=${Math.round(prediction.width)}x${Math.round(prediction.height)}, 信頼度=${(prediction.confidence * 100).toFixed(1)}%`);
            });
        }
        
        if (hasPerson) {
            this.detectionCount++;
            this.lastDetectionTime = Date.now();
            
            if (this.detectionCount >= this.minDetectionCount) {
                console.log(`TensorFlow.js Face Detection: 人を検出しました (連続検出: ${this.detectionCount}回)`);
                this.updateDetectionState(true);
            } else {
                console.log(`TensorFlow.js Face Detection: 検出中... (連続検出: ${this.detectionCount}/${this.minDetectionCount})`);
            }
        } else {
            if (this.detectionCount > 0) {
                console.log(`TensorFlow.js Face Detection: 検出中断 (連続検出: ${this.detectionCount}回)`);
            }
            this.detectionCount = 0;
            // 人を検出していない場合、タイムアウトをチェック
            this.checkDetectionTimeout();
        }
    }

    // 検出タイムアウトのチェック
    checkDetectionTimeout() {
        const now = Date.now();
        const timeSinceLastDetection = now - this.lastDetectionTime;
        
        if (timeSinceLastDetection > this.detectionThreshold) {
            // 一定時間検出されなかった場合
            console.log(`TensorFlow.js Face Detection 人検出タイムアウト: ${timeSinceLastDetection}ms経過`);
            this.updateDetectionState(false);
        }
    }

    // 検出状態の更新
    updateDetectionState(isPersonDetected) {
        // 前回の状態を保存
        const previousState = this.currentDetectionState;
        this.currentDetectionState = isPersonDetected;
        
        // 状態が変化した場合のみコールバックを呼び出し
        if (previousState !== isPersonDetected) {
            console.log(`TensorFlow.js Face Detection 人検出状態変更: ${isPersonDetected ? '検出中' : '未検出'}`);
            if (this.onPersonDetected) {
                this.onPersonDetected(isPersonDetected);
            }
        }
    }

    // 設定の更新
    updateSettings(settings) {
        if (settings.detectionThreshold) {
            this.detectionThreshold = settings.detectionThreshold;
        }
        if (settings.minDetectionCount) {
            this.minDetectionCount = settings.minDetectionCount;
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
        this.detector = null;
        this.tf = null;
    }
}

// グローバルにエクスポート
window.FaceDetectionManager = FaceDetectionManager; 