import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function AssetBubble({ asset, onClick, onOpen, onContextMenu, selected = false, query = '', size = 200, dragIds = [], dragPaths = [], onHoverChange }) {
  const videoRef = useRef(null);
  const bubbleRef = useRef(null);
  const infoTimerRef = useRef(null);
  const pendingRatioRef = useRef(null);
  const rafRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [infoPos, setInfoPos] = useState(null);
  const showVideoPreview = asset.type === 'video' && hovering;

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
  }, []);

  // Hide the metadata tooltip (and cancel a pending one) if the grid scrolls
  // while hovering.
  useEffect(() => {
    if (!hovering) return;
    const hide = () => {
      setInfoPos(null);
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
        infoTimerRef.current = null;
      }
    };
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [hovering]);

  const handleMouseLeave = () => {
    setHovering(false);
    setInfoPos(null);
    onHoverChange?.(null);
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
      infoTimerRef.current = null;
    }
    pendingRatioRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const anchorInfo = (rect) => {
    if (!rect) return;
    const tooltipWidth = 240;
    let left = rect.right + 10;
    if (left + tooltipWidth > window.innerWidth) left = Math.max(4, rect.left - tooltipWidth - 10);
    setInfoPos({ left, top: Math.max(4, rect.top) });
  };

  const handleMouseEnter = () => {
    setHovering(true);
    onHoverChange?.(asset._id);
    // Show the tooltip only after a sustained hover (2s).
    infoTimerRef.current = setTimeout(() => {
      infoTimerRef.current = null;
      const rect = bubbleRef.current?.getBoundingClientRect();
      if (rect) anchorInfo(rect);
    }, 2000);
  };

  const handleMouseMove = (event) => {
    if (!showVideoPreview || !videoRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pendingRatioRef.current = ratio;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const video = videoRef.current;
      if (pendingRatioRef.current == null || !video) return;
      const duration = video.duration || 0;
      if (!duration) return;
      const target = pendingRatioRef.current * duration;
      // Skip redundant seeks when the change is negligible to avoid jank.
      if (Math.abs(target - video.currentTime) < 0.05) return;
      if (typeof video.fastSeek === 'function') video.fastSeek(target);
      else video.currentTime = target;
    });
  };
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatBitrate = (bits) => {
    if (!bits) return '';
    const bps = Number(bits);
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} kbps`;
    return `${bps} bps`;
  };

  // Scale text sizes based on thumbnail size
  const isSmall = size < 160;
  const isMedium = size >= 160 && size < 240;
  
  const filenameSizeClass = isSmall ? 'text-xs' : isMedium ? 'text-sm' : 'text-base';
  const badgeTextClass = isSmall ? 'text-[10px]' : 'text-xs';
  const metaSizeClass = isSmall ? 'text-[9px]' : 'text-[10px]';
  const terms = query.split(/\s+/).filter((term) => !term.includes(':')).filter(Boolean);
  const filenamePattern = terms.length ? new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig') : null;
  const filenameParts = filenamePattern ? asset.filename.split(filenamePattern) : [asset.filename];

  return (
    <div
      ref={bubbleRef}
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={(event) => onContextMenu(event, asset._id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable
      onDragStart={(event) => {
        const ids = dragIds.length ? dragIds : [asset._id];
        const paths = (dragPaths.length ? dragPaths : (asset.path ? [asset.path] : [])).filter(Boolean);
        const joined = paths.join('\n');
        event.dataTransfer.setData('application/x-maxv-asset', JSON.stringify({ ids, paths }));
        // Drop the full file path (or newline-joined paths for a multi-select)
        // so external applications receive the path(s).
        if (joined) {
          event.dataTransfer.setData(asset.mime || 'application/octet-stream', joined);
          event.dataTransfer.setData('text/plain', joined);
        }
        event.dataTransfer.effectAllowed = 'copy';

        // Multiple items: swap the drag image for a count badge.
        if (paths.length > 1) {
          const badge = document.createElement('div');
          badge.style.cssText = 'position:fixed;top:-1000px;left:-1000px;display:flex;align-items:center;justify-content:center;min-width:34px;height:34px;padding:0 8px;border-radius:17px;background:#3d9ae8;color:#fff;font:600 14px/1 sans-serif;';
          badge.textContent = String(paths.length);
          document.body.appendChild(badge);
          event.dataTransfer.setDragImage(badge, 17, 17);
          setTimeout(() => badge.remove(), 0);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(event);
        }
      }}
      className="group cursor-pointer"
    >
      {/* Thumbnail with fixed height, width controlled by grid column */}
      <div
        onMouseMove={handleMouseMove}
        className={`relative w-full overflow-hidden rounded-lg border-2 bg-gray-900 transition-all duration-300 hover:border-purple-500 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20 ${selected ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-gray-800'}`}
        style={{ height: size }}
      >
        <img
          src={api.getThumbnailUrl(asset._id)}
          alt={asset.filename}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {showVideoPreview && (
          <video
            ref={videoRef}
            src={api.getFileUrl(asset._id)}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {selected && <div className="pointer-events-none absolute inset-0 bg-black/60" aria-hidden="true" />}
        
        {/* Video duration badge */}
        {asset.type === 'video' && asset.duration && (
          <div className={`absolute top-2 right-2 bg-black/80 text-white ${badgeTextClass} px-2 py-1 rounded`}>
            {formatDuration(asset.duration)}
          </div>
        )}
        {/* Frame sequence badge */}
        {asset.is_sequence && (
          <div className={`absolute top-2 left-2 bg-black/80 text-purple-300 ${badgeTextClass} px-2 py-1 rounded`}>
            SEQ · {asset.frame_count}
          </div>
        )}
      </div>

      {/* Bottom info panel */}
      <div className="mt-2 px-1">
        <h3 className={`text-gray-200 font-medium ${filenameSizeClass} truncate mb-1`} title={asset.filename}>
          {filenameParts.map((part, index) => (
            filenamePattern && index % 2 === 1
              ? <mark key={`${part}-${index}`} className="rounded bg-yellow-400/30 px-0.5 text-yellow-200">{part}</mark>
              : part
          ))}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-gray-400 ${metaSizeClass}`}>
            {asset.type === 'image' ? '📷' : '🎬'} {asset.width}×{asset.height}
          </span>
          {asset.size && (
            <span className={`text-gray-500 ${metaSizeClass}`}>
              {formatSize(asset.size)}
            </span>
          )}
        </div>
        {asset.tags?.length > 0 && (
          <div className="mt-2 flex max-h-6 gap-1 overflow-hidden" aria-label="Image tags">
            {asset.tags.map((tag) => (
              <span key={tag} className="max-w-24 shrink-0 truncate rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300" title={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover metadata tooltip */}
      {infoPos && (
        <div
          className="pointer-events-none fixed z-50 w-60 rounded-lg border border-gray-700 bg-gray-900/95 p-3 text-xs shadow-2xl backdrop-blur"
          style={{ left: infoPos.left, top: infoPos.top }}
        >
          <p className="mb-1 break-all font-medium text-gray-100">{asset.filename}</p>
          <div className="space-y-0.5 text-gray-400">
            <p><span className="text-gray-500">Type:</span> {asset.type}{asset.mime ? ` · ${asset.mime}` : ''}</p>
            {asset.width && asset.height && (
              <p><span className="text-gray-500">Dimensions:</span> {asset.width} × {asset.height}</p>
            )}
            {asset.size && (
              <p><span className="text-gray-500">Size:</span> {formatSize(asset.size)}</p>
            )}
            {asset.duration && (
              <p><span className="text-gray-500">Duration:</span> {formatDuration(asset.duration)}</p>
            )}
            {asset.is_sequence && (
              <p><span className="text-gray-500">Frames:</span> {asset.frame_count} ({asset.frame_start}–{asset.frame_end})</p>
            )}
            {asset.metadata?.codec && (
              <p><span className="text-gray-500">Codec:</span> {asset.metadata.codec}</p>
            )}
            {asset.metadata?.fps && (
              <p><span className="text-gray-500">FPS:</span> {Number(asset.metadata.fps).toFixed(1)}</p>
            )}
            {asset.metadata?.bitrate && (
              <p><span className="text-gray-500">Bitrate:</span> {formatBitrate(asset.metadata.bitrate)}</p>
            )}
            {(asset.tags || []).length > 0 && (
              <p className="truncate" title={asset.tags.join(', ')}><span className="text-gray-500">Tags:</span> {asset.tags.join(', ')}</p>
            )}
            <p className="truncate" title={asset.path}><span className="text-gray-500">Path:</span> {asset.path}</p>
          </div>
        </div>
      )}
    </div>
  );
}
