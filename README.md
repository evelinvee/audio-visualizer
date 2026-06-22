# 🎧 Audio Visualizer

Real-time music visualizers for the browser. Load a track or switch on your microphone and the canvas reacts to the sound — three wallpaper-style modes, full-screen, no dependencies. Built with the Web Audio API and Canvas 2D.

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-FF5722?logo=javascript&logoColor=white)
![Canvas](https://img.shields.io/badge/Canvas-2D-c05cff)
![License](https://img.shields.io/badge/license-MIT-c05cff)

## Visualizers

| Mode | Preview | Description |
| --- | --- | --- |
| **Aurora** | <img src="preview-spectrum.png" width="320"/> | A smooth mirrored ribbon that flows with the spectrum |
| **Orb** | <img src="preview-radial.png" width="320"/> | A glowing blob shaped by the spectrum, pulsing on the bass |
| **Particles** | <img src="preview-wave.png" width="320"/> | A drifting particle field that brightens and bursts on the beat |

Plus a reactive background that glows with the volume, and four colour themes.

## 🖥️ Use as a live wallpaper (Lively)

This is built for [**Lively Wallpaper**](https://github.com/rocksdanister/lively) — as a desktop wallpaper it reacts to your PC's **system audio** (whatever music or video is playing), with a clean, button-free screen.

### ⬇️ [Download](https://github.com/evelinvee/audio-wallpaper/archive/refs/heads/main.zip)

1. Unzip the folder.
2. In Lively, click **+** (Add wallpaper) → **Browse** and pick the folder's **`index.html`**.
3. Set it as your wallpaper. It now pulses to your system audio.

**Change settings in Lively's Customise panel** (no on-screen buttons needed):

- **Visualizer** — Aurora · Orb · Particles
- **Palette** — Sunset · Pink · Amber · Violet
- **Sensitivity** — how strongly it reacts
- **Show on-screen controls** — off by default for a clean desktop

When running as a wallpaper the control bar hides automatically.

## In a browser

Open `index.html` and it shows the idle animation. Browsers can't read system audio, so for sound there click **Track** to load a file or **Mic** for your microphone (serve the folder via a local server — mics need a secure context — e.g. `python -m http.server`).

## Tech

Vanilla **JavaScript** · **Web Audio API** (AnalyserNode, FFT) · **Canvas 2D** · HTML · CSS.

## License

MIT © [evelinvee](https://github.com/evelinvee)
