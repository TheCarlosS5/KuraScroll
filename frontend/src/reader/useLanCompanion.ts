/**
 * KuraScroll LAN Companion Sync Hook
 * Sprint 69 - Direct Mobile Reader LAN Bridge & QR Pairing Management
 *
 * Provides reactive QR generation, active device polling,
 * session revocation, and companion status telemetry.
 * Hardware-tuned for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter, CLS = 0.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface PairedDevice {
  pairingId: string;
  deviceName?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop_companion' | 'unknown';
  clientIp: string;
  activePageNumber: number;
  pairedAt?: number;
  lastSeenAt?: number;
}

export interface UseLanCompanionOptions {
  apiBaseUrl?: string;
  autoRefreshIntervalMs?: number;
}

export interface UseLanCompanionResult {
  isOpen: boolean;
  isLoading: boolean;
  qrSvg: string | null;
  pairingUrl: string | null;
  pairingId: string | null;
  lanIp: string | null;
  port: number;
  expiresAt: number | null;
  activeDevices: PairedDevice[];
  error: string | null;
  openModal: () => void;
  closeModal: () => void;
  refreshQr: () => Promise<void>;
  revokeDevice: (pairingId: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
}

export function useLanCompanion(
  options: UseLanCompanionOptions = {}
): UseLanCompanionResult {
  const { apiBaseUrl = '', autoRefreshIntervalMs = 2500 } = options;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [port, setPort] = useState<number>(4000);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [activeDevices, setActiveDevices] = useState<PairedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveDevices = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/network/companion/active-devices`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.devices)) {
          setActiveDevices(data.devices);
        }
      }
    } catch {
      // Network silent fallback
    }
  }, [apiBaseUrl]);

  const createQrSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/network/qr-pair/create`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQrSvg(data.qrSvg);
          setPairingUrl(data.pairingUrl);
          setPairingId(data.pairingId);
          setLanIp(data.lanIp);
          setPort(data.port);
          setExpiresAt(data.expiresAt);
        }
      } else {
        setError('No se pudo generar el código QR.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de conexión LAN');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const openModal = useCallback(() => {
    setIsOpen(true);
    createQrSession();
    fetchActiveDevices();
  }, [createQrSession, fetchActiveDevices]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const refreshQr = useCallback(async () => {
    await createQrSession();
  }, [createQrSession]);

  const revokeDevice = useCallback(
    async (targetPairingId: string): Promise<boolean> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/network/companion/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairingId: targetPairingId }),
        });
        if (res.ok) {
          setActiveDevices((prev) =>
            prev.filter((d) => d.pairingId !== targetPairingId)
          );
          return true;
        }
      } catch {
        // Fallback
      }
      return false;
    },
    [apiBaseUrl]
  );

  // Poll for paired devices while modal is open
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    pollTimerRef.current = setInterval(() => {
      fetchActiveDevices();
    }, autoRefreshIntervalMs);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, autoRefreshIntervalMs, fetchActiveDevices]);

  return {
    isOpen,
    isLoading,
    qrSvg,
    pairingUrl,
    pairingId,
    lanIp,
    port,
    expiresAt,
    activeDevices,
    error,
    openModal,
    closeModal,
    refreshQr,
    revokeDevice,
    refreshDevices: fetchActiveDevices,
  };
}
