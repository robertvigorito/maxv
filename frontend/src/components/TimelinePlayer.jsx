import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import AnnotationOverlay from './AnnotationOverlay';

const IMAGE_DURATION = 3;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function getRange(asset, trim, durationOverride = 0) {
  const duration = asset.type === 'image' ? IMAGE_DURATION : Number(asset.duration) || durationOverride;
  const inTime = Math.max(0, Math.min(Number(trim?.in) || 0, duration));
  const requestedOut = trim?.out == null ? duration : Number(trim.out);
  const outTime = Math.max(inTime, Math.min(Number.isFinite(requestedOut) ? requestedOut : duration, duration));
  return { duration, inTime, outTime };
}

export default function TimelinePlayer({ assets, startIndex, onEnd, onExit, onNavigate, onAnnotationSaved, trims = {} }) {
  const videoRefs = useRef([null, null]);
  const loadedSources = useRef(['', '']);
  const activeSlotRef = useRef(0);
  const advancedRef = useRef(false);
  const pendingOffsetRef = useRef(0);
  const timeUpdateFrameRef = useRef(null);
  const latestTimeRef = useRef(0);
  const [activeSlot, setActiveSlot] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaStatus, setMediaStatus] = useState('loading');
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const index = Math.max(0, Math.min(startIndex, assets.length - 1));
  const asset = assets[index];
  const nextAsset = assets[index + 1];
  const range = useMemo(() => (asset ? getRange(asset, trims[asset._id]) : null), [asset, trims]);
  const timelineRanges = useMemo(() => assets.map((item) => getRange(item, trims[item._id])), [assets, trims]);
  const totalDuration = timelineRanges.reduce((sum, itemRange) => sum + Math.max(0, itemRange.outTime - itemRange.inTime), 0);
  const timelineOffset = timelineRanges.slice(0, index).reduce((sum, itemRange) => sum + Math.max(0, itemRange.outTime - itemRange.inTime), 0) + currentTime;
  const timelineProgress = totalDuration ? Math.min(100, timelineOffset / totalDuration * 100) : 0;

  const loadVideo = useCallback((slot, item) => {
    const video = videoRefs.current[slot];
    if (!video || !item || item.type !== 'video') return;
    const source = api.getFileUrl(item._id);
    if (loadedSources.current[slot] === source) return;
    video.pause();
    video.src = source;
    loadedSources.current[slot] = source;
    video.load();
  }, []);

  const playVideo = useCallback((video, item, offset = 0) => {
    if (!video || !item || !range || !playing) return;
    const itemRange = getRange(item, trims[item._id], video.duration);
    const target = itemRange.inTime + offset;
    if (Math.abs(video.currentTime - target) > 0.05) video.currentTime = target;
    video.muted = muted;
    video.play().then(() => setMediaStatus('playing')).catch(() => {
      setMediaStatus(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 'blocked' : 'loading');
    });
  }, [muted, playing, range, trims]);

  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    const nextIndex = index + 1;
    if (nextIndex >= assets.length) {
      onEnd();
      return;
    }
    // The next slot is already decoding. Swap it before changing the React index.
    const nextSlot = 1 - activeSlotRef.current;
    activeSlotRef.current = nextSlot;
    setActiveSlot(nextSlot);
    pendingOffsetRef.current = 0;
    setCurrentTime(0);
    onNavigate(nextIndex);
  }, [assets.length, index, onEnd, onNavigate]);

  const previous = useCallback(() => {
    if (index > 0) {
      pendingOffsetRef.current = 0;
      setCurrentTime(0);
      onNavigate(index - 1);
    }
  }, [index, onNavigate]);

  useEffect(() => {
    if (!asset) return undefined;
    advancedRef.current = false;
    setCurrentTime(0);
    setMediaStatus('loading');
    setBufferedPercent(asset.type === 'image' ? 100 : 0);
    const current = activeSlotRef.current;
    const standby = 1 - current;
    loadVideo(current, asset);
    loadVideo(standby, nextAsset);
    return () => videoRefs.current[current]?.pause();
  }, [asset, index, loadVideo, nextAsset]);

  useEffect(() => {
    if (!asset || asset.type !== 'video' || !playing) return undefined;
    const video = videoRefs.current[activeSlotRef.current];
    if (video?.readyState >= HTMLMediaElement.HAVE_METADATA) {
      playVideo(video, asset, pendingOffsetRef.current);
      pendingOffsetRef.current = 0;
    }
    return undefined;
  }, [activeSlot, asset, index, playVideo, playing]);

  useEffect(() => {
    if (!asset || asset.type === 'video' || !playing || advancedRef.current) return undefined;
    const duration = Math.max(0, range.outTime - range.inTime);
    const startedAt = performance.now() - currentTime * 1000;
    const interval = setInterval(() => setCurrentTime(Math.min(duration, (performance.now() - startedAt) / 1000)), 50);
    const timer = setTimeout(advance, Math.max(0, duration - currentTime) * 1000);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [advance, asset, currentTime, index, playing, range]);

  const seekTimeline = (event) => {
    if (!totalDuration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const targetTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * totalDuration;
    let elapsed = 0;
    for (let targetIndex = 0; targetIndex < timelineRanges.length; targetIndex += 1) {
      const targetRange = timelineRanges[targetIndex];
      const duration = Math.max(0, targetRange.outTime - targetRange.inTime);
      if (targetTime <= elapsed + duration || targetIndex === timelineRanges.length - 1) {
        const offset = Math.max(0, Math.min(duration, targetTime - elapsed));
        if (targetIndex !== index) {
          activeSlotRef.current = 0;
          setActiveSlot(0);
          onNavigate(targetIndex);
          pendingOffsetRef.current = offset;
        }
        setCurrentTime(offset);
        if (targetIndex === index && asset.type === 'video') playVideo(videoRefs.current[activeSlotRef.current], asset, offset);
        return;
      }
      elapsed += duration;
    }
  };

  const playActiveMedia = () => {
    setPlaying(true);
    if (asset.type === 'video') playVideo(videoRefs.current[activeSlotRef.current], asset, currentTime);
    else setMediaStatus('playing');
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onExit();
      else if (event.key === 'ArrowRight') advance();
      else if (event.key === 'ArrowLeft') previous();
      else if (event.key === ' ') { event.preventDefault(); if (playing) setPlaying(false); else playActiveMedia(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => () => videoRefs.current.forEach((video) => video?.pause()), []);

  useEffect(() => () => {
    if (timeUpdateFrameRef.current !== null) cancelAnimationFrame(timeUpdateFrameRef.current);
  }, []);

  if (!asset) return null;
  const elapsed = Math.min(currentTime, range.outTime - range.inTime);
  const renderVideo = (slot, item, visible) => item?.type === 'video' ? (
    <video
      key={`${slot}-${item._id}`}
      ref={(element) => { videoRefs.current[slot] = element; }}
      src={api.getFileUrl(item._id)}
      preload="auto"
      playsInline
      muted={muted}
      className={`${visible ? '' : 'hidden'} max-h-[80vh] max-w-[90vw] rounded-lg object-contain`}
      onLoadStart={() => visible && setMediaStatus('loading')}
      onLoadedMetadata={(event) => {
        const itemRange = getRange(item, trims[item._id], event.currentTarget.duration);
        event.currentTarget.currentTime = itemRange.inTime;
      }}
      onLoadedData={(event) => visible && playVideo(event.currentTarget, item, currentTime)}
      onCanPlay={(event) => visible && playVideo(event.currentTarget, item, currentTime)}
      onProgress={(event) => {
        if (!visible || !event.currentTarget.duration || !event.currentTarget.buffered.length) return;
        const end = event.currentTarget.buffered.end(event.currentTarget.buffered.length - 1);
        setBufferedPercent(Math.min(100, end / event.currentTarget.duration * 100));
      }}
      onPlaying={() => visible && setMediaStatus('playing')}
      onWaiting={() => visible && setMediaStatus('buffering')}
      onPause={(event) => visible && !event.currentTarget.ended && !advancedRef.current && setMediaStatus('paused')}
      onError={() => visible && setMediaStatus('error')}
      onTimeUpdate={(event) => {
        if (!visible) return;
        const itemRange = getRange(item, trims[item._id], event.currentTarget.duration);
        latestTimeRef.current = Math.max(0, event.currentTarget.currentTime - itemRange.inTime);
        if (timeUpdateFrameRef.current === null) {
          timeUpdateFrameRef.current = requestAnimationFrame(() => {
            timeUpdateFrameRef.current = null;
            setCurrentTime(latestTimeRef.current);
          });
        }
        if (event.currentTarget.currentTime >= itemRange.outTime - 0.03) advance();
      }}
      onEnded={() => visible && advance()}
    />
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between bg-gray-900/50 px-6 py-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-white">{asset.filename}</h2><p className="text-xs text-gray-400">{playing ? 'Playing' : 'Paused'} · {formatTime(elapsed)} / {formatTime(range.outTime - range.inTime)}</p></div>
        <div className="flex items-center gap-2 text-xs"><span className={mediaStatus === 'error' || mediaStatus === 'blocked' ? 'text-red-300' : mediaStatus === 'loading' || mediaStatus === 'buffering' ? 'text-yellow-300' : 'text-emerald-300'}>{mediaStatus === 'loading' && 'Loading'}{mediaStatus === 'buffering' && 'Buffering'}{mediaStatus === 'blocked' && 'Click Play'}{mediaStatus === 'error' && 'Media unavailable'}{mediaStatus === 'playing' && 'Playing'}{mediaStatus === 'paused' && 'Paused'}</span>{asset.type === 'video' && <span className="text-gray-500">Cache {Math.round(bufferedPercent)}%</span>}</div>
        <span className="text-sm text-gray-400">{index + 1} / {assets.length}</span><button type="button" onClick={onExit} title="Close player" className="ml-4 text-2xl text-gray-400 hover:text-white">✕</button>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-4">
        {asset.type === 'video' ? renderVideo(activeSlot, asset, true) : <img src={api.getImageUrl(asset)} alt={asset.filename} onLoad={() => setMediaStatus('playing')} onError={() => setMediaStatus('error')} className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain" />}
        {renderVideo(1 - activeSlot, nextAsset, false)}
        <AnnotationOverlay assetId={asset._id} currentTime={elapsed} onSaved={onAnnotationSaved} />
      </div>
      <div className="bg-gray-900/80 px-6 py-3">
        <div role="slider" aria-label="Seek complete timeline" aria-valuemin="0" aria-valuemax={totalDuration} aria-valuenow={Math.min(timelineOffset, totalDuration)} tabIndex="0" onClick={seekTimeline} className="relative mx-auto mt-3 flex h-3 max-w-4xl cursor-pointer gap-px overflow-hidden rounded bg-gray-800">{timelineRanges.map((itemRange, itemIndex) => { const duration = Math.max(0, itemRange.outTime - itemRange.inTime); return <div key={assets[itemIndex]._id} className={`h-full ${itemIndex === index ? 'bg-purple-500' : 'bg-gray-600'}`} style={{ width: `${totalDuration ? duration / totalDuration * 100 : 0}%` }} />; })}<span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white" style={{ left: `${timelineProgress}%` }} /></div>
        <div className="mx-auto mt-1 flex max-w-4xl justify-between font-mono text-xs text-gray-400"><span>{formatTime(timelineOffset)}</span><span>{formatTime(totalDuration)}</span></div>
        <div className="mt-3 flex items-center justify-center gap-3"><button type="button" onClick={previous} disabled={index === 0} title="Previous clip" className="flex h-9 w-9 items-center justify-center rounded text-xl text-white hover:bg-gray-800 disabled:opacity-30">←</button><button type="button" onClick={playing ? () => setPlaying(false) : playActiveMedia} className="min-w-20 rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">{playing ? 'Pause' : 'Play'}</button><button type="button" onClick={advance} title="Next clip" className="flex h-9 w-9 items-center justify-center rounded text-xl text-white hover:bg-gray-800">→</button><button type="button" onClick={() => { setMuted((value) => !value); if (videoRefs.current[activeSlotRef.current]) videoRefs.current[activeSlotRef.current].muted = !muted; }} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">{muted ? 'Unmute' : 'Mute'}</button></div>
      </div>
    </div>
  );
}
