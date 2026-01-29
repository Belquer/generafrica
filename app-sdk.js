/**
 * Percussion Jam - Main Application (Using Official Google GenAI SDK)
 * Live percussion jamming app using Google Lyria RealTime
 */

import { GoogleGenAI } from '@google/genai';
import { AudioPlayer } from './audio-player.js';
import { PERCUSSION_PRESETS, getPreset, blendPresets, createPercussionPrompt } from './percussion-presets.js';

const MODEL_ID = 'models/lyria-realtime-exp';

class PercussionJamApp {
    constructor() {
        this.ai = null;
        this.session = null;
        this.audioPlayer = new AudioPlayer();
        this.activeStyles = new Map();
        this.isConnected = false;
        this.isPlaying = false;
        this.isReceiving = false;

        this.elements = {};
        this.cacheElements();
        this.init();
    }

    cacheElements() {
        this.elements = {
            apiKeySection: document.getElementById('apiKeySection'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            connectBtn: document.getElementById('connectBtn'),
            connectionStatus: document.getElementById('connectionStatus'),
            visualizer: document.getElementById('visualizer'),
            visualizerOverlay: document.getElementById('visualizerOverlay'),
            playBtn: document.getElementById('playBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            stopBtn: document.getElementById('stopBtn'),
            bpmSlider: document.getElementById('bpmSlider'),
            bpmValue: document.getElementById('bpmValue'),
            densitySlider: document.getElementById('densitySlider'),
            densityValue: document.getElementById('densityValue'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            brightnessValue: document.getElementById('brightnessValue'),
            scaleSelect: document.getElementById('scaleSelect'),
            drumsToggle: document.getElementById('drumsToggle'),
            bassToggle: document.getElementById('bassToggle'),
            onlyRhythmToggle: document.getElementById('onlyRhythmToggle'),
            blendDisplay: document.getElementById('blendDisplay'),
            clearBlendBtn: document.getElementById('clearBlendBtn'),
            customPrompt: document.getElementById('customPrompt'),
            applyPromptBtn: document.getElementById('applyPromptBtn'),
            toastContainer: document.getElementById('toastContainer'),
            pads: document.querySelectorAll('.pad')
        };
    }

    async init() {
        this.setupEventListeners();
        await this.audioPlayer.init();
        this.setupVisualizer();

        const storedKey = localStorage.getItem('lyria_api_key');
        if (storedKey) {
            this.elements.apiKeyInput.value = storedKey;
        }

        console.log('[App] Initialized');
    }

    setupEventListeners() {
        this.elements.connectBtn.addEventListener('click', () => this.handleConnect());
        this.elements.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleConnect();
        });

        this.elements.playBtn.addEventListener('click', () => this.handlePlay());
        this.elements.pauseBtn.addEventListener('click', () => this.handlePause());
        this.elements.stopBtn.addEventListener('click', () => this.handleStop());

        this.elements.bpmSlider.addEventListener('input', (e) => this.handleBpmChange(e.target.value));
        this.elements.bpmSlider.addEventListener('change', (e) => this.applyBpmChange(e.target.value));
        this.elements.densitySlider.addEventListener('input', (e) => this.handleDensityChange(e.target.value));
        this.elements.brightnessSlider.addEventListener('input', (e) => this.handleBrightnessChange(e.target.value));
        this.elements.scaleSelect.addEventListener('change', (e) => this.handleScaleChange(e.target.value));

        this.elements.drumsToggle.addEventListener('change', () => this.handleMixerChange());
        this.elements.bassToggle.addEventListener('change', () => this.handleMixerChange());
        this.elements.onlyRhythmToggle.addEventListener('change', () => this.handleMixerChange());

        this.elements.clearBlendBtn.addEventListener('click', () => this.clearBlend());

        this.elements.customPrompt.addEventListener('input', (e) => {
            this.elements.applyPromptBtn.disabled = !this.isConnected || e.target.value.trim() === '';
        });
        this.elements.applyPromptBtn.addEventListener('click', () => this.handleCustomPrompt());

        this.elements.pads.forEach(pad => {
            pad.addEventListener('click', () => this.handlePadClick(pad));
        });

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('resize', () => this.resizeVisualizer());
    }

    async handleConnect() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showToast('Please enter your API key', 'error');
            return;
        }

