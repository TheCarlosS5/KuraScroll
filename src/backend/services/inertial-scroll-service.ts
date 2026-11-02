/**
 * KuraScroll - Sprint 88: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller
 * 
 * Target Hardware: Intel Pentium T4500 (2C/2T) & Intel GMA 4500MHD.
 * Provides a zero-allocation spring-damper / friction decay kinematic model
 * that smooths jagged mouse-wheel notches into fluid 60 FPS gliding without event-loop overhead.
 */

import { DatabaseInstance } from '../db/database.js';

export interface InertialStepCalculationResult {
  nextPosition: number;
  nextVelocity: number;
  acceleration: number;
  displacement: number;
  isResting: boolean;
}

export interface InertialScrollProfile {
  seriesId: string;
  frictionCoefficient: number;
  mass: number;
  springTension: number;
  velocityClampPx: number;
  isEnabled: boolean;
  updatedAt: number;
}

export const INERTIAL_SCROLL_PRESETS = {
  smooth_glider: {
    id: 'smooth_glider',
    label: 'Smooth Glider (Webtoon Flow)',
    frictionCoefficient: 0.94,
    mass: 1.0,
    springTension: 100.0,
    velocityClampPx: 4000.0,
    description: 'Extended fluid gliding with minimal friction for continuous reading immersion',
  },
  natural_paper: {
    id: 'natural_paper',
    label: 'Natural Paper (Tactile Drag)',
    frictionCoefficient: 0.90,
    mass: 1.0,
    springTension: 150.0,
    velocityClampPx: 3000.0,
    description: 'Balanced tactile friction mimicking turning physical high-gsm book paper',
  },
  crisp_snap: {
    id: 'crisp_snap',
    label: 'Crisp Snap (Precision Control)',
    frictionCoefficient: 0.85,
    mass: 1.2,
    springTension: 220.0,
    velocityClampPx: 2500.0,
    description: 'High damping with snappy deceleration to prevent dialogue overshoot',
  },
} as const;

export class InertialScrollService {
  private db: DatabaseInstance;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  /**
   * Ultra-fast zero/minimal-allocation spring-damper step calculation.
   * Execution latency strictly < 20 microseconds (SLA 52).
   */
  public calculateInertialStep(
    currentPos: number,
    targetPos: number,
    velocity: number,
    friction: number = 0.92,
    springTension: number = 120.0,
    mass: number = 1.0,
    deltaTimeMs: number = 16.6667,
    velocityClampPx: number = 3500.0
  ): InertialStepCalculationResult {
    if (deltaTimeMs <= 0) {
      return {
        nextPosition: currentPos,
        nextVelocity: velocity,
        acceleration: 0,
        displacement: 0,
        isResting: true,
      };
    }

    // Guard dt to max 100ms to prevent simulation explosion on tab reactivation
    const dt = Math.min(0.1, deltaTimeMs / 1000);
    const clampedFriction = Math.max(0.5, Math.min(0.99, friction));
    const clampedMass = Math.max(0.1, mass);
    const displacement = currentPos - targetPos;

    // Hooke's Law spring restoring force
    const springForce = -springTension * displacement;
    const acceleration = springForce / clampedMass;

    // Kinematic Euler update with friction damping
    let nextVelocity = (velocity + acceleration * dt) * clampedFriction;
    nextVelocity = Math.max(-velocityClampPx, Math.min(velocityClampPx, nextVelocity));

    let nextPosition = currentPos + nextVelocity * dt;

    // Decay sleep check (sub-0.10px/s and sub-0.1px delta => rest)
    let isResting = false;
    if (Math.abs(nextVelocity) < 0.10 && Math.abs(nextPosition - targetPos) < 0.1) {
      nextPosition = targetPos;
      nextVelocity = 0;
      isResting = true;
    }

    return {
      nextPosition: parseFloat(nextPosition.toFixed(4)),
      nextVelocity: parseFloat(nextVelocity.toFixed(4)),
      acceleration: parseFloat(acceleration.toFixed(4)),
      displacement: parseFloat(displacement.toFixed(4)),
      isResting,
    };
  }

  /**
   * Retrieves profile for series or returns default.
   */
  public getProfile(seriesId: string): InertialScrollProfile {
    const row = this.db.prepare(`
      SELECT series_id, friction_coefficient, mass, spring_tension, velocity_clamp_px, is_enabled, updated_at
      FROM inertial_scroll_profiles
      WHERE series_id = ?
    `).get(seriesId) as {
      series_id: string;
      friction_coefficient: number;
      mass: number;
      spring_tension: number;
      velocity_clamp_px: number;
      is_enabled: number;
      updated_at: number;
    } | undefined;

    if (!row) {
      return {
        seriesId,
        frictionCoefficient: INERTIAL_SCROLL_PRESETS.natural_paper.frictionCoefficient,
        mass: INERTIAL_SCROLL_PRESETS.natural_paper.mass,
        springTension: INERTIAL_SCROLL_PRESETS.natural_paper.springTension,
        velocityClampPx: INERTIAL_SCROLL_PRESETS.natural_paper.velocityClampPx,
        isEnabled: true,
        updatedAt: 0,
      };
    }

    return {
      seriesId: row.series_id,
      frictionCoefficient: row.friction_coefficient,
      mass: row.mass,
      springTension: row.spring_tension,
      velocityClampPx: row.velocity_clamp_px,
      isEnabled: row.is_enabled === 1,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Upserts inertial scroll profile with bounds validation.
   */
  public setProfile(profile: InertialScrollProfile): InertialScrollProfile {
    const friction = Math.max(0.70, Math.min(0.99, parseFloat(profile.frictionCoefficient.toFixed(3))));
    const mass = Math.max(0.2, Math.min(5.0, parseFloat(profile.mass.toFixed(2))));
    const springTension = Math.max(10.0, Math.min(500.0, parseFloat(profile.springTension.toFixed(1))));
    const velocityClampPx = Math.max(500.0, Math.min(10000.0, parseFloat(profile.velocityClampPx.toFixed(1))));
    const isEnabled = profile.isEnabled ? 1 : 0;
    const updatedAt = Date.now();

    this.db.prepare(`
      INSERT INTO inertial_scroll_profiles (
        series_id, friction_coefficient, mass, spring_tension, velocity_clamp_px, is_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        friction_coefficient = excluded.friction_coefficient,
        mass = excluded.mass,
        spring_tension = excluded.spring_tension,
        velocity_clamp_px = excluded.velocity_clamp_px,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at
    `).run(
      profile.seriesId,
      friction,
      mass,
      springTension,
      velocityClampPx,
      isEnabled,
      updatedAt
    );

    return {
      seriesId: profile.seriesId,
      frictionCoefficient: friction,
      mass,
      springTension,
      velocityClampPx,
      isEnabled: isEnabled === 1,
      updatedAt,
    };
  }
}
