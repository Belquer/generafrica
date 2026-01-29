/**
 * Percussion Style Presets
 * Curated prompts and configurations for different percussion styles
 */

export const PERCUSSION_PRESETS = {
    african: {
        name: 'African',
        emoji: '🌍',
        prompts: [
            { text: 'West African djembe drums, polyrhythmic patterns, talking drums', weight: 1.0 },
            { text: 'Energetic tribal percussion, dundun bass drum, shekere shaker', weight: 0.8 }
        ],
        config: {
            density: 0.7,
            brightness: 0.6,
            bpm: 110
        },
        description: 'Traditional West African polyrhythms with djembe and talking drums'
    },

    latin: {
        name: 'Latin',
        emoji: '💃',
        prompts: [
            { text: 'Latin percussion, conga drums, bongo, timbales, salsa rhythm', weight: 1.0 },
            { text: 'Cuban son montuno, guiro, claves, cowbell, syncopated grooves', weight: 0.7 }
        ],
        config: {
            density: 0.65,
            brightness: 0.7,
            bpm: 95
        },
        description: 'Hot Latin rhythms with congas, bongos, and timbales'
    },

    electronic: {
        name: 'Electronic',
        emoji: '🎛️',
        prompts: [
            { text: 'Electronic drums, 808 kick, crisp hi-hats, synthetic percussion', weight: 1.0 },
            { text: 'Techno beats, modular synth percussion, glitchy rhythms', weight: 0.6 }
        ],
        config: {
            density: 0.5,
            brightness: 0.8,
            bpm: 128
        },
        description: 'Modern electronic drums with 808s and synthesized percussion'
    },

    jazz: {
        name: 'Jazz Brushes',
        emoji: '🎷',
        prompts: [
            { text: 'Jazz brushes on snare, subtle ride cymbal, soft kick drum', weight: 1.0 },
            { text: 'Swing rhythm, bebop drums, tasteful ghost notes, dynamic playing', weight: 0.8 }
        ],
        config: {
            density: 0.4,
            brightness: 0.5,
            bpm: 140
        },
        description: 'Sophisticated jazz drumming with brushes and subtle dynamics'
    },

    rock: {
        name: 'Rock',
        emoji: '🎸',
        prompts: [
            { text: 'Rock drums, powerful kick and snare, crashing cymbals', weight: 1.0 },
            { text: 'Hard hitting drums, tom fills, driving 4/4 beat, arena rock', weight: 0.7 }
        ],
        config: {
            density: 0.6,
            brightness: 0.65,
            bpm: 120
        },
        description: 'Powerful rock drumming with driving beats and fills'
    },

    world: {
        name: 'World Fusion',
        emoji: '🪘',
        prompts: [
            { text: 'World percussion fusion, frame drum, cajon, tabla, udu drum', weight: 1.0 },
            { text: 'Ethnic percussion ensemble, hang drum, kalimba rhythms, organic textures', weight: 0.6 }
        ],
        config: {
            density: 0.55,
            brightness: 0.5,
            bpm: 100
        },
        description: 'Global percussion fusion with frame drums, tabla, and cajon'
    },

    minimal: {
        name: 'Minimal',
        emoji: '◯',
        prompts: [
            { text: 'Minimal percussion, sparse rhythmic patterns, subtle clicks and pops', weight: 1.0 },
            { text: 'Ambient rhythm, breath-like percussion, micro-rhythms', weight: 0.5 }
        ],
        config: {
            density: 0.2,
            brightness: 0.4,
            bpm: 90
        },
        description: 'Sparse, meditative percussion with subtle textures'
    },

    ambient: {
        name: 'Ambient',
        emoji: '🌊',
        prompts: [
            { text: 'Ambient percussion, ethereal textures, gentle mallets on metal', weight: 1.0 },
            { text: 'Atmospheric drums, reverberant spaces, distant thunder, rain sticks', weight: 0.7 }
        ],
        config: {
            density: 0.25,
            brightness: 0.35,
            bpm: 70
        },
        description: 'Atmospheric and ethereal percussion soundscapes'
    }
};

/**
 * Get a preset by its key
 */
export function getPreset(key) {
    return PERCUSSION_PRESETS[key] || null;
}

/**
 * Get all preset keys
 */
export function getPresetKeys() {
    return Object.keys(PERCUSSION_PRESETS);
}

/**
 * Blend multiple presets together
 * @param {Array} selections - Array of {key, weight} objects
 * @returns {Object} Blended prompts and averaged config
 */
export function blendPresets(selections) {
    if (!selections || selections.length === 0) {
        return null;
    }

    const blendedPrompts = [];
    let totalWeight = 0;
    let avgBpm = 0;
    let avgDensity = 0;
    let avgBrightness = 0;

    selections.forEach(({ key, weight = 1.0 }) => {
        const preset = PERCUSSION_PRESETS[key];
        if (!preset) return;

        // Add prompts with adjusted weights
        preset.prompts.forEach(prompt => {
            blendedPrompts.push({
                text: prompt.text,
                weight: prompt.weight * weight
            });
        });

        // Accumulate config values
        totalWeight += weight;
        avgBpm += preset.config.bpm * weight;
        avgDensity += preset.config.density * weight;
        avgBrightness += preset.config.brightness * weight;
    });

    if (totalWeight === 0) {
        return null;
    }

    // Normalize averages
    return {
        prompts: blendedPrompts,
        config: {
            bpm: Math.round(avgBpm / totalWeight),
            density: avgDensity / totalWeight,
            brightness: avgBrightness / totalWeight
        }
    };
}

/**
 * Create a custom prompt with percussion focus
 */
export function createPercussionPrompt(text) {
    // Enhance the prompt with percussion keywords if needed
    const percussionKeywords = ['drum', 'percussion', 'rhythm', 'beat', 'kick', 'snare', 'cymbal', 'hi-hat'];
    const hasPercussionKeyword = percussionKeywords.some(keyword =>
        text.toLowerCase().includes(keyword)
    );

    if (hasPercussionKeyword) {
        return [{ text, weight: 1.0 }];
    }

    // Add percussion context to non-percussion prompts
    return [
        { text: `Percussion and drums with: ${text}`, weight: 1.0 }
    ];
}

export default PERCUSSION_PRESETS;
