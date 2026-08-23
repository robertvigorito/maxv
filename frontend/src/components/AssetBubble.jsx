import { api } from '../api/client';

export default function AssetBubble({ asset, onClick, onOpen, onContextMenu, selected = false, query = '', size = 200 }) {
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
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={(event) => onContextMenu(event, asset._id)}
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
      {/* Square thumbnail with rounded corners */}
      <div className={`relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-900 transition-all duration-300 hover:border-purple-500 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20 ${selected ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-gray-800'}`}>
        <img
          src={api.getThumbnailUrl(asset._id)}
          alt={asset.filename}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {selected && <div className="pointer-events-none absolute inset-0 bg-black/60" aria-hidden="true" />}
        
        {/* Video duration badge */}
        {asset.type === 'video' && asset.duration && (
          <div className={`absolute top-2 right-2 bg-black/80 text-white ${badgeTextClass} px-2 py-1 rounded`}>
            {formatDuration(asset.duration)}
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
    </div>
  );
}
