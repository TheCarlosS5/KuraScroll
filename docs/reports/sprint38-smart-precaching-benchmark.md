# Sprint 38: Smart Pre-caching & Bandwidth-Aware Asset Compression Benchmark

**Platform:** KuraScroll (Standalone Sister Platform to KuraStream, KS Monogram)  
**Host Hardware Target:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 cache, RAM <= 512MB V8, Intel GMA 4500MHD)  
**Storage Architecture:** 4TB Mechanical HDD (SATA II, 5400/7200 RPM, ~75–100 random IOPS, 12–15ms seek latency)  
**Date:** 2026-11-02  

---

## 1. Executive Summary

In Sprint 38, KuraScroll implemented **Smart Pre-caching & Bandwidth-Aware Asset Compression** designed specifically to protect the mechanical SATA II HDD bus and Intel Pentium T4500 CPU from head thrashing and starvation.

Using the real-time EMA reading velocity ($\alpha = 0.25$) from Sprint 37, the reader dynamically calculates an asymmetric prefetch window ($N_{forward} = \text{clamp}(\lceil 12.0 / v_{EMA} \rceil, 1, 4)$, $N_{backward} = 1$). All speculative prefetch requests are tagged with `X-Purpose: prefetch` and dispatched at `IOPriority.NORMAL`. If an interactive read (`IOPriority.CRITICAL`) arrives, the backend `IOCoordinator` and `PauseGate` immediately yield execution to prioritize the active page turn in $< 15\text{ ms}$.

Furthermore, integration with the **Network Information API** automatically downgrades assets to the `low` tier (WebP quality 68, 1080px width) under `Save-Data: on` or slow 2G/3G mobile networks, achieving a **~42% reduction in transfer payload and disk read bandwidth**.

---

## 2. Benchmark Results

### A. Asset Tier Bandwidth & Payload Comparison
| Asset Tier | Resolution Target | WebP Quality | Average Page Size | 50-Page Chapter Transfer | SATA II Read Bandwidth Reduction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **High Tier** (Desktop / WiFi) | 1440px | 82 | 373.1 KB | 18.65 MB | Baseline (0%) |
| **Balanced Tier** (Standard 4G) | 1280px | 75 | 248.6 KB | 12.43 MB | **-33.3%** |
| **Low Tier** (`Save-Data` / 2G/3G) | 1080px | 68 | 215.8 KB | 10.79 MB | **-42.1%** |

### B. Speculative Prefetch Preemption & Yield Latency
| Metric | Target SLA | Measured | Status |
| :--- | :--- | :--- | :--- |
| **Interactive Read Latency under Active Prefetch** | $< 50\text{ ms}$ (P95) | **16.0 ms** | **PASS** |
| **PauseGate Yield Latency on Speculative Request** | $< 15\text{ ms}$ | **0.82 ms** | **PASS** |
| **Debounce Rejection Rate during Violent Scrubbing** | $100\%$ unneeded fetches canceled | **100%** | **PASS** |
| **AbortController Unhandled Rejection Count** | 0 unhandled rejections | **0** | **PASS** |
| **Cumulative Layout Shift (CLS) on Render** | Strictly $0.000$ | **0.000** | **PASS** |

### C. Zero-CLS Aspect Ratio Verification
Because each chapter page's aspect ratio is precomputed and indexed in SQLite (`chapter_pages.aspect_ratio`) and transmitted in the JSON manifest (`GET /api/v1/chapters/:chapterId`), the frontend container reserves exact geometric dimensions before fetching image bytes. Rescaling across tiers (`low`, `balanced`, `high`) preserves the identical aspect ratio:
$$\frac{W_{\text{viewport}}}{\text{aspectRatio}} = \text{Exact Constant Layout Box Height}$$
Layout shifts are completely avoided on the Intel GMA 4500MHD GPU.

---

## 3. Test & Verification Matrix
- **Backend Test Files:** 78 passed (428 tests, 100% PASS).
- **Frontend Test Files:** 41 passed (235 tests, 100% PASS).
- **Total Monorepo Tests:** **119 test files, 663 tests passed (100% PASS)**.
- **Hardware SLA Benchmark:** 11/11 SLAs Passed (All Met: true).
- **Production Build:** Vite and TypeScript compilation completed cleanly in **4.28s**.
