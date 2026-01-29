/**
 * Percussion Jam - Main Application
 * Live percussion jamming app using Google Lyria RealTime
 */

import { LyriaClient } from './lyria-client.js';
import { AudioPlayer } from './audio-player.js';
import { PERCUSSION_PRESETS, getPreset, blendPresets, createPercussionPrompt } from './percussion-presets.js';

class PercussionJamApp {
    constructor() {
        this.lyriaClient = null;
        this.audioPlayer = new AudioPlayer();
        this.activeStyles = new Map(); // Map of style key -> weight
        this.isConnected = false;
        this.isPlaying = false;

        // Cache DOM elements
        this.elements = {};
        this.cacheElements();

        // Initialize
        this.init();
    }

    /**
     * Cache all DOM element references
     */
    cacheElements() {
        this.elements = {
            // Connection
            apiKeySection: document.getElementById('apiKeySection'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            connectBtn: document.getElementById('connectBtn'),
            connectionStatus: document.getElementById('connectionStatus'),

            // Visualizer
            visualizer: document.getElementById('visualizer'),
            visualizerOverlay: document.getElementById('visualizerOverlay'),

            // Transport
            playBtn: document.getElementById('playBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            stopBtn: document.getElementById('stopBtn'),

            // Parameters
            bpmSlider: document.getElementById('bpmSlider'),
            bpmValue: document.getElementById('bpmValue'),
            densitySlider: document.getElementById('densitySlider'),
            densityValue: document.getElementById('densityValue'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            brightnessValue: document.getElementById('brightnessValue'),
            scaleSelect: document.getElementById('scaleSelect'),

            // Mixer
            drumsToggle: document.getElementById('drumsToggle'),
            bassToggle: document.getElementById('bassToggle'),
            onlyRhythmToggle: document.getElementById('onlyRhythmToggle'),

            // Blend
            blendDisplay: document.getElementById('blendDisplay'),
            clearBlendBtn: document.getElementById('clearBlendBtn'),

            // Custom prompt
            customPrompt: document.getElementById('customPrompt'),
            applyPromptBtn: document.getElementById('applyPromptBtn'),

            // Toast
            toastContainer: document.getElementById('toastContainer'),

            // Pads
            pads: document.querySelectorAll('.pad')
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        // Set up event listeners
        this.setupEventListeners();

        // Initialize audio player
        await this.audioPlayer.init();

        // Set up visualizer
        this.setupVisualizer();

        // Check for stored API key
        const storedKey = localStorage.getItem('lyria_api_key');
        if (storedKey) {
            this.elements.apiKeyInput.value = storedKey;
        }

        console.log('[App] Initialized');
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Connection
        this.elements.connectBtn.addEventListener('click', () => this.handleConnect());
        this.elements.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleConnect();
        });

        // Transport controls
        this.elements.playBtn.addEventListener('click', () => this.handlePlay());
        this.elements.pauseBtn.addEventListener('click', () => this.handlePause());
        this.elements.stopBtn.addEventListener('click', () => this.handleStop());

        // Parameter sliders
        this.elements.bpmSlider.addEventListener('input', (e) => this.handleBpmChange(e.target.value));
        this.elements.bpmSlider.addEventListener('change', (e) => this.applyBpmChange(e.target.value));
        this.elements.densitySlider.addEventListener('input', (e) => this.handleDensityChange(e.target.value));
        this.elements.brightnessSlider.addEventListener('input', (e) => this.handleBrightnessChange(e.target.value));
        this.elements.scaleSelect.addEventListener('change', (e) => this.handleScaleChange(e.target.value));

        // Mixer toggles
        this.elements.drumsToggle.addEventListener('change', (e) => this.handleMixerChange());
        this.elements.bassToggle.addEventListener('change', (e) => this.handleMixerChange());
        this.elements.onlyRhythmToggle.addEventListener('change', (e) => this.handleMixerChange());

        // Blend controls
        this.elements.clearBlendBtn.addEventListener('click', () => this.clearBlend());

        // Custom prompt
        this.elements.customPrompt.addEventListener('input', (e) => {
            this.elements.applyPromptBtn.disabled = !this.isConnected || e.target.value.trim() === '';
        });
        this.elements.applyPromptBtn.addEventListener('click', () => this.handleCustomPrompt());

        // Percussion pads
        this.elements.pads.forEach(pad => {
            pad.addEventListener('click', () => this.handlePadClick(pad));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Window resize for visualizer
        window.addEventListener('resize', () => this.resizeVisualizer());
    }

    /**
     * Handle API key connection
     */
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
            // Create Lyria client
            this.lyriaClient = new LyriaClient(apiKey);

            // Set up callbacks
            this.lyriaClient.on('audioChunk', (data) => this.handleAudioChunk(data));
            this.lyriaClient.on('stateChange', (state) => this.handleStateChange(state));
            this.lyriaClient.on('error', (error) => this.handleError(error));
            this.lyriaClient.on('close', () => this.handleDisconnect());

            // Connect
            await this.lyriaClient.connect();

            // Store API key
            localStorage.setItem('lyria_api_key', apiKey);

            // Update UI
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.elements.apiKeySection.classList.add('hidden');
            this.enableControls(true);

            this.showToast('Connected to Lyria RealTime', 'success');

            // Set initial configuration
            await this.setInitialConfig();

        } catch (error) {
            console.error('[App] Connection failed:', error);
            this.updateConnectionStatus('disconnected');
            this.showToast('Failed to connect: ' + error.message, 'error');
            this.elements.connectBtn.disabled = false;
            this.elements.connectBtn.textContent = 'Connect';
        }
    }

    /**
     * Set initial music configuration
     */
    async setInitialConfig() {
        // Set default prompts
        const defaultPreset = getPreset('electronic');
        if (defaultPreset) {
            this.lyriaClient.setWeightedPrompts(defaultPreset.prompts);
        }

        // Set initial config
        this.lyriaClient.setMusicGenerationConfig({
            bpm: parseInt(this.elements.bpmSlider.value),
            density: parseInt(this.elements.densitySlider.value) / 100,
            brightness: parseInt(this.elements.brightnessSlider.value) / 100,
            scale: this.elements.scaleSelect.value
        });
    }

    /**
     * Handle audio chunk from Lyria
     */
    handleAudioChunk(data) {
        this.audioPlayer.processAudioChunk(data);
    }

    /**
     * Handle state changes from Lyria
     */
    handleStateChange(state) {
        console.log('[App] State change:', state, 'isConnected before:', this.isConnected);

        switch (state) {
            case 'connected':
                console.log('[App] Setting isConnected to true');
                this.isConnected = true;
                break;
            case 'playing':
                this.isPlaying = true;
                this.elements.playBtn.classList.add('playing');
                this.elements.visualizerOverlay.classList.add('hidden');
                break;
            case 'paused':
            case 'stopped':
                this.isPlaying = false;
                this.elements.playBtn.classList.remove('playing');
                break;
            case 'disconnected':
                this.isConnected = false;
                break;
        }
        console.log('[App] State change complete, isConnected now:', this.isConnected);
    }

    /**
     * Handle errors from Lyria
     */
    handleError(error) {
        console.error('[App] Error:', error);
        this.showToast('Error: ' + error, 'error');
    }

    /**
     * Handle disconnection
     */
    handleDisconnect() {
        this.isConnected = false;
        this.isPlaying = false;
        this.updateConnectionStatus('disconnected');
        this.enableControls(false);
        this.elements.apiKeySection.classList.remove('hidden');
        this.showToast('Disconnected from Lyria', 'info');
    }

    /**
     * Handle play button
     */
    async handlePlay() {
        console.log('[App] handlePlay called, isConnected:', this.isConnected, 'lyriaClient:', !!this.lyriaClient);

        if (!this.lyriaClient || !this.isConnected) {
            console.warn('[App] Cannot play - not connected');
            return;
        }

        try {
            console.log('[App] Resuming audio context...');
            await this.audioPlayer.resume();
            console.log('[App] Audio context resumed, sending PLAY command...');
            this.lyriaClient.play();
            console.log('[App] PLAY command sent');
            this.elements.visualizerOverlay.classList.add('hidden');
        } catch (error) {
            console.error('[App] Error in handlePlay:', error);
        }
    }

    /**
     * Handle pause button
     */
    handlePause() {
        if (!this.lyriaClient || !this.isConnected) return;
        this.lyriaClient.pause();
    }

    /**
     * Handle stop button
     */
    handleStop() {
        if (!this.lyriaClient || !this.isConnected) return;
        this.lyriaClient.stop();
        this.audioPlayer.stop();
        this.elements.visualizerOverlay.classList.remove('hidden');
    }

    /**
     * Handle BPM slider (display only)
     */
    handleBpmChange(value) {
        this.elements.bpmValue.textContent = value;
    }

    /**
     * Apply BPM change (on release)
     */
    applyBpmChange(value) {
        if (!this.lyriaClient || !this.isConnected) return;

        // BPM requires context reset
        this.lyriaClient.setMusicGenerationConfig({ bpm: parseInt(value) });
        this.lyriaClient.resetContext();
        this.showToast(`BPM set to ${value}`, 'info');
    }

    /**
     * Handle density slider
     */
    handleDensityChange(value) {
        this.elements.densityValue.textContent = `${value}%`;

        if (!this.lyriaClient || !this.isConnected) return;
        this.lyriaClient.setMusicGenerationConfig({ density: value / 100 });
    }

    /**
     * Handle brightness slider
     */
    handleBrightnessChange(value) {
        this.elements.brightnessValue.textContent = `${value}%`;

        if (!this.lyriaClient || !this.isConnected) return;
        this.lyriaClient.setMusicGenerationConfig({ brightness: value / 100 });
    }

    /**
     * Handle scale selection change
     */
    handleScaleChange(value) {
        if (!this.lyriaClient || !this.isConnected) return;

        this.lyriaClient.setMusicGenerationConfig({ scale: value });
        this.lyriaClient.resetContext();
        this.showToast('Scale changed', 'info');
    }

    /**
     * Handle mixer toggle changes
     */
    handleMixerChange() {
        if (!this.lyriaClient || !this.isConnected) return;

        const config = {
            muteDrums: !this.elements.drumsToggle.checked,
            muteBass: !this.elements.bassToggle.checked,
            onlyBassAndDrums: this.elements.onlyRhythmToggle.checked
        };

        this.lyriaClient.setMusicGenerationConfig(config);
    }

    /**
     * Handle percussion pad click
     */
    handlePadClick(pad) {
        const style = pad.dataset.style;
        const preset = getPreset(style);

        if (!preset) return;

        // Toggle active state
        if (this.activeStyles.has(style)) {
            this.activeStyles.delete(style);
            pad.classList.remove('active');
        } else {
            this.activeStyles.set(style, 1.0);
            pad.classList.add('active');
        }

        // Update blend and apply
        this.updateBlendDisplay();
        this.applyCurrentBlend();
    }

    /**
     * Update the blend display UI
     */
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

    /**
     * Apply the current blend of styles
     */
    applyCurrentBlend() {
        if (!this.lyriaClient || !this.isConnected) return;

        if (this.activeStyles.size === 0) {
            // Use default electronic preset
            const defaultPreset = getPreset('electronic');
            this.lyriaClient.setWeightedPrompts(defaultPreset.prompts);
            return;
        }

        // Build blend from active styles
        const selections = Array.from(this.activeStyles).map(([key, weight]) => ({
            key,
            weight
        }));

        const blend = blendPresets(selections);
        if (blend) {
            this.lyriaClient.setWeightedPrompts(blend.prompts);

            // Optionally update sliders to match blend
            // this.elements.densitySlider.value = blend.config.density * 100;
            // this.elements.brightnessSlider.value = blend.config.brightness * 100;
            // this.handleDensityChange(blend.config.density * 100);
            // this.handleBrightnessChange(blend.config.brightness * 100);
        }
    }

    /**
     * Clear all blended styles
     */
    clearBlend() {
        this.activeStyles.clear();
        this.elements.pads.forEach(pad => pad.classList.remove('active'));
        this.updateBlendDisplay();

        if (this.lyriaClient && this.isConnected) {
            const defaultPreset = getPreset('electronic');
            this.lyriaClient.setWeightedPrompts(defaultPreset.prompts);
        }
    }

    /**
     * Handle custom prompt submission
     */
    handleCustomPrompt() {
        const text = this.elements.customPrompt.value.trim();
        if (!text || !this.lyriaClient || !this.isConnected) return;

        const prompts = createPercussionPrompt(text);
        this.lyriaClient.setWeightedPrompts(prompts);

        // Clear active styles
        this.activeStyles.clear();
        this.elements.pads.forEach(pad => pad.classList.remove('active'));
        this.updateBlendDisplay();

        this.showToast('Custom style applied', 'success');
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyDown(e) {
        // Ignore if typing in input
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

    /**
     * Adjust a slider value
     */
    adjustSlider(slider, delta) {
        const currentValue = parseInt(slider.value);
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const newValue = Math.max(min, Math.min(max, currentValue + delta));
        slider.value = newValue;

        // Update display
        if (slider === this.elements.bpmSlider) {
            this.handleBpmChange(newValue);
        } else if (slider === this.elements.densitySlider) {
            this.handleDensityChange(newValue);
        } else if (slider === this.elements.brightnessSlider) {
            this.handleBrightnessChange(newValue);
        }
    }

    /**
     * Set up the audio visualizer
     */
    setupVisualizer() {
        const canvas = this.elements.visualizer;
        const ctx = canvas.getContext('2d');

        this.resizeVisualizer();

        // Start visualization loop
        this.audioPlayer.startVisualization((frequencyData, timeDomainData) => {
            this.drawVisualizer(ctx, frequencyData, timeDomainData);
        });
    }

    /**
     * Resize visualizer canvas
     */
    resizeVisualizer() {
        const canvas = this.elements.visualizer;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    /**
     * Draw the visualizer
     */
    drawVisualizer(ctx, frequencyData, timeDomainData) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Clear canvas
        ctx.fillStyle = '#16161f';
        ctx.fillRect(0, 0, width, height);

        // Draw frequency bars
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

        // Draw waveform
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

    /**
     * Update connection status UI
     */
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

    /**
     * Enable or disable controls
     */
    enableControls(enabled) {
        this.elements.playBtn.disabled = !enabled;
        this.elements.pauseBtn.disabled = !enabled;
        this.elements.stopBtn.disabled = !enabled;
        this.elements.applyPromptBtn.disabled = !enabled || this.elements.customPrompt.value.trim() === '';
    }

    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PercussionJamApp();
});