        this.updateConnectionStatus('connecting');
        this.elements.connectBtn.disabled = true;
        this.elements.connectBtn.textContent = 'Connecting...';

        try {
            // Initialize the Google GenAI client with v1alpha for Lyria
            this.ai = new GoogleGenAI({
                apiKey: apiKey,
                httpOptions: { apiVersion: 'v1alpha' }
            });

            console.log('[App] Connecting to Lyria RealTime...');

            // Connect to Lyria RealTime
            this.session = await this.ai.live.music.connect({
                model: MODEL_ID,
                callbacks: {
                    onmessage: (message) => this.handleMessage(message),
                    onerror: (error) => {
                        console.error('[App] Session error:', error);
                        this.showToast('Session error: ' + error.message, 'error');
                    },
                    onclose: () => {
                        console.log('[App] Session closed');
                        this.handleDisconnect();
                    }
                }
            });

            console.log('[App] Connected to Lyria RealTime!');

            // Store API key
            localStorage.setItem('lyria_api_key', apiKey);

            // Update UI
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.elements.apiKeySection.classList.add('hidden');
            this.enableControls(true);

            this.showToast('Connected to Lyria RealTime', 'success');

            // Set initial prompts
            await this.setInitialConfig();

        } catch (error) {
            console.error('[App] Connection failed:', error);
            this.updateConnectionStatus('disconnected');
            this.showToast('Failed to connect: ' + (error.message || 'Unknown error'), 'error');
            this.elements.connectBtn.disabled = false;
            this.elements.connectBtn.textContent = 'Connect';
        }
    }

    async setInitialConfig() {
        const defaultPreset = getPreset('electronic');
        if (defaultPreset && this.session) {
            await this.session.setWeightedPrompts({
                weightedPrompts: defaultPreset.prompts
            });

            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: {
                    bpm: parseInt(this.elements.bpmSlider.value),
                    density: parseInt(this.elements.densitySlider.value) / 100,
                    brightness: parseInt(this.elements.brightnessSlider.value) / 100
                }
            });
        }
    }

    handleMessage(message) {
        console.log('[App] Received message:', Object.keys(message));

        // Handle audio chunks
        if (message.audioChunk?.data) {
            const audioBuffer = this.base64ToArrayBuffer(message.audioChunk.data);
            this.audioPlayer.processAudioChunk(audioBuffer);
        }

        // Alternative structure
        if (message.serverContent?.audioChunks) {
            for (const chunk of message.serverContent.audioChunks) {
                if (chunk.data) {
                    const audioBuffer = this.base64ToArrayBuffer(chunk.data);
                    this.audioPlayer.processAudioChunk(audioBuffer);
                }
            }
        }
    }

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    handleDisconnect() {
        this.isConnected = false;
        this.isPlaying = false;
        this.session = null;
        this.updateConnectionStatus('disconnected');
        this.enableControls(false);
        this.elements.apiKeySection.classList.remove('hidden');
        this.elements.connectBtn.disabled = false;
        this.elements.connectBtn.textContent = 'Connect';
        this.showToast('Disconnected from Lyria', 'info');
    }

    async handlePlay() {
        if (!this.session || !this.isConnected) return;

        try {
            await this.audioPlayer.resume();
            this.session.play();
            this.isPlaying = true;
            this.elements.playBtn.classList.add('playing');
            this.elements.visualizerOverlay.classList.add('hidden');
            console.log('[App] Playing');
        } catch (error) {
            console.error('[App] Play error:', error);
            this.showToast('Failed to start playback', 'error');
        }
    }

    handlePause() {
        if (!this.session || !this.isConnected) return;

        try {
            this.session.pause();
            this.isPlaying = false;
            this.elements.playBtn.classList.remove('playing');
            console.log('[App] Paused');
        } catch (error) {
            console.error('[App] Pause error:', error);
        }
    }

    handleStop() {
        if (!this.session || !this.isConnected) return;

        try {
            this.session.stop();
            this.audioPlayer.stop();
            this.isPlaying = false;
            this.elements.playBtn.classList.remove('playing');
            this.elements.visualizerOverlay.classList.remove('hidden');
            console.log('[App] Stopped');
        } catch (error) {
            console.error('[App] Stop error:', error);
        }
    }

    handleBpmChange(value) {
        this.elements.bpmValue.textContent = value;
    }

    async applyBpmChange(value) {
        if (!this.session || !this.isConnected) return;

        try {
            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: { bpm: parseInt(value) }
            });
            this.session.resetContext();
            this.showToast(`BPM set to ${value}`, 'info');
        } catch (error) {
            console.error('[App] BPM change error:', error);
        }
    }

    async handleDensityChange(value) {
        this.elements.densityValue.textContent = `${value}%`;

        if (!this.session || !this.isConnected) return;

        try {
            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: { density: value / 100 }
            });
        } catch (error) {
            console.error('[App] Density change error:', error);
        }
    }

    async handleBrightnessChange(value) {
        this.elements.brightnessValue.textContent = `${value}%`;

        if (!this.session || !this.isConnected) return;

        try {
            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: { brightness: value / 100 }
            });
        } catch (error) {
            console.error('[App] Brightness change error:', error);
        }
    }

    async handleScaleChange(value) {
        if (!this.session || !this.isConnected) return;

        try {
            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: { scale: value }
            });
            this.session.resetContext();
            this.showToast('Scale changed', 'info');
        } catch (error) {
            console.error('[App] Scale change error:', error);
        }
    }

    async handleMixerChange() {
        if (!this.session || !this.isConnected) return;

        try {
            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: {
                    muteDrums: !this.elements.drumsToggle.checked,
                    muteBass: !this.elements.bassToggle.checked,
                    onlyBassAndDrums: this.elements.onlyRhythmToggle.checked
                }
            });
        } catch (error) {
            console.error('[App] Mixer change error:', error);
        }
    }

    handlePadClick(pad) {
        const style = pad.dataset.style;
        const preset = getPreset(style);

        if (!preset) return;

        if (this.activeStyles.has(style)) {
            this.activeStyles.delete(style);
            pad.classList.remove('active');
        } else {
            this.activeStyles.set(style, 1.0);
            pad.classList.add('active');
        }

        this.updateBlendDisplay();
        this.applyCurrentBlend();
    }

    updateBlendDisplay() {
        const container = this.elements.blendDisplay;
        container.innerHTML = '';

        if (this.activeStyles.size === 0) {
            container.innerHTML = '<p class="blend-empty">Select percussion styles to blend</p>';
            return;
        }

        this.activeStyles.forEach((weight, style) => {
            const preset = getPreset(style);
            if (!preset) return;

            const tag = document.createElement('span');
            tag.className = 'blend-tag';
            tag.innerHTML = `${preset.emoji} ${preset.name} <span class="weight">${Math.round(weight * 100)}%</span>`;
            container.appendChild(tag);
        });
    }

    async applyCurrentBlend() {
        if (!this.session || !this.isConnected) return;

        try {
            if (this.activeStyles.size === 0) {
                const defaultPreset = getPreset('electronic');
                await this.session.setWeightedPrompts({
                    weightedPrompts: defaultPreset.prompts
                });
                return;
            }

            const selections = Array.from(this.activeStyles).map(([key, weight]) => ({
                key,
                weight
            }));

            const blend = blendPresets(selections);
            if (blend) {
                await this.session.setWeightedPrompts({
                    weightedPrompts: blend.prompts
                });
            }
        } catch (error) {
            console.error('[App] Blend apply error:', error);
        }
    }

    async clearBlend() {
        this.activeStyles.clear();
        this.elements.pads.forEach(pad => pad.classList.remove('active'));
        this.updateBlendDisplay();

        if (this.session && this.isConnected) {
            const defaultPreset = getPreset('electronic');
            await this.session.setWeightedPrompts({
                weightedPrompts: defaultPreset.prompts
            });
        }
    }

    async handleCustomPrompt() {
        const text = this.elements.customPrompt.value.trim();
        if (!text || !this.session || !this.isConnected) return;

        try {
            const prompts = createPercussionPrompt(text);
            await this.session.setWeightedPrompts({
                weightedPrompts: prompts
            });

            this.activeStyles.clear();
            this.elements.pads.forEach(pad => pad.classList.remove('active'));
            this.updateBlendDisplay();

            this.showToast('Custom style applied', 'success');
        } catch (error) {
            console.error('[App] Custom prompt error:', error);
            this.showToast('Failed to apply custom style', 'error');
        }
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (this.isPlaying) {
                    this.handlePause();
                } else {
                    this.handlePlay();
                }
                break;

            case 'Escape':
                this.handleStop();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.adjustSlider(this.elements.bpmSlider, 5);
                this.applyBpmChange(this.elements.bpmSlider.value);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.adjustSlider(this.elements.bpmSlider, -5);
                this.applyBpmChange(this.elements.bpmSlider.value);
                break;

            case 'ArrowRight':
                e.preventDefault();
                this.adjustSlider(this.elements.densitySlider, 5);
                this.handleDensityChange(this.elements.densitySlider.value);
                break;

            case 'ArrowLeft':
                e.preventDefault();
                this.adjustSlider(this.elements.densitySlider, -5);
                this.handleDensityChange(this.elements.densitySlider.value);
                break;

            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
                const padIndex = parseInt(e.key) - 1;
                const pad = this.elements.pads[padIndex];
                if (pad) {
                    this.handlePadClick(pad);
                }
                break;

            case 'c':
            case 'C':
                this.clearBlend();
                break;
        }
    }

    adjustSlider(slider, delta) {
        const currentValue = parseInt(slider.value);
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const newValue = Math.max(min, Math.min(max, currentValue + delta));
        slider.value = newValue;

        if (slider === this.elements.bpmSlider) {
            this.handleBpmChange(newValue);
        } else if (slider === this.elements.densitySlider) {
            this.handleDensityChange(newValue);
        } else if (slider === this.elements.brightnessSlider) {
            this.handleBrightnessChange(newValue);
        }
    }

    setupVisualizer() {
        const canvas = this.elements.visualizer;
        const ctx = canvas.getContext('2d');

        this.resizeVisualizer();

        this.audioPlayer.startVisualization((frequencyData, timeDomainData) => {
            this.drawVisualizer(ctx, frequencyData, timeDomainData);
        });
    }

    resizeVisualizer() {
        const canvas = this.elements.visualizer;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    drawVisualizer(ctx, frequencyData, timeDomainData) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        ctx.fillStyle = '#16161f';
        ctx.fillRect(0, 0, width, height);

        const barCount = 64;
        const barWidth = width / barCount;
        const barSpacing = 2;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#7c3aed');
        gradient.addColorStop(0.5, '#a855f7');
        gradient.addColorStop(1, '#c084fc');

        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor(i * (frequencyData.length / barCount));
            const value = frequencyData[dataIndex] / 255;
            const barHeight = value * height * 0.8;

            const x = i * barWidth;
            const y = height - barHeight;

            ctx.fillStyle = gradient;
            ctx.fillRect(x + barSpacing / 2, y, barWidth - barSpacing, barHeight);
        }

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        const sliceWidth = width / timeDomainData.length;
        let x = 0;

        for (let i = 0; i < timeDomainData.length; i++) {
            const v = timeDomainData[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();
    }

    updateConnectionStatus(status) {
        const statusElement = this.elements.connectionStatus;
        const statusText = statusElement.querySelector('.status-text');

        statusElement.className = 'connection-status ' + status;

        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
        }
    }

    enableControls(enabled) {
        this.elements.playBtn.disabled = !enabled;
        this.elements.pauseBtn.disabled = !enabled;
        this.elements.stopBtn.disabled = !enabled;
        this.elements.applyPromptBtn.disabled = !enabled || this.elements.customPrompt.value.trim() === '';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new PercussionJamApp();
});
