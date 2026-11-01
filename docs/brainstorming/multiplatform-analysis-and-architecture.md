# KuraScroll: Multi-Platform Architecture & Technical Synthesis

> **Collaborative Brainstorming Document**  
> **Author:** Antigravity AI Orchestrator & Multi-Agent Swarm  
> **Target:** KuraScroll (Sister Platform to KuraStream)

---

## 1. How the Giants Do It: Reverse-Engineering Top Manga & Manhwa Platforms

### 1.1. MangaDex
- **Image Delivery via MangaDex@Home (MD@H):** MangaDex uses a distributed peer-caching network. Clients request a chapter manifest containing page hashes. Images are served as WebP directly from regional caches with permanent TTLs.
- **Multilingual Search:** MangaDex indexes titles under language-tagged dictionaries (`title: { en: "..." }, altTitles: [ { "ja-ro": "..." }, { "ja": "..." } ]`). A single canonical UUID binds hundreds of localization aliases.
- **Library Organization:** Tag taxonomies are separated into:
  - *Format:* Manga, Manhwa, Manhua, Doujinshi.
  - *Demographic:* Shounen, Seinen, Shoujo, Josei.
  - *Content Rating:* Safe, Suggestive, Erotica.
  - *Tags/Themes:* Isekai, Reincarnation, Dungeon, Cultivation, Romance.

### 1.2. Webtoon (Naver / LINE)
- **Continuous Vertical Canvas:** Designed purely for mobile long-strips. Webtoon cuts art into vertical chunks of approximately 800px × 1280px to avoid GPU texture size limitations (WebGL textures historically had 2048px/4096px limits on mobile).
- **Progressive Strip Stitching:** Panels have a 0px vertical margin and seamless edge alignment.
- **Scroll Velocity Smoothing:** Uses requestAnimationFrame-driven dampening for seamless high-refresh-rate scrolling.

### 1.3. Tachiyomi / Mihon (Android Native Benchmark)
- **Local Cache & Split Ingestion:** Downloads chapters into discrete `.cbz` containers or subdirectories.
- **Reading Modes Supported:**
  - Webtoon (vertical continuous)
  - Left-to-Right (Western comic)
  - Right-to-Left (Traditional Japanese Manga)
  - Vertical (paginated top-to-bottom)
- **Frictionless Offline State:** Reads directly from SQLite database storing chapter read percentages, bookmarks, and custom reading categories.

---

## 2. Hard Drive (4TB HDD) Seek Optimization Strategy

When running locally with a mechanical 4TB hard drive:
1. **The HDD Seek Penalty:**
   - Mechanical drive heads physically seek between tracks (~10ms per seek). If 30 concurrent image requests hit different parts of the 4TB platter, throughput drops from 180MB/s sequential to < 2MB/s random IOPS.
2. **Mitigation Strategy Built into KuraScroll:**
   - **Ahead-of-Time WebP Ingestion:** Sharp converts pages into ~250KB WebP files.
   - **HTTP Immutable Caching:** `Cache-Control: public, max-age=31536000, immutable`. Browsers cache the active chapter in memory/SSD browser cache. The HDD is touched only ONCE per chapter.
   - **In-Memory Chapter Cache (LRU):** Fastify server caches the active chapter's manifest and first 5 pages in Node.js buffer memory for instant initial render.

---

## 3. Reader Experience Ergonomics & GSAP Enhancements

1. **Ambient Mood Lighting:**
   - Soft dynamic glow reflecting dominant panel tones onto the surrounding reader canvas (`rgba(0, 229, 255, 0.08)` to `rgba(139, 92, 246, 0.08)`).
2. **Smooth Page Turns with GSAP:**
   - 3D flip transform with subtle shadow easing (`power2.out`).
3. **Ergonomic Floating HUD:**
   - Fades out on scroll or tap, re-emerges instantly on hover or screen center tap.
