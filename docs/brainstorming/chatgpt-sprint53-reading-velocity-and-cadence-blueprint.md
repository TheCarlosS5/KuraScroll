# Sprint 53 Blueprint: Continuous Background Reading Velocity & Dynamic Completion Time Predictor
**Senior ChatGPT & Swarm Architectural Blueprint**
*Host Architecture: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 Cache) | Storage: 4TB Mechanical HDD (SATA II) | GPU: Intel GMA 4500MHD*

---

## 1. Core Mathematical Model & Outlier Clamping

1. **Dual Independent Cadence Modalities:**
   - `manga`: Discrete page turning (RTL/LTR), normalized with Tankōbon two-page spreads (Sprint 51). Baseline cold-start: $24.0$ s/page ($2.5$ ppm).
   - `webtoon`: Continuous vertical scroll. Slices normalized by viewport height ($H_{viewport}$). Baseline cold-start: $12.0$ s/page ($5.0$ ppm).
   - `comic`: Western left-to-right dense panel layout. Baseline cold-start: $32.0$ s/page ($1.88$ ppm).

2. **Dwell Time Outlier Filtering:**
   - **Rapid Flipping Floor ($t < 1.5$ s):** Reader is skimming or looking for a specific panel. Dwell time is marked as rapid-flick and does NOT pull down the reading cadence.
   - **AFK Ceilings ($t > 180.0$ s):** Reader stepped away or was interrupted. Dwell time is clamped or discarded to avoid artificially inflating future estimates.
   - **Splash / Double Page Spread:** If aspect ratio $AR \ge 1.25$, sample time is divided by 2 before updating.

3. **Exponential Moving Average (EMA) Formulation:**
   $$\text{EMA}_{t} = \alpha \cdot t_{clamped} + (1 - \alpha) \cdot \text{EMA}_{t-1}$$
   - Fast calibration phase (first 5 samples): $\alpha = 0.25$
   - Steady-state phase: $\alpha = 0.15$
   - Execution complexity: $O(1)$, zero heap allocation, $< 0.005$ ms.

4. **Dynamic Completion Time Prediction:**
   $$T_{remaining} = \max(0, \text{totalUnits} - \text{currentUnit}) \times \text{EMA}_{spp}$$
