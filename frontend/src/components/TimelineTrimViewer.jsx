import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

function format(t) {
  if (t == null || !Number.isFinite(t)) return '--:--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TimelineTrimViewer({ asset, initialIn = 0, initialOut = null, imageDuration = 3, onSave, onClose }) {
  const videoRef = useRef(null);
  const [inTime, setInTime] = useState(initialIn);
  const [outTime, setOutTime] = useState(initialOut ?? (asset.type === 'image' ? imageDuration : null));
  const [duration, setDuration] = useState(asset.type === 'image' ? imageDuration : 0);
  const [current, setCurrent] = useState(initialIn);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (asset.type === 'image') {
      return undefined;
    }
    if (!video) return undefined;
    const onLoaded = () => {
      setDuration(video.duration || 0);
      setOutTime((prev) => (prev == null ? video.duration : prev));
      video.currentTime = initialIn;
    };
    video.addEventListener('loadedmetadata', onLoaded);
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, [asset.type, imageDuration, initialIn]);

  // Keep the playhead synced and loop between in/out while playing.
  useEffect(() => {
    const video = videoRef.current;
    if (asset.type === 'image') return undefined;
    if (!video) return undefined;
    const onTime = () => {
      setCurrent(video.currentTime);
      if (playing && outTime != null && video.currentTime >= outTime) {
        video.currentTime = inTime;
      }
    };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [asset.type, playing, inTime, outTime]);

  const seek = (value) => {
    const t = Number(value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrent(t);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (asset.type === 'image') {
      setPlaying((value) => !value);
      return;
    }
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < inTime || video.currentTime >= (outTime ?? video.duration)) {
        video.currentTime = inTime;
      }
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const pct = (t) => (duration ? Math.max(0, Math.min(100, (t / duration) * 100)) : 0);
  const validOut = outTime != null && outTime > inTime;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900/50">
        <div>
          <h2 className="text-white text-lg font-semibold">Trim: {asset.filename}</h2>
          <p className="text-gray-400 text-sm font-mono">
            In {format(inTime)} · Out {format(outTime)} · Dur {format(duration)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="ml-4 text-gray-400 hover:text-white text-2xl">✕</button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        {asset.type === 'image' ? (
          <img
            src={api.getImageUrl(asset)}
            alt={asset.filename}
            className="max-w-[90vw] max-h-[65vh] object-contain rounded-lg"
          />
        ) : (
          <video
            ref={videoRef}
            src={api.getFileUrl(asset._id)}
            controls
            preload="auto"
            className="max-w-[90vw] max-h-[65vh] object-contain rounded-lg"
          />
        )}
      </div>

      {/* Smooth scrub bar with in/out markers */}
      <div className="px-8 pb-4">
        <div className="relative h-8">
          {/* In/out range highlight */}
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-purple-500/40"
            style={{ left: `${pct(inTime)}%`, right: `${100 - pct(validOut ? outTime : duration)}%` }}
          />
          {/* In marker */}
          <div className="absolute top-0 h-8 w-0.5 bg-emerald-400" style={{ left: `${pct(inTime)}%` }} />
          {/* Out marker */}
          {validOut && (
            <div className="absolute top-0 h-8 w-0.5 bg-red-400" style={{ left: `${pct(outTime)}%` }} />
          )}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(current, duration || 1)}
            onChange={(e) => seek(e.target.value)}
            className="absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInTime(current)}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
          >
            Set In
          </button>
          <button
            type="button"
            onClick={() => setOutTime(current)}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500"
          >
            Set Out
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-500"
          >
            {playing ? 'Pause' : 'Play range'}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => validOut && onSave(inTime, outTime)}
            disabled={!validOut}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save trim
          </button>
        </div>
      </div>
    </div>
  );
}
