# GenerAfrica

Live African percussion jamming app powered by Google's Lyria RealTime API. AI-generated West African polyrhythmic drumming with real-time parameter control and MIDI learn.

## Features

- **African Percussion**: West African djembe ensemble, talking drums, dundun, shekere
- **Real-time Controls**: BPM, density, and brightness
- **MIDI Learn**: Right-click any parameter to assign a MIDI controller knob
- **Audio Visualization**: Frequency visualizer
- **Keyboard Shortcuts**: Designed for live performance

## Quick Start

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Double-click `start.command` to launch the server
3. Enter your API key and start jamming!

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `↑/↓` | Adjust BPM |
| `←/→` | Adjust density |
| `Right-click` | MIDI Learn |
| `Shift+M` | Clear all MIDI mappings |

## Technical Details

- **Audio Format**: 48kHz stereo, 16-bit PCM
- **API**: Google Lyria RealTime via WebSocket
- **MIDI**: Web MIDI API with persistent CC mappings

## Project Structure

```
generafrica/
├── index.html          # Main HTML structure
├── styles.css          # Dark theme styling
├── app.js              # Main application logic
├── lyria-client.js     # Lyria RealTime WebSocket client
├── audio-player.js     # Web Audio API player & visualizer
├── midi-manager.js     # Web MIDI API learn & mapping
├── logo.png            # App logo
├── start.command       # macOS launcher
└── README.md
```

## License

MIT
