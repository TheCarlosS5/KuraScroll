import React, { useState, useEffect } from 'react';
import { Zap, Clock } from 'lucide-react';

export interface ReadingVelocityBadgeProps {
  userId?: string;
  seriesId?: string;
  defaultPages?: number;
  className?: string;
}

export const ReadingVelocityBadge: React.FC<ReadingVelocityBadgeProps> = ({
  userId = 'local_user',
  seriesId,
  defaultPages = 20,
  className = '',
}) => {
  const [ppm, setPpm] = useState<number>(1.7);
  const [chapterMins, setChapterMins] = useState<number>(4);
  const [confidence, setConfidence] = useState<string>('provisional');

  useEffect(() => {
    let isMounted = true;
    const fetchVelocity = async () => {
      try {
        const url = `/api/v1/analytics/reading-velocity?userId=${encodeURIComponent(userId)}${
          seriesId ? `&seriesId=${encodeURIComponent(seriesId)}` : ''
        }`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPpm(data.pagesPerMinute || 1.7);
            setConfidence(data.confidence || 'provisional');
            const spp = data.secondsPerPage || 35;
            setChapterMins(Math.max(1, Math.round((defaultPages * spp) / 60)));
          }
        }
      } catch {
        // Fallback
      }
    };

    fetchVelocity();
    return () => {
      isMounted = false;
    };
  }, [userId, seriesId, defaultPages]);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-900 border border-gray-800 text-gray-300 ${className}`}
      title={`Velocidad de lectura calculada por EMA (${confidence}): ${ppm} págs/min`}
      data-testid="reading-velocity-badge"
    >
      <Zap className="w-3.5 h-3.5 text-amber-400" />
      <span>{ppm} ppm</span>
      <span className="text-gray-600">·</span>
      <Clock className="w-3.5 h-3.5 text-cyan-400" />
      <span>~{chapterMins} min / cap</span>
    </div>
  );
};
