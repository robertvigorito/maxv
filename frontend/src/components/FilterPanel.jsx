import { useRef, useState } from 'react';
import MediaTree from './MediaTree';

function Section({ title, open, onToggle, children }) {
  return (
    <div className="border-t border-gray-800 pt-3 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-200"
      >
        <span>{title}</span>
        <span className="text-gray-500">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export const UNTAGGED = '__untagged__';

export default function FilterPanel({ tags, activeTags, onToggleTag, groupBy, onGroupBy, onClearFilters, onClearAllFilters, collapsed, onToggleCollapse, sizeFilter, onSizeFilter, fileSizeFilters, onFileSizeFilter, untaggedCount = 0, extensions = [], extensionFilter, onExtensionFilter, thumbnailSize, onThumbnailSize, thumbnailWidth, onThumbnailWidth, mediaTree, onItemContextMenu, tab, onTabChange, revealPath }) {
  const [openSections, setOpenSections] = useState({ tags: true, size: true, fileSize: true, extension: true, group: true, thumbnail: true });
  const [width, setWidth] = useState(256);
  const resizingRef = useRef(false);

  const toggleSection = (name) => setOpenSections((current) => ({ ...current, [name]: !current[name] }));

  const startResize = (event) => {
    event.preventDefault();
    resizingRef.current = true;
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (e) => {
      if (!resizingRef.current) return;
      const next = Math.min(520, Math.max(180, startWidth + (e.clientX - startX)));
      setWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-r border-gray-800 bg-gray-900/60 py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand panel"
          className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          ▸
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative flex shrink-0 flex-col overflow-y-auto border-r border-gray-800 bg-gray-900/60 p-4" style={{ width }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">{tab === 'filters' ? 'Filters' : 'Media'}</h2>
        <div className="flex items-center gap-1">
          {tab === 'filters' && (
            <button
              type="button"
              onClick={onClearAllFilters}
              title="Clear all filters"
              className="rounded px-2 py-1 text-xs text-purple-300 hover:bg-gray-800 hover:text-purple-200"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse panel"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ◂
          </button>
        </div>
      </div>

      <div className="mb-3 flex gap-1 rounded-lg bg-gray-800 p-1">
        <button
          type="button"
          onClick={() => onTabChange('filters')}
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            tab === 'filters' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Filters
        </button>
        <button
          type="button"
          onClick={() => onTabChange('media')}
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            tab === 'media' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Media
        </button>
      </div>

      {tab === 'media' && (
        <div className="min-h-0 flex-1">
          <MediaTree root={mediaTree} onItemContextMenu={onItemContextMenu} revealPath={revealPath} />
        </div>
      )}

      {tab === 'filters' && (
        <>
      <Section title="Filter by Tags" open={openSections.tags} onToggle={() => toggleSection('tags')}>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const noTagActive = activeTags.has(UNTAGGED);
            return (
              <button
                type="button"
                onClick={() => onToggleTag(UNTAGGED)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  noTagActive
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                No tag
                <span className={`ml-1 ${noTagActive ? 'text-purple-200' : 'text-gray-500'}`}>{untaggedCount}</span>
              </button>
            );
          })()}
          {tags.map(({ tag, count }) => {
            const active = activeTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {tag}
                <span className={`ml-1 ${active ? 'text-purple-200' : 'text-gray-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        {activeTags.size > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 text-xs text-purple-300 hover:text-purple-200"
          >
            Clear filters
          </button>
        )}
      </Section>

      <Section title="Size filter" open={openSections.size} onToggle={() => toggleSection('size')}>
        <div className="grid grid-cols-4 gap-1">
          {[['all', 'All'], ['4k', '4K'], ['hd', 'HD'], ['sd', 'SD']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onSizeFilter(value)}
              className={`rounded px-1 py-1 text-xs transition-colors ${
                sizeFilter === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-gray-500">4K ≥ 3840px · HD ≥ 1920px · SD &lt; 1920px width</p>
      </Section>

      <Section title="File size" open={openSections.fileSize} onToggle={() => toggleSection('fileSize')}>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onFileSizeFilter('all')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              fileSizeFilters.size === 0
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Any
          </button>
          {[['lt1', '<1MB'], ['1-10', '1-10MB'], ['10-100', '10-100MB'], ['gt100', '>100MB']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onFileSizeFilter(value)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                fileSizeFilters.has(value)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Extension" open={openSections.extension} onToggle={() => toggleSection('extension')}>
        <div className="flex flex-wrap gap-1">
          {[{ ext: 'all', count: 0 }, ...extensions].map(({ ext, count }) => (
            <button
              key={ext}
              type="button"
              onClick={() => onExtensionFilter(ext)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                extensionFilter === ext
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {ext === 'all' ? 'All' : ext}
              {ext !== 'all' && (
                <span className={`ml-1 ${extensionFilter === ext ? 'text-purple-200' : 'text-gray-500'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Group by" open={openSections.group} onToggle={() => toggleSection('group')}>
        <div className="flex gap-2">
          {[['none', 'None'], ['tag', 'Tag'], ['type', 'Type']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onGroupBy(value)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                groupBy === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Thumbnail" open={openSections.thumbnail} onToggle={() => toggleSection('thumbnail')}>
        <label className="flex items-center justify-between text-xs text-gray-300">
          <span>Size</span>
          <span className="font-mono text-[10px] text-gray-500">{thumbnailSize}</span>
        </label>
        <input
          type="range"
          min="120"
          max="400"
          value={thumbnailSize}
          onChange={(e) => onThumbnailSize(Number(e.target.value))}
          className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-gray-700"
        />

        <label className="mt-4 flex items-center justify-between text-xs text-gray-300">
          <span>Width</span>
          <span className="font-mono text-[10px] text-gray-500">{thumbnailWidth}</span>
        </label>
        <input
          type="range"
          min="120"
          max="600"
          value={thumbnailWidth}
          onChange={(e) => onThumbnailWidth(Number(e.target.value))}
          className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-gray-700"
        />
      </Section>
        </>
      )}

      {/* Horizontal resize handle */}
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-purple-500/60 active:bg-purple-500"
      />
    </aside>
  );
}
