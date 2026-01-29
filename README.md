# Percussion Jam

A live percussion jamming app powered by Google's Lyria RealTime API. Create, mix, and perform AI-generated percussion in real-time.

## Features

- **8 Percussion Styles**: African, Latin, Electronic, Jazz, Rock, World Fusion, Minimal, and Ambient
- **Style Blending**: Combine multiple styles for unique sounds
- **Real-time Controls**: Adjust BPM, density, brightness, and scale on the fly
- **Audio Visualization**: See your beats come alive with a frequency visualizer
- **Keyboard Shortcuts**: Designed for live performance
- **Custom Prompts**: Describe your own percussion style

## Quick Start

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)

2. Double-click `start.command` to launch the server, or run manually:

   ```bash
   python3 -m http.server 8000
   ```

3. Open `http://localhost:8000` in your browser (opens automatically with start.command)

4. Enter your API key and start jamming!

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Escape` | Stop |
| `1-8` | Toggle percussion styles |
| `↑/↓` | Adjust BPM |
| `←/→` | Adjust density |
| `C` | Clear style blend |

## Percussion Styles

| Style | Description |
|-------|-------------|
| African | West African polyrhythms with djembe and talking drums |
| Latin | Hot Latin rhythms with congas, bongos, and timbales |
| Electronic | Modern 808s and synthesized percussion |
| Jazz Brushes | Sophisticated jazz drumming with subtle dynamics |
| Rock | Powerful driving beats with fills |
| World Fusion | Global percussion with frame drums, tabla, and cajon |
| Minimal | Sparse, meditative percussion |
| Ambient | Atmospheric and ethereal soundscapes |

## Technical Details

- **Audio Format**: 48kHz stereo, 16-bit PCM
- **Latency**: ~2 seconds from control change to effect
- **Session Limit**: 10 minutes (reconnect to continue)
- **API**: Google Lyria RealTime via WebSocket

## Project Structure

```
musica_in_machina/
├── index.html           # Main HTML structure
├── styles.css           # Styling with dark theme
├── app.js               # Main application logic
├── lyria-client.js      # Lyria RealTime WebSocket client
├── audio-player.js      # Web Audio API player & visualizer
├── percussion-presets.js # Style presets and blending
└── README.md
```

## Browser Support

Requires a modern browser with:
- Web Audio API
- WebSocket support
- ES Modules

Tested on Chrome, Firefox, Safari, and Edge.

## License

MIT
