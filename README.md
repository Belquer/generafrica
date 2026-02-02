# GenerAfrica

Live African percussion jamming app powered by Google's Lyria RealTime API. AI-generated African drumming with real-time parameter control, prompt builder, and MIDI learn.

## Features

- **Prompt Builder**: 16 African instruments and 16 rhythm styles as selectable chips
- **Real-time Controls**: BPM, density, and brightness sliders
- **MIDI Learn**: Right-click any slider to assign a MIDI controller knob
- **Transport**: Play/Pause and Stop with smooth fade out
- **Audio Visualization**: Real-time frequency visualizer

## Instruments

Djembe, Dundun, Talking Drum, Shekere, Balafon, Kora, Udu, Bougarabou, Tama, Kalimba, Axatse, Ngoma, Bell, Caxixi, Mbira, Log Drum

## Rhythms

West African, Polyrhythm, Afrobeat, Soukous, Highlife, Mbalax, Gnawa, Juju, Makossa, Bikutsi, Kuku, Sinte, Kakilambe, Sabar, Mandiani, Isicathamiya

## Quick Start

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Double-click `start.command` to launch the local server
3. Enter your API key and start jamming!

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Esc` | Stop |
| `Up/Down` | Adjust BPM |
| `Left/Right` | Adjust Density |
| `Right-click` | MIDI Learn |
| `Shift+M` | Clear all MIDI mappings |

## Technical Details

- **API**: Google Lyria RealTime via WebSocket
- **Model**: `lyria-realtime-exp`
- **Audio**: 48kHz stereo, 16-bit PCM
- **MIDI**: Web MIDI API with persistent CC mappings (localStorage)
- **Config**: Full `musicGenerationConfig` sent on every update to prevent field resets

## Project Structure

```
generafrica/
├── index.html          # Main HTML structure
├── styles.css          # Dark theme styling
├── app.js              # Main application logic
├── lyria-client.js     # Lyria RealTime WebSocket client
├── audio-player.js     # Web Audio API player with fade out
├── midi-manager.js     # Web MIDI API learn & mapping
├── logo.png            # App logo
├── start.command       # macOS launcher (no-cache server)
└── README.md
```

## License

MIT
