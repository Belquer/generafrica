/**
 * GenerAfrica - Main Application
 * Live African percussion jamming app using Google Lyria RealTime
 */

import { LyriaClient } from './lyria-client.js';
import { AudioPlayer } from './audio-player.js';
import { MidiManager } from './midi-manager.js';

// Slider IDs that support MIDI learn
const MIDI_LEARNABLE_SLIDERS = [
    'bpmSlider',
    'densitySlider',
    'brightnessSlider'
];

// Human-readable names for sliders
const SLIDER_NAMES = {
    bpmSlider: 'BPM',
    densitySlider: 'Density',
    brightnessSlider: 'Brightness'
};

// African percussion prompt
const AFRICAN_PROMPT = 'West African djembe ensemble, traditional polyrhythmic drumming, talking drums, dundun bass drums, shekere percussion, interlocking polyrhythms, call and response patterns';

class AfricanDrumsApp {
    constructor() {
        this.lyriaClient = null;
        this.audioPlayer = new AudioPlayer();
        this.midiManager = new MidiManager();
        this.isConnected = false;
        this.isPlaying = false;

        // Current parameters
        this.currentParams = {
            bpm: 90,
            density: 0.6,
            brightness: 0.5
        };

        // Cache DOM elements
        this.elements = {};
        this.cacheElements();

        // Initialize
        this.init();
    }

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
            playBtnIcon: document.getElementById('playBtnIcon'),
            playBtnLabel: document.getElementById('playBtnLabel'),

