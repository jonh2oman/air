# ✈️ AeroCadet STEM — RCAC Flight Academy

An interactive aviation ground school web application designed for Royal Canadian Air Cadets (RCAC) and aviation enthusiasts. Ground school concepts are aligned with *From the Ground Up*, Transport Canada TP 11919 (PSTAR), and the Air Cadet Gliding Program (ACGP).

## 🚀 Interactive Modules

- **Virtual Wind Tunnel & Aerodynamics Lab**: Angle of attack, Bernoulli lift vs drag vectors, camber, and stall dynamics.
- **Flight Controls 3D**: Primary control surfaces (ailerons, elevator, rudder) and axis of rotation visualizations.
- **Six-Pack Cockpit Trainer**: Gyroscopic and pitot-static flight instruments (Airspeed, Attitude, Altimeter, Turn Coordinator, Heading, Vertical Speed).
- **Airport Circuit & Pattern Lab**: Standard circuit patterns (upwind, crosswind, downwind, base, final) and light gun signals.
- **Radio Comms & Phonetics (EO M129.01)**: Standard NATO/ICAO phonetic alphabet and numbers, custom callsign & name speller, avionics VHF radio stack with real-time NOAA Gander (CYQX) ATIS, animated tactile PTT trigger, and interactive Canadian ATC phraseology game.
- **Weight & Balance Lab**: Centre of gravity envelope calculations, arm, moments, and fuel burn adjustments.
- **Flight Computer (E6B)**: Wind correction angle, ground speed, crosswind components, and true airspeed computations.
- **3D Flight Simulator**: Interactive Three.js cockpit and flight simulation.
- **Cadet Wings Exam Challenge**: Practice quizzes and mock PSTAR exam scenarios with audio feedback and celebratory effects.

## 🛠️ Tech Stack

- **React 18** with **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Three.js** (3D graphics)
- **Lucide Icons** & **Canvas Confetti**
- Web Audio API synthesizer for sound effects

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or newer)
- npm or yarn

### Installation

```bash
git clone <your-repo-url>
cd cadet-flight-academy
npm install
```

### Development Server

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

The compiled output will be generated in the `dist/` directory.

## 🌐 Deploying to GitHub Pages

This project is pre-configured for GitHub Pages:

1. **Push this repository to GitHub** (default branch: `main`).
2. In your GitHub repository, go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
4. The included [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) workflow will automatically build and publish the site on push!
