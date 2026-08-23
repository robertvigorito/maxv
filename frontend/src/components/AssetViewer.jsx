import { useEffect, useRef } from 'react';
import ImageViewer from './ImageViewer';
import VideoPlayer from './VideoPlayer';

export default function AssetViewer({ asset, onClose, onPrevious, onNext }) {
  const containerRef = useRef(null);

  useEffect(() => {
    containerRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrevious();
      else if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext]);

  if (!asset) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowLeft') onPrevious();
        else if (e.key === 'ArrowRight') onNext();
      }}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          <h2 className="text-white text-lg font-semibold truncate">
            {asset.filename}
          </h2>
          <p className="text-gray-400 text-sm">
            {asset.width} × {asset.height}
            {asset.duration && ` • ${Math.floor(asset.duration / 60)}:${Math.floor(asset.duration % 60).toString().padStart(2, '0')}`}
          </p>
        </div>
        
        <button
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative p-4">
        {asset.type === 'image' ? (
          <ImageViewer asset={asset} />
        ) : (
          <VideoPlayer asset={asset} />
        )}

        {/* Navigation buttons */}
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-gray-900/80 hover:bg-gray-800 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors"
        >
          ←
        </button>
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-900/80 hover:bg-gray-800 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors"
        >
          →
        </button>
      </div>

      {/* Footer / Metadata */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3 bg-gray-900/50 backdrop-blur-sm text-gray-400 text-sm">
        <span>Type: {asset.type}</span>
        <span>Format: {asset.mime}</span>
        {asset.size && <span>Size: {(asset.size / (1024 * 1024)).toFixed(2)} MB</span>}
        {asset.tags?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span>Tags:</span>
            {asset.tags.map((tag) => (
              <span key={tag} className="rounded bg-purple-500/15 px-1.5 py-0.5 text-xs text-purple-300">
                {tag}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