            // Parameters
            bpmSlider: document.getElementById('bpmSlider'),
            bpmValue: document.getElementById('bpmValue'),
            densitySlider: document.getElementById('densitySlider'),
            densityValue: document.getElementById('densityValue'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            brightnessValue: document.getElementById('brightnessValue'),

            // MIDI
            midiStatus: document.getElementById('midiStatus'),

            // Toast
            toastContainer: document.getElementById('toastContainer')
        };
    }

    async init() {
        this.setupEventListeners();
        await this.audioPlayer.init();
        this.setupVisualizer();
        await this.initMidi();

        // Check for stored API key
        const storedKey = localStorage.getItem('lyria_api_key');
        if (storedKey) {
            this.elements.apiKeyInput.value = storedKey;
        }

        console.log('[App] Initialized');
    }

    async initMidi() {
        // Set up MIDI callbacks
        this.midiManager.onParameterChange = (sliderId, midiValue) => {
            this.handleMidiCC(sliderId, midiValue);
        };

        this.midiManager.onMidiStateChange = (connected) => {
            this.updateMidiStatus(connected);
        };

        this.midiManager.onLearnStart = (sliderId) => {
            // Highlight the slider being learned
            const slider = this.elements[sliderId];
            if (slider) {
                slider.closest('.param-control').classList.add('midi-learning');
            }
            this.showToast(`Move a MIDI knob to assign to ${SLIDER_NAMES[sliderId]}...`, 'info');
        };

        this.midiManager.onLearnComplete = (sliderId, cc, channel) => {
            // Remove learning highlight, add mapped indicator
            document.querySelectorAll('.param-control.midi-learning').forEach(el => {
                el.classList.remove('midi-learning');
            });

            const slider = this.elements[sliderId];
            if (slider) {
                slider.closest('.param-control').classList.add('midi-mapped');
            }

            this.showToast(`${SLIDER_NAMES[sliderId]} mapped to CC ${cc}`, 'success');
        };

        const supported = await this.midiManager.init();
        this.updateMidiStatus(this.midiManager.isConnected);

        if (!supported) {
            console.log('[App] Web MIDI not supported');
        }

        // Restore visual state for existing mappings
        for (const sliderId of MIDI_LEARNABLE_SLIDERS) {
            if (this.midiManager.hasMapping(sliderId)) {
                const slider = this.elements[sliderId];
                if (slider) {
                    slider.closest('.param-control').classList.add('midi-mapped');
                }
            }
        }
    }

    handleMidiCC(sliderId, midiValue) {
        const slider = this.elements[sliderId];
        if (!slider) return;

        // Scale MIDI 0-127 to slider min-max
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const step = parseFloat(slider.step) || 1;
        const scaled = min + (midiValue / 127) * (max - min);
        const rounded = Math.round(scaled / step) * step;

        console.log(`[MIDI] ${sliderId}: midi=${midiValue}, min=${min}, max=${max}, step=${step}, scaled=${scaled}, rounded=${rounded}`);

        slider.value = rounded;
        slider.dispatchEvent(new Event('input'));

        // BPM needs 'change' event for context reset
        if (sliderId === 'bpmSlider') {
            slider.dispatchEvent(new Event('change'));
        }
    }

    updateMidiStatus(connected) {
        const el = this.elements.midiStatus;
        if (!el) return;

        if (connected) {
            el.classList.add('connected');
            el.title = `MIDI: ${this.midiManager.inputCount} device(s)`;
        } else {
            el.classList.remove('connected');
            el.title = 'MIDI: No devices';
        }
    }

    setupEventListeners() {
        // Connection
        this.elements.connectBtn.addEventListener('click', () => this.handleConnect());
        this.elements.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleConnect();
        });

        // Transport controls — single play/pause toggle
        this.elements.playBtn.addEventListener('click', () => this.togglePlayPause());

        // Parameter sliders
        this.elements.bpmSlider.addEventListener('input', (e) => {
            this.elements.bpmValue.textContent = e.target.value;
        });
        this.elements.bpmSlider.addEventListener('change', (e) => {
            this.currentParams.bpm = parseInt(e.target.value);
            this.applyConfig({ bpm: this.currentParams.bpm });
            this.lyriaClient?.resetContext();
            this.showToast(`BPM: ${this.currentParams.bpm}`, 'info');
        });

        this.elements.densitySlider.addEventListener('input', (e) => {
            this.elements.densityValue.textContent = `${e.target.value}%`;
            this.currentParams.density = e.target.value / 100;
            this.applyConfig({ density: this.currentParams.density });
        });

        this.elements.brightnessSlider.addEventListener('input', (e) => {
            this.elements.brightnessValue.textContent = `${e.target.value}%`;
            this.currentParams.brightness = e.target.value / 100;
            this.applyConfig({ brightness: this.currentParams.brightness });
        });


        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Window resize
        window.addEventListener('resize', () => this.resizeVisualizer());

        // MIDI learn: right-click on any slider's param-control
        for (const sliderId of MIDI_LEARNABLE_SLIDERS) {
            const slider = this.elements[sliderId];
            if (!slider) continue;

            const paramControl = slider.closest('.param-control');
            if (!paramControl) continue;

            paramControl.addEventListener('contextmenu', (e) => {
                e.preventDefault();

                if (this.midiManager.isLearning) {
                    // Cancel current learn
                    this.midiManager.cancelLearn();
                    document.querySelectorAll('.param-control.midi-learning').forEach(el => {
                        el.classList.remove('midi-learning');
                    });
                    this.showToast('MIDI learn cancelled', 'info');
                    return;
                }

                if (this.midiManager.hasMapping(sliderId)) {
                    // Clear existing mapping
                    this.midiManager.clearMapping(sliderId);
                    paramControl.classList.remove('midi-mapped');
                    this.showToast(`${SLIDER_NAMES[sliderId]} MIDI mapping cleared`, 'info');
                } else {
                    // Start learning
                    this.midiManager.startLearn(sliderId);
                }
            });
        }

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
            this.lyriaClient = new LyriaClient(apiKey);

            this.lyriaClient.on('audioChunk', (data) => this.handleAudioChunk(data));
            this.lyriaClient.on('stateChange', (state) => this.handleStateChange(state));
            this.lyriaClient.on('error', (error) => this.handleError(error));
            this.lyriaClient.on('close', () => this.handleDisconnect());

            await this.lyriaClient.connect();

            localStorage.setItem('lyria_api_key', apiKey);

            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.elements.apiKeySection.classList.add('hidden');
            this.enableControls(true);

            this.showToast('Connected to Lyria RealTime', 'success');

            // Set initial African percussion config
            await this.setInitialConfig();

        } catch (error) {
            console.error('[App] Connection failed:', error);
            this.updateConnectionStatus('disconnected');
            this.showToast('Failed to connect: ' + error.message, 'error');
            this.elements.connectBtn.disabled = false;
            this.elements.connectBtn.textContent = 'Connect';
        }
    }

    async setInitialConfig() {
        // Set African percussion prompt
        this.setAfricanPrompt();

        // Set initial music config
        this.applyConfig({
            bpm: this.currentParams.bpm,
            density: this.currentParams.density,
            brightness: this.currentParams.brightness
        });
    }

    setAfricanPrompt() {
        if (!this.lyriaClient || !this.isConnected) return;
        this.lyriaClient.setWeightedPrompts([
            { text: AFRICAN_PROMPT, weight: 1.0 }
        ]);
    }

    applyConfig(config) {
        if (!this.lyriaClient || !this.isConnected) return;
        this.lyriaClient.setMusicGenerationConfig(config);
    }

    handleAudioChunk(data) {
        this.audioPlayer.processAudioChunk(data);
    }

    handleStateChange(state) {
        console.log('[App] State change:', state);

        switch (state) {
            case 'connected':
                this.isConnected = true;
                break;
            case 'playing':
                this.isPlaying = true;
                this.elements.playBtn.classList.add('playing');
                this.elements.playBtnIcon.textContent = '⏸';
                this.elements.playBtnLabel.textContent = 'Pause';
                this.elements.visualizerOverlay.classList.add('hidden');
                break;
            case 'paused':
            case 'stopped':
                this.isPlaying = false;
                this.elements.playBtn.classList.remove('playing');
                this.elements.playBtnIcon.textContent = '▶';
                this.elements.playBtnLabel.textContent = 'Play';
                break;
            case 'disconnected':
                this.isConnected = false;
                break;
        }
    }

    handleError(error) {
        console.error('[App] Error:', error);
        this.showToast('Error: ' + error, 'error');
    }

    handleDisconnect() {
        this.isConnected = false;
        this.isPlaying = false;
        this.updateConnectionStatus('disconnected');
        this.enableControls(false);
        this.elements.apiKeySection.classList.remove('hidden');
        this.showToast('Disconnected from Lyria', 'info');
    }

    async togglePlayPause() {
        if (!this.lyriaClient || !this.isConnected) return;

        if (this.isPlaying) {
            this.lyriaClient.pause();
        } else {
            try {
                await this.audioPlayer.resume();
                this.lyriaClient.play();
                this.elements.visualizerOverlay.classList.add('hidden');
            } catch (error) {
                console.error('[App] Error in togglePlayPause:', error);
            }
        }
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlayPause();
                break;

            case 'Escape':
                if (this.midiManager.isLearning) {
                    this.midiManager.cancelLearn();
                    document.querySelectorAll('.param-control.midi-learning').forEach(el => {
                        el.classList.remove('midi-learning');
                    });
                    this.showToast('MIDI learn cancelled', 'info');
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.adjustSlider(this.elements.bpmSlider, 5);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.adjustSlider(this.elements.bpmSlider, -5);
                break;

            case 'ArrowRight':
                e.preventDefault();
                this.adjustSlider(this.elements.densitySlider, 5);
                break;

            case 'ArrowLeft':
                e.preventDefault();
                this.adjustSlider(this.elements.densitySlider, -5);
                break;

            case 'M':
                // Shift+M: clear all MIDI mappings
                if (e.shiftKey) {
                    this.midiManager.clearAllMappings();
                    document.querySelectorAll('.param-control.midi-mapped').forEach(el => {
                        el.classList.remove('midi-mapped');
                    });
                    this.showToast('All MIDI mappings cleared', 'info');
                }
                break;
        }
    }

    adjustSlider(slider, delta) {
        const currentValue = parseInt(slider.value);
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const newValue = Math.max(min, Math.min(max, currentValue + delta));
        slider.value = newValue;
        slider.dispatchEvent(new Event('input'));
        slider.dispatchEvent(new Event('change'));
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

        // Clear canvas
        ctx.fillStyle = '#16161f';
        ctx.fillRect(0, 0, width, height);

        // Draw frequency bars with warm African colors
        const barCount = 48;
        const barWidth = width / barCount;
        const barSpacing = 2;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#d97706');
        gradient.addColorStop(0.5, '#f59e0b');
        gradient.addColorStop(1, '#fbbf24');

        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor(i * (frequencyData.length / barCount));
            const value = frequencyData[dataIndex] / 255;
            const barHeight = value * height * 0.85;

            const x = i * barWidth;
            const y = height - barHeight;

            ctx.fillStyle = gradient;
            ctx.fillRect(x + barSpacing / 2, y, barWidth - barSpacing, barHeight);
        }

        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AfricanDrumsApp();
});
