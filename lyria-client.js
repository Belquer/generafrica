/**
 * Lyria RealTime Client
 * Handles WebSocket connection and communication with Google's Lyria RealTime API
 */

const LYRIA_MODEL = 'models/lyria-realtime-exp';
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';

export class LyriaClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.isPlaying = false;
        this.isSetupComplete = false;
        this.messageQueue = [];
        this.connectResolve = null;
        this.connectReject = null;
        this.callbacks = {
            onAudioChunk: null,
            onStateChange: null,
            onError: null,
            onClose: null
        };
        this.currentConfig = {
            bpm: 120,
            density: 0.5,
            brightness: 0.5,
            scale: 'SCALE_UNSPECIFIED',
            muteDrums: false,
            muteBass: false,
            onlyBassAndDrums: false
        };
        this.currentPrompts = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
    }

    /**
     * Build the WebSocket URL with authentication
     */
    buildWebSocketUrl() {
        return `${WS_URL}?key=${encodeURIComponent(this.apiKey)}`;
    }

    /**
     * Connect to Lyria RealTime
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.connectResolve = resolve;
            this.connectReject = reject;

            try {
                const url = this.buildWebSocketUrl();
                console.log('[Lyria] Connecting to WebSocket...');
                this.ws = new WebSocket(url);

                this.ws.onopen = () => {
                    console.log('[Lyria] WebSocket connected, sending setup...');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.notifyStateChange('connecting');

                    // Send initial setup message
                    this.sendSetupMessage();
                };

                this.ws.onmessage = async (event) => {
                    // Handle both Blob and string data
                    let data = event.data;
                    if (data instanceof Blob) {
                        data = await data.text();
                    }
                    this.handleMessage(data);
                };

                this.ws.onerror = (error) => {
                    console.error('[Lyria] WebSocket error:', error);
                    this.notifyError('Connection error - check your API key');
                    if (this.connectReject) {
                        this.connectReject(new Error('WebSocket connection failed'));
                        this.connectReject = null;
                        this.connectResolve = null;
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('[Lyria] WebSocket closed:', event.code, event.reason);
                    this.isConnected = false;
                    this.isPlaying = false;
                    this.isSetupComplete = false;
                    this.notifyStateChange('disconnected');

                    if (this.callbacks.onClose) {
                        this.callbacks.onClose(event);
                    }

                    // Reject if we haven't completed setup yet
                    if (this.connectReject) {
                        this.connectReject(new Error(`Connection closed: ${event.reason || 'Unknown reason'}`));
                        this.connectReject = null;
                        this.connectResolve = null;
                    }
                };
            } catch (error) {
                console.error('[Lyria] Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Send initial setup message
     */
    sendSetupMessage() {
        const setupMessage = {
            setup: {
                model: LYRIA_MODEL
            }
        };
        console.log('[Lyria] Sending setup:', JSON.stringify(setupMessage));
        this.send(setupMessage);
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('[Lyria] Received message:', JSON.stringify(message).substring(0, 500));

            // Handle setup complete
            if (message.setupComplete !== undefined) {
                console.log('[Lyria] Setup complete!');
                this.isSetupComplete = true;
                this.notifyStateChange('connected');

                // Process any queued messages
                this.processQueue();

                if (this.connectResolve) {
                    this.connectResolve();
                    this.connectResolve = null;
                    this.connectReject = null;
                }
                return;
            }

            // Handle audio chunks
            if (message.serverContent?.audioChunks) {
                for (const chunk of message.serverContent.audioChunks) {
                    if (chunk.data && this.callbacks.onAudioChunk) {
                        // Convert base64 to ArrayBuffer
                        const audioData = this.base64ToArrayBuffer(chunk.data);
                        this.callbacks.onAudioChunk(audioData);
                    }
                }
            }

            // Handle generation state
            if (message.serverContent?.generationState) {
                const state = message.serverContent.generationState;
                console.log('[Lyria] Generation state:', state);
                if (state === 'PLAYING') {
                    this.isPlaying = true;
                    this.notifyStateChange('playing');
                } else if (state === 'PAUSED') {
                    this.isPlaying = false;
                    this.notifyStateChange('paused');
                } else if (state === 'STOPPED') {
                    this.isPlaying = false;
                    this.notifyStateChange('stopped');
                }
            }

            // Handle filtered prompt (safety filter triggered)
            if (message.filteredPrompt) {
                console.warn('[Lyria] Prompt filtered:', message.filteredPrompt);
                this.notifyError('Prompt was filtered by safety system');
            }

            // Handle warnings
            if (message.warning) {
                console.warn('[Lyria] Server warning:', message.warning);
            }

            // Handle errors
            if (message.error) {
                console.error('[Lyria] Server error:', message.error);
                this.notifyError(message.error.message || 'Server error');
            }

        } catch (error) {
            console.error('[Lyria] Error parsing message:', error, data);
        }
    }

    /**
     * Process queued messages after setup complete
     */
    processQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    /**
     * Convert base64 string to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Send message to WebSocket
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const json = JSON.stringify(message);
            console.log('[Lyria] Sending:', json.substring(0, 200));
            this.ws.send(json);
            return true;
        } else {
            console.warn('[Lyria] Cannot send - WebSocket not ready, queueing');
            this.messageQueue.push(message);
            return false;
        }
    }

    /**
     * Set weighted prompts for music generation
     */
    setWeightedPrompts(prompts) {
        if (!Array.isArray(prompts)) {
            prompts = [prompts];
        }

        this.currentPrompts = prompts;

        const message = {
            clientContent: {
                weightedPrompts: prompts.map(p => ({
                    text: typeof p === 'string' ? p : p.text,
                    weight: typeof p === 'string' ? 1.0 : (p.weight || 1.0)
                }))
            }
        };

        return this.send(message);
    }

    /**
     * Set music generation configuration
     */
    setMusicGenerationConfig(config) {
        // Update internal config
        this.currentConfig = { ...this.currentConfig, ...config };

        const configObj = {};

        // BPM (requires reset_context to take effect)
        if (config.bpm !== undefined) {
            configObj.bpm = Math.round(config.bpm);
        }

        // Density (0.0 to 1.0)
        if (config.density !== undefined) {
            configObj.density = Math.max(0, Math.min(1, config.density));
        }

        // Brightness (0.0 to 1.0)
        if (config.brightness !== undefined) {
            configObj.brightness = Math.max(0, Math.min(1, config.brightness));
        }

        // Scale
        if (config.scale !== undefined) {
            configObj.scale = config.scale;
        }

        // Mute controls
        if (config.muteDrums !== undefined) {
            configObj.muteDrums = config.muteDrums;
        }

        if (config.muteBass !== undefined) {
            configObj.muteBass = config.muteBass;
        }

        if (config.onlyBassAndDrums !== undefined) {
            configObj.onlyBassAndDrums = config.onlyBassAndDrums;
        }

        // Generation mode
        if (config.mode !== undefined) {
            configObj.musicGenerationMode = config.mode;
        }

        const message = {
            musicGenerationConfig: configObj
        };

        return this.send(message);
    }

    /**
     * Start music playback
     */
    play() {
        const message = {
            playbackControl: 'PLAY'
        };
        return this.send(message);
    }

    /**
     * Pause music playback
     */
    pause() {
        const message = {
            playbackControl: 'PAUSE'
        };
        return this.send(message);
    }

    /**
     * Stop music playback
     */
    stop() {
        const message = {
            playbackControl: 'STOP'
        };
        return this.send(message);
    }

    /**
     * Reset context (required for BPM/scale changes)
     */
    resetContext() {
        const message = {
            playbackControl: 'RESET_CONTEXT'
        };
        return this.send(message);
    }

    /**
     * Set callback functions
     */
    on(event, callback) {
        switch (event) {
            case 'audioChunk':
                this.callbacks.onAudioChunk = callback;
                break;
            case 'stateChange':
                this.callbacks.onStateChange = callback;
                break;
            case 'error':
                this.callbacks.onError = callback;
                break;
            case 'close':
                this.callbacks.onClose = callback;
                break;
        }
    }

    /**
     * Notify state change
     */
    notifyStateChange(state) {
        if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(state);
        }
    }

    /**
     * Notify error
     */
    notifyError(error) {
        if (this.callbacks.onError) {
            this.callbacks.onError(error);
        }
    }

    /**
     * Disconnect from Lyria RealTime
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isPlaying = false;
        this.isSetupComplete = false;
    }

    /**
     * Get connection state
     */
    getState() {
        return {
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            isSetupComplete: this.isSetupComplete,
            config: { ...this.currentConfig },
            prompts: [...this.currentPrompts]
        };
    }
}

export default LyriaClient;
