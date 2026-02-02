/**
 * MIDI Manager
 * Handles Web MIDI API access, MIDI learn, and CC-to-parameter mapping
 */

const STORAGE_KEY = 'african_drums_midi_mappings';

export class MidiManager {
    constructor() {
        this.midiAccess = null;
        this.inputs = new Map();
        this.mappings = {}; // { sliderId: { channel, cc } }
        this.learning = null; // { sliderId } when in learn mode
        this.onParameterChange = null; // callback(sliderId, scaledValue)
        this.onMidiStateChange = null; // callback(connected: bool)
        this.onLearnComplete = null; // callback(sliderId, cc, channel)
        this.onLearnStart = null; // callback(sliderId)

        this.loadMappings();
    }

    /**
     * Initialize Web MIDI access
     */
    async init() {
        if (!navigator.requestMIDIAccess) {
            console.warn('[MIDI] Web MIDI API not supported');
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            console.log('[MIDI] Access granted');

            // Listen for device changes
            this.midiAccess.onstatechange = (e) => this.handleStateChange(e);

            // Connect to all current inputs
            this.connectInputs();

            return true;
        } catch (error) {
            console.error('[MIDI] Access denied:', error);
            return false;
        }
    }

    /**
     * Connect to all available MIDI inputs
     */
    connectInputs() {
        // Disconnect old inputs
        this.inputs.forEach((_, input) => {
            input.onmidimessage = null;
        });
        this.inputs.clear();

        // Connect new inputs
        if (this.midiAccess) {
            for (const input of this.midiAccess.inputs.values()) {
                console.log('[MIDI] Input found:', input.name);
                input.onmidimessage = (e) => this.handleMessage(e);
                this.inputs.set(input.id, input);
            }
        }

        const connected = this.inputs.size > 0;
        if (this.onMidiStateChange) {
            this.onMidiStateChange(connected);
        }
    }

    /**
     * Handle MIDI device state changes (connect/disconnect)
     */
    handleStateChange(event) {
        console.log('[MIDI] State change:', event.port.name, event.port.state);
        this.connectInputs();
    }

    /**
     * Handle incoming MIDI messages
     */
    handleMessage(event) {
        const [status, data1, data2] = event.data;
        const messageType = status & 0xf0;
        const channel = status & 0x0f;

        // Only handle Control Change messages (0xB0)
        if (messageType !== 0xb0) return;

        const cc = data1;
        const value = data2; // 0-127

        // If learning, assign this CC to the target parameter
        if (this.learning) {
            console.log(`[MIDI] Learn captured: CC ${cc}, ch ${channel}, val ${value}`);
            this.assignMapping(this.learning.sliderId, channel, cc);
            return;
        }

        // Otherwise, find and update the mapped parameter
        for (const [sliderId, mapping] of Object.entries(this.mappings)) {
            if (mapping.cc === cc && mapping.channel === channel) {
                console.log(`[MIDI] CC ${cc} ch ${channel} val ${value} → ${sliderId}`);
                if (this.onParameterChange) {
                    this.onParameterChange(sliderId, value);
                }
                break;
            }
        }
    }

    /**
     * Start MIDI learn mode for a parameter
     */
    startLearn(sliderId) {
        this.learning = { sliderId };
        console.log('[MIDI] Learning for:', sliderId);

        if (this.onLearnStart) {
            this.onLearnStart(sliderId);
        }
    }

    /**
     * Cancel MIDI learn mode
     */
    cancelLearn() {
        this.learning = null;
    }

    /**
     * Assign a MIDI CC to a parameter
     */
    assignMapping(sliderId, channel, cc) {
        // Remove any existing mapping using this same CC+channel
        for (const [id, mapping] of Object.entries(this.mappings)) {
            if (mapping.cc === cc && mapping.channel === channel && id !== sliderId) {
                delete this.mappings[id];
            }
        }

        this.mappings[sliderId] = { channel, cc };
        this.learning = null;
        this.saveMappings();

        console.log(`[MIDI] Mapped ${sliderId} to CC ${cc} (ch ${channel + 1})`);

        if (this.onLearnComplete) {
            this.onLearnComplete(sliderId, cc, channel);
        }
    }

    /**
     * Clear mapping for a parameter
     */
    clearMapping(sliderId) {
        delete this.mappings[sliderId];
        this.saveMappings();
        console.log('[MIDI] Cleared mapping for:', sliderId);
    }

    /**
     * Clear all mappings
     */
    clearAllMappings() {
        this.mappings = {};
        this.saveMappings();
        console.log('[MIDI] All mappings cleared');
    }

    /**
     * Check if a parameter has a mapping
     */
    hasMapping(sliderId) {
        return sliderId in this.mappings;
    }

    /**
     * Get mapping info for a parameter
     */
    getMapping(sliderId) {
        return this.mappings[sliderId] || null;
    }

    /**
     * Save mappings to localStorage
     */
    saveMappings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mappings));
        } catch (e) {
            console.warn('[MIDI] Could not save mappings:', e);
        }
    }

    /**
     * Load mappings from localStorage
     */
    loadMappings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Deduplicate: if multiple sliders map to the same CC+channel, keep only the last one
                const seen = new Map();
                this.mappings = {};
                for (const [sliderId, mapping] of Object.entries(parsed)) {
                    const key = `${mapping.channel}:${mapping.cc}`;
                    if (seen.has(key)) {
                        console.warn(`[MIDI] Duplicate mapping for CC ${mapping.cc} ch ${mapping.channel}: ${seen.get(key)} and ${sliderId} — keeping ${sliderId}`);
                        delete this.mappings[seen.get(key)];
                    }
                    seen.set(key, sliderId);
                    this.mappings[sliderId] = mapping;
                }
                console.log('[MIDI] Loaded mappings:', JSON.stringify(this.mappings));
            }
        } catch (e) {
            console.warn('[MIDI] Could not load mappings:', e);
            this.mappings = {};
        }
    }

    /**
     * Get the number of connected MIDI inputs
     */
    get inputCount() {
        return this.inputs.size;
    }

    /**
     * Check if any MIDI device is connected
     */
    get isConnected() {
        return this.inputs.size > 0;
    }

    /**
     * Check if currently in learn mode
     */
    get isLearning() {
        return this.learning !== null;
    }
}

export default MidiManager;
