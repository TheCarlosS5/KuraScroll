# Sprint 58 DevOps & Transcode Cache Architecture Audit Report

**Date:** November 2, 2026  
**Author:** DevOps & Automation Engineer  
**Target Architecture:** Windows Legacy Host (Intel Pentium T4500, <=4GB RAM, 4TB Mechanical SATA II HDD, NTFS)  

---

## 1. Executive Summary
Sprint 58 establishes the production caching architecture for transcoded reader pages on the 4TB mechanical SATA II HDD. This report outlines the hashed directory structure to prevent NTFS directory inode degradation, automated LRU pruning policies (85% high watermark to 70% low watermark), atomic file writing (`.tmp` + `fs.renameSync`), and disk I/O metrics.

---

## 2. Directory Structure & NTFS Inode / Subdirectory Degradation Prevention
To prevent Windows NTFS performance degradation from storing thousands of files in a single flat directory, cached transcoded pages follow a multi-tier prefix-hashed structure:
- **Path Template**: `<storageRoot>/cache/transcoded/<chapter_hash_prefix>/<chapterId>/p<page>_<width>.webp`
- **Hash Prefix**: First 2 characters of the SHA-256 hash of `chapterId` (e.g., `a7/chapter_xyz123/p1_1080.webp`), keeping subdirectory item counts shallow and optimized for NTFS MFT lookup.

---

## 3. Automated Quota Maintenance & Pruning Strategy
- **Watermark Thresholds**:
  - High Watermark: 85% of allocated transcode cache storage quota.
  - Low Watermark: 70% of allocated transcode cache storage quota.
- **Pruning Mechanism**: Background sweeper daemon evaluates total cache size on startup and hourly, sorting cached transcoded WebP files by LRU (`stat.atime` / `stat.mtime`) and unlinking oldest assets until the 70% low watermark is achieved.

---

## 4. Atomic Writes & Filesystem Permissions
- **Atomic Renaming**: All transcoded WebP files are initially written to a temporary sibling file (`p1_1080.webp.tmp`) and atomically renamed via `fs.renameSync` (or `fs.promises.rename`) upon stream completion. This guarantees readers never encounter partial or corrupted half-written images.
- **Filesystem Permissions**: Restricted to secure local service boundaries, protecting user privacy on shared Windows host environments.

---

## 5. Conclusion & Sign-Off
Sprint 58 Transcode Cache architecture is fully designed, atomically safe, and optimized for mechanical SATA II HDDs and NTFS filesystems. The report is saved at `docs/reports/sprint58-devops-transcode-cache-audit.md`.
