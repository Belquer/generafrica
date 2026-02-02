/**
 * Audio Player
 * Handles Web Audio API playback and visualization of PCM audio data
 */

export class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.gainNode = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.scheduledBuffers = [];
        this.sampleRate = 48000;
        this.channels = 2;
        this.bufferDuration = 0.1; // 100ms chunks for smooth playback

        // Visualization
        this.visualizationCallback = null;
        this.animationFrameId = null;
    }

    /**
     * Initialize the audio context
     */
    async init() {
        if (this.audioContext) {
            return;
        }

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });

        // Create analyser for visualization
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;

        // Connect nodes
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        console.log('[AudioPlayer] Initialized with sample rate:', this.audioContext.sampleRate);
    }

    /**
     * Resume audio context (required for user interaction)
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('[AudioPlayer] Audio context resumed');
        }
    }

    /**
     * Process incoming PCM audio data
     * @param {ArrayBuffer} pcmData - Raw 16-bit PCM audio data
     */
    processAudioChunk(pcmData) {
        if (!this.audioContext || this.isStopping) {
            return;
        }

        // Convert Int16 PCM to Float32
        const int16Array = new Int16Array(pcmData);
        const float32Array = new Float32Array(int16Array.length);

        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        // Create audio buffer
        const numSamples = float32Array.length / this.channels;
        const audioBuffer = this.audioContext.createBuffer(
            this.channels,
            numSamples,
            this.sampleRate
        );

        // Deinterleave stereo channels
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);

        for (let i = 0; i < numSamples; i++) {
            leftChannel[i] = float32Array[i * 2];
            rightChannel[i] = float32Array[i * 2 + 1];
        }

        // Schedule the buffer for playback
        this.scheduleBuffer(audioBuffer);
    }

    /**
     * Schedule an audio buffer for seamless playback
     */
    scheduleBuffer(audioBuffer) {
        const currentTime = this.audioContext.currentTime;

        // Calculate start time for seamless playback
        if (this.nextStartTime < currentTime) {
            // Add small buffer to prevent clicks
            this.nextStartTime = currentTime + 0.05;
        }

        // Create buffer source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode);

        // Schedule playback
        source.start(this.nextStartTime);

        // Update next start time
        this.nextStartTime += audioBuffer.duration;

        // Track scheduled buffers for cleanup
        this.scheduledBuffers.push({
            source,
            endTime: this.nextStartTime
        });

        // Cleanup old buffers
        this.cleanupBuffers(currentTime);
    }

    /**
     * Clean up finished buffer sources
     */
    cleanupBuffers(currentTime) {
        this.scheduledBuffers = this.scheduledBuffers.filter(item => {
            if (item.endTime < currentTime) {
                try {
                    item.source.disconnect();
                } catch (e) {
                    // Ignore disconnection errors
                }
                return false;
            }
            return true;
        });
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(value) {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(
                Math.max(0, Math.min(1, value)),
                this.audioContext.currentTime
            );
        }
    }

    /**
     * Get frequency data for visualization
     */
    getFrequencyData() {
        if (!this.analyser) {
            return new Uint8Array(0);
        }
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    /**
     * Get time domain data for visualization
     */
    getTimeDomainData() {
        if (!this.analyser) {
            return new Uint8Array(0);
        }
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }

    /**
     * Start visualization loop
     */
    startVisualization(callback) {
        this.visualizationCallback = callback;
        this.animateVisualization();
    }

    /**
     * Animation loop for visualization
     */
    animateVisualization() {
        if (this.visualizationCallback) {
            const frequencyData = this.getFrequencyData();
            const timeDomainData = this.getTimeDomainData();
            this.visualizationCallback(frequencyData, timeDomainData);
        }
        this.animationFrameId = requestAnimationFrame(() => this.animateVisualization());
    }

    /**
     * Stop visualization loop
     */
    stopVisualization() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.visualizationCallback = null;
    }

    /**
     * Stop all audio playback with a smooth fade out
     * @param {number} fadeDuration - Fade duration in seconds (default 2)
     */
    stop(fadeDuration = 0.5) {
        if (!this.audioContext || !this.gainNode) {
            return;
        }

        // Prevent new chunks from being scheduled
        this.isStopping = true;

        const now = this.audioContext.currentTime;

        // Smooth fade out using linear ramp (avoids clicks)
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);

        // After fade completes, hard stop everything
        this._stopTimeout = setTimeout(() => {
            this.scheduledBuffers.forEach(item => {
                try {
                    item.source.stop();
                    item.source.disconnect();
                } catch (e) {
                    // Ignore errors
                }
            });
            this.scheduledBuffers = [];
            this.nextStartTime = 0;
            this.audioQueue = [];

            // Restore gain for next play
            if (this.gainNode && this.audioContext) {
                this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
                this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
            }
            this.isStopping = false;
        }, fadeDuration * 1000);
    }

    /**
     * Hard stop without fade (for internal use)
     */
    hardStop() {
        if (this._stopTimeout) {
            clearTimeout(this._stopTimeout);
            this._stopTimeout = null;
        }
        this.isStopping = false;
        this.scheduledBuffers.forEach(item => {
            try {
                item.source.stop();
                item.source.disconnect();
            } catch (e) {
                // Ignore errors
            }
        });
        this.scheduledBuffers = [];
        this.nextStartTime = 0;
        this.audioQueue = [];
        if (this.gainNode && this.audioContext) {
            this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
        }
    }

    /**
     * Pause audio (suspend context)
     */
    async pause() {
        if (this.audioContext && this.audioContext.state === 'running') {
            await this.audioContext.suspend();
        }
    }

    /**
     * Get current state
     */
    getState() {
        return {
            isInitialized: !!this.audioContext,
            state: this.audioContext?.state || 'uninitialized',
            sampleRate: this.sampleRate,
            scheduledBuffers: this.scheduledBuffers.length
        };
    }

    /**
     * Destroy the audio player
     */
    destroy() {
        this.stop();
        this.stopVisualization();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

export default AudioPlayer;
