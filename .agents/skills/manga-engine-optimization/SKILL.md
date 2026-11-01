---
name: manga-engine-optimization
description: Deep technical guide for mechanical 4TB HDD streaming, libvips WebP image compression, SQLite WAL concurrent throughput, and virtualized browser DOM memory management.
---

# Manga Engine Optimization Skill Guide

Use this skill when tuning storage, processing pipelines, and data delivery for self-hosted graphic media servers.

## Optimization Axioms for Mechanical HDDs (4TB)

1. **Sequential Batch Ingestion vs. Random Read IOPS:**
   - Mechanical HDDs struggle with random seeks (~80 IOPS).
   - Ingestion pipelines must write sequentially to contiguous clusters.
   - Serve static images with aggressive HTTP caching (`Cache-Control: public, max-age=31536000, immutable`). Once a client requests an image, it is cached in the browser or OS cache, eliminating future mechanical disk head movements.
2. **Sharp / Libvips WebP Tuning:**
   - Quality: 82% lossy WebP provides imperceptible visual degradation from source PNG while slashing file sizes by ~85%.
   - Dimensions: Standardize max width to 1440px for desktop reading (retina clarity on 1080p screens) or 1080px for mobile.
   - Strip all non-essential EXIF, ICC profiles, and thumbnail metadata to save 5-15KB per page.
3. **SQLite WAL Mode & FTS5 Tuning:**
   - Always run `PRAGMA journal_mode = WAL;` and `PRAGMA synchronous = NORMAL;`.
   - SQLite FTS5 table with `unicode61` tokenizer indexes localized names with zero locking overhead for concurrent read queries.
4. **DOM Virtualization in Infinite Webtoon Scrolls:**
   - Long manhwa chapters often exceed 100 vertical panels.
   - Retaining 100 decoded 1440px WebP images in the active browser DOM consumes ~1.2GB of GPU/RAM memory.
   - Use windowed virtualization or dynamic unmounting: detach images farther than 3 viewports away from the active scroll position while maintaining physical placeholder height.
