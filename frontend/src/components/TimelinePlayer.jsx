import { useEffect, useRef } from 'react';
import { api } from '../api/client';

export default function TimelinePlayer({ assets, startIndex, onEnd, onExit, onNavigate, trims = {} }) {
  const videoRefs = useRef({});
  const index = Math.min(startIndex, assets.length - 1);
  const asset = assets[index];
  const trim = asset ? trims[asset._id] : null;

  const next = () => {
    if (index < assets.length - 1) onNavigate(index + 1);
    else onEnd();
  };

  const prev = () => {
    if (index > 0) onNavigate(index - 1);
  };

  // Auto-advance images after a fixed duration.
  useEffect(() => {
    if (!asset || asset.type === 'video') return;
    const timer = setTimeout(next, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, asset]);

  // Keep only the active video playing; pause the rest so they stay preloaded but quiet.
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video) return;
      if (id === asset?._id) {
        // Apply trim start when this clip becomes active.
        if (trim && trim.in != null && (video.currentTime < trim.in || video.currentTime >= trim.out)) {
          video.currentTime = trim.in;
        }
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [index, asset, trim]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, assets.length]);

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900/50">
        <h2 className="truncate text-white text-lg font-semibold">{asset.filename}</h2>
        <span className="text-gray-400 text-sm">{index + 1} / {assets.length}</span>
        <button
          type="button"
          onClick={onExit}
          className="ml-4 text-gray-400 hover:text-white text-2xl"
        >
          ✕
        </button>
      </div>

      {/* All media stay mounted (preloaded) so advancing is a seamless cut. */}
      <div className="flex flex-1 items-center justify-center p-4">
        {assets.map((item, i) => {
          const active = i === index;
          if (item.type === 'video') {
            const itemTrim = trims[item._id];
            return (
              <video
                key={item._id}
                ref={(el) => { videoRefs.current[item._id] = el; }}
                src={api.getFileUrl(item._id)}
                preload="auto"
                controls
                onEnded={next}
                onTimeUpdate={(e) => {
                  if (active && itemTrim && itemTrim.out != null && e.currentTarget.currentTime >= itemTrim.out) {
                    next();
                  }
                }}
                className={`max-w-[90vw] max-h-[80vh] object-contain rounded-lg ${active ? '' : 'hidden'}`}
              />
            );
          }
          return (
            <img
              key={item._id}
              src={api.getFileUrl(item._id)}
              alt={item.filename}
              className={`max-w-[90vw] max-h-[80vh] object-contain rounded-lg ${active ? '' : 'hidden'}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 px-6 py-3 bg-gray-900/50">
        <button type="button" onClick={prev} className="text-white text-2xl disabled:opacity-30" disabled={index === 0}>←</button>
        <button type="button" onClick={next} className="text-white text-2xl">→</button>
      </div>
    </div>
  );
}
