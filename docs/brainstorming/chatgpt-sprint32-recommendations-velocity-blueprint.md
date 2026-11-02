# KuraScroll Sprint 32: Personalized Smart Recommendations & Reading Velocity Engine
**Host Profile:** Intel Pentium T4500 (2C/2T @ 2.30 GHz), 3–4GB RAM, 4TB SATA II HDD (5400 RPM), Intel GMA 4500MHD GPU.
**Source:** Autonomous Consultation with Senior ChatGPT via Brave MCP Session (`Colaboración en proyecto - Brave`).

---

## 1. Executive Summary & Design Constraints
1. **Zero-Disk Critical Path:** Recommendations and telemetry estimation must NEVER touch the mechanical 4TB HDD during active reading sessions. Calculations run against in-memory bitmask indexes and pre-aggregated SQLite tables.
2. **Sub-2ms Evaluation SLA:** Across a catalog of 5,000 to 10,000 series, candidate scoring must execute in under 2.0 ms on the legacy Penryn dual-core CPU.
3. **Integer-Quantized & Bitmask Indexing:** Instead of floating-point dense matrix multiplications or external ML libraries (no TensorFlow, no PyTorch), categories and themes are encoded as compact bitmasks (`uint16` / `uint32`), taking less than 30 KB in L2 cache.
4. **Bursting the "Filter Bubble":** 85% affinity scoring is paired with a 15% serendipity slot ("Salto de Dimensión / Descubrimiento") from unexpected genres to prevent recommendation fatigue.
5. **Anxiety-Free Velocity Estimates:** Instead of intimidating series-level totals ("18 hours remaining"), times are displayed on a per-chapter basis ("⏱️ ~4 min / cap") to motivate readers.

---

## 2. Content-Based Filtering & Weighted Jaccard Formula

### Dimension Weights ($W$)
- **Primary Genres & Demographics ($W_{\text{genre}} = 0.25$):** 16 canonical genres with Inverse Document Frequency (IDF) smoothing:
  $$w(t) = \ln\left(1 + \frac{N}{df(t)}\right)$$
- **Subgenres & Micro-Tropas ($W_{\text{theme}} = 0.35$):** 32 distinct tropes (`Isekai`, `Murim`, `Dungeon`, `System`, `Villainess`).
- **Reading Format Compatibility ($W_{\text{format}} = 0.15$):** Manhwa $\leftrightarrow$ Manhwa (1.0), Webtoon siblings (0.5), Traditional b/w manga cross (0.2).
- **Author / Artist Affinity ($W_{\text{creator}} = 0.25$):** Same author (+17.5%), same artist (+12.5%). Dynamic redistribution when creator is unknown.
- **Recency Half-Life Decay:**
  $$r_i = 2^{-d_i / 30}$$

### Weighted Jaccard Formulation:
$$J_W(A, B) = \frac{\sum_{t \in A \cap B} w(t)}{\text{Weight}(A) + \text{Weight}(B) - \sum_{t \in A \cap B} w(t)}$$

---

## 3. Reading Velocity Engine & Exponential Moving Average (EMA)
- **Zero-Allocation Outlier Filter:**
  - $t < 1.5\text{s}$: Skimming / page skipping $\rightarrow$ Ignored.
  - $t > 300\text{s}$: Idle tab / pause $\rightarrow$ Ignored.
- **EMA Smoother:**
  $$\text{EMA}_{\text{spp}} = \alpha \cdot \text{duration} + (1 - \alpha) \cdot \text{EMA}_{\text{spp}} \quad (\alpha = 0.25)$$
  $$\text{PPM} = \frac{60.0}{\text{EMA}_{\text{spp}}}$$
- **Confidence Tiers:**
  - $< 5$ samples: `'provisional'`
  - $5–24$ samples: `'stable'`
  - $\ge 25$ samples: `'expert'`

---

## 4. Intel GMA 4500MHD Visual Guidelines
- Zero `backdrop-filter: blur(...)` (triggers software fallback on GMA 4500MHD).
- Pure CSS `transform` and `opacity` transitions at 60fps.
- Accessible arrow key navigation for horizontal shelf scrolling.
