# KuraScroll

> High-performance, hardware-sympathetic manga, manhwa, and webtoon reader platform built for local self-hosting on low-resource hardware.

KuraScroll is the dedicated reading platform and sister ecosystem to [**KuraStream**](https://github.com/TheCarlosS5/KuraStream) (anime and cinema streaming platform by [@TheCarlosS5](https://github.com/TheCarlosS5)).

---

## Architecture & Engineering Philosophy

KuraScroll is engineered under strict hardware constraints to deliver a fluid 60 FPS reading experience on vintage and power-efficient host machines without sacrificing fidelity, responsiveness, or visual elegance.

### 1. Minimalist Design System
- **Zero-Emoji Interface**: Fully eradicated emojis in favor of crisp typography, subtle monochromatic palettes, and Lucide React SVG iconography inspired by Emil Kowalski's design engineering standards.
- **Distraction-Free HUDs**: Floating heads-up displays with high-contrast labels, microsecond telemetries, and tactile feedback.

### 2. Hardware Profiles & Budgets
- **Host CPU**: Optimized for dual-core budget processors (e.g. Intel Pentium T4500 @ 2.30 GHz, 1MB L2 cache). V8 heap and RSS are bounded to $\le$ 512 MB. No runtime server-side image transcoding on request paths.
- **Host GPU**: Engineered for integrated legacy graphics (e.g. Intel GMA 4500MHD). Zero CSS backdrop-filter blurs, zero layout shifts (CLS = 0), and hardware-accelerated CSS containment (`contain: layout paint`).
- **Storage Subsystem**: Tuned for mechanical drives (e.g. 4TB 5400 RPM SATA II HDD). Single-threaded batch reads (`concurrency = 1`), 64 KB chunked streams, and a Platter Locality Index (PLI) to eliminate disk head thrashing.

### 3. Core Tech Stack
- **Backend**: Fastify 5, TypeScript 5, SQLite 3 (WAL mode, `synchronous=NORMAL`, `temp_store=MEMORY`), Vitest.
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React, Virtualized Chapter Scroller.
- **Search & Indexing**: SQLite FTS5 full-text search with CJK trigram tokenizers and prefix indexing.

---

## 98 Hardware SLAs (100% Passing)

KuraScroll enforces 98 automated microsecond-level hardware SLAs benchmarked against low-resource baselines:

| Domain | Highlighted SLA Implementations | Latency Target |
| :--- | :--- | :--- |
| **Storage & I/O** | 64KB Chunked Stream Copy & SHA-256 Hashing | $< 100\text{ ms}$ |
| **Search Engine** | FTS5 1-Kanji Prefix Search & Japanese Title Matches | $< 5.0\text{ ms}$ |
| **Database** | SQLite Primary Key Point Lookup & Cached Read Index | $< 0.25\text{ ms}$ |
| **Reading Optics** | Dynamic Tone Mapping, Eye Care Blue-Light Filtering | $< 0.05\text{ ms}$ |
| **Screentone & Print** | Adaptive Moiré De-Aliasing & CMYK Density Simulation | $< 0.02\text{ ms}$ |
| **Ink & Material** | Dynamic Ink Splatter, Feathering Bleed, Cellulose Relief | $< 0.02\text{ ms}$ |
| **Acoustics & SFX** | Parametric Acoustic Reverb & Spatial Audio Attenuation | $< 0.02\text{ ms}$ |
| **Navigation & Motion**| Boustrophedon Camera Framing & Kinetic Deblur | $< 0.02\text{ ms}$ |

---

## Getting Started

### Cloud Community Deployment

KuraScroll includes an optional public community mode with user accounts, profiles, manga publishing, chapter comments, moderation, and a Docker Compose deployment for a single server with persistent storage. Start with [DEPLOY.md](DEPLOY.md) and the [implementation plan](docs/superpowers/plans/2026-11-05-cloud-community-master-plan.md). A live deployment still requires a host, HTTPS domain, production secrets, and (if enabled) SMTP credentials.

### Prerequisites
- Node.js 22.x or higher (the backend uses `node:sqlite`)
- npm 10.x or higher
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TheCarlosS5/KuraScroll.git
   cd KuraScroll
   ```

2. **Install backend and frontend dependencies:**
   ```bash
   npm install
   npm --prefix frontend install
   ```

3. **Seed demo library:**
   ```bash
   npm run seed:demo
   ```

4. **Start development servers:**
   ```bash
   # Starts Fastify backend (port 3000) and Vite frontend (port 5173)
   npm run dev
   ```

5. Open your browser at `http://localhost:5173`.

---

## Verification & Testing

KuraScroll maintains a comprehensive test suite across the backend, frontend, and hardware benchmarks:

```bash
# Run backend unit and integration test suite (292 files / 1663 tests)
npm test

# Run frontend unit and component test suite (220 files / 957 tests)
npm run test:frontend

# Run 98-point Hardware SLA benchmark harness
npm run test:sla
```

---

## Sister Project

Check out **[KuraStream](https://github.com/TheCarlosS5/KuraStream)** for streaming anime, movies, and TV series under the same lightweight self-hosted philosophy.

---

## Author & License

Created by **Carlos Stiven Gutierrez Ramirez** ([@TheCarlosS5](https://github.com/TheCarlosS5)).

Licensed under the MIT License.
