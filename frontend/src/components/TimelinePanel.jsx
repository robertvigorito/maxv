import { useMemo, useState } from 'react';
import { api } from '../api/client';

const IMAGE_DURATION = 3;
const MIN_CLIP_WIDTH = 92;

function clipDuration(item, trims) {
  const sourceDuration = item.type === 'image' ? IMAGE_DURATION : Number(item.duration) || 1;
  const inTime = Math.max(0, Math.min(Number(trims[item._id]?.in) || 0, sourceDuration));
  const requestedOut = trims[item._id]?.out == null ? sourceDuration : Number(trims[item._id].out);
  const outTime = Math.max(inTime, Math.min(Number.isFinite(requestedOut) ? requestedOut : sourceDuration, sourceDuration));
  return { sourceDuration, inTime, outTime, duration: Math.max(0.1, outTime - inTime) };
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function getStep(totalDuration) {
  if (totalDuration <= 30) return 5;
  if (totalDuration <= 120) return 10;
  if (totalDuration <= 600) return 30;
  return 60;
}

export default function TimelinePanel({
  items,
  onAdd,
  onReorder,
  onRemove,
  onClear,
  onPlay,
  onStop,
  isPlaying,
  onSelectItem,
  onTrim,
  annotationMarkers = {},
  trims = {},
  collapsed = false,
  onToggle,
}) {
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const durations = useMemo(() => items.map((item) => clipDuration(item, trims)), [items, trims]);
  const totalDuration = durations.reduce((sum, range) => sum + range.duration, 0);
  const pixelsPerSecond = 42 * zoom;
  const clipLayouts = useMemo(() => {
    return durations.reduce((layouts, range) => {
      const previous = layouts[layouts.length - 1];
      const left = previous ? previous.left + previous.duration : 0;
      return [...layouts, {
        left: left * pixelsPerSecond,
        width: Math.max(MIN_CLIP_WIDTH, range.duration * pixelsPerSecond),
        duration: range.duration,
      }];
    }, []);
  }, [durations, pixelsPerSecond]);
  const contentWidth = Math.max(760, 112 + totalDuration * pixelsPerSecond + 32);
  const step = getStep(totalDuration);
  const rulerTicks = [];
  for (let time = 0; time <= totalDuration; time += step) rulerTicks.push(time);

  const handleDrop = (event, toIndex = items.length) => {
    event.preventDefault();
    const rawAsset = event.dataTransfer.getData('application/x-maxv-asset');
    if (rawAsset) {
      try {
        const parsed = JSON.parse(rawAsset);
        onAdd(Array.isArray(parsed.ids) ? parsed.ids : [rawAsset]);
      } catch {
        onAdd([rawAsset]);
      }
      return;
    }
    const fromIndex = Number(event.dataTransfer.getData('application/x-maxv-reorder'));
    if (!Number.isNaN(fromIndex)) onReorder(fromIndex, toIndex);
  };

  const handleClipDragStart = (event, index) => {
    event.dataTransfer.setData('application/x-maxv-reorder', String(index));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <section className={`border-t border-gray-800 bg-[#111318] ${collapsed ? 'px-4 py-1' : 'px-3 py-2'}`}>
      <header className="flex min-h-8 items-center gap-2 text-gray-300">
        <button type="button" onClick={onToggle} title={collapsed ? 'Expand timeline' : 'Collapse timeline'} className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-800 hover:text-white">
          {collapsed ? '▸' : '▾'}
        </button>
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-gray-100">Timeline</h2>
          <span className="font-mono text-[10px] text-gray-500">{formatTime(totalDuration)}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} title="Zoom out" className="h-7 w-7 rounded text-gray-400 hover:bg-gray-800 hover:text-white">−</button>
          <span className="w-10 text-center font-mono text-[10px] text-gray-500">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} title="Zoom in" className="h-7 w-7 rounded text-gray-400 hover:bg-gray-800 hover:text-white">+</button>
          {items.length > 0 && (
            <button type="button" onClick={isPlaying ? onStop : onPlay} className={`ml-2 rounded px-3 py-1 text-xs font-medium ${isPlaying ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-600 text-white hover:bg-purple-500'}`}>
              {isPlaying ? 'Stop' : 'Play all'}
            </button>
          )}
          {items.length > 0 && <button type="button" onClick={onClear} title="Clear timeline" className="ml-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-200">Clear</button>}
        </div>
      </header>

      {!collapsed && (
        <div className="mt-2 overflow-x-auto rounded border border-gray-800 bg-[#0b0d11]" onDragOver={(event) => event.preventDefault()}>
          <div style={{ width: contentWidth }}>
            <div className="relative ml-28 h-8 border-b border-gray-800 bg-[#151820]">
              {rulerTicks.map((time) => (
                <div key={time} className="absolute inset-y-0 border-l border-gray-700/80" style={{ left: time * pixelsPerSecond }}>
                  <span className="absolute left-1 top-1 whitespace-nowrap font-mono text-[10px] text-gray-500">{formatTime(time)}</span>
                </div>
              ))}
            </div>

            <div className="relative flex min-h-[92px] border-b border-gray-800">
              <div className="flex w-28 shrink-0 flex-col justify-center border-r border-gray-800 bg-[#151820] px-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Media</span>
                <span className="mt-1 text-[10px] text-gray-600">{items.length} clips</span>
              </div>
              <div className="relative flex-1 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_41px,rgba(75,85,99,0.14)_42px)]" onDrop={(event) => handleDrop(event)}>
                {items.map((item, index) => {
                  const range = durations[index];
                  const { left, width } = clipLayouts[index];
                  const marker = annotationMarkers[item._id];
                  const selected = selectedId === item._id;
                  return (
                    <div key={item._id} draggable onDragStart={(event) => handleClipDragStart(event, index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); handleDrop(event, index); }} onClick={() => setSelectedId(item._id)} className={`group absolute top-2 h-[76px] cursor-grab overflow-hidden rounded-sm border shadow-lg transition-shadow active:cursor-grabbing ${selected ? 'z-10 border-white ring-2 ring-purple-500/70' : 'border-gray-600 hover:border-gray-300'}`} style={{ left, width, backgroundColor: item.type === 'image' ? '#166534' : '#5b21b6' }}>
                      <img src={api.getThumbnailUrl(item._id)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
                      <div className="relative flex h-full flex-col justify-between p-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <span className="truncate text-[10px] font-semibold text-white">{item.filename}</span>
                          <span className="shrink-0 rounded bg-black/35 px-1 text-[9px] text-white/80">{item.type === 'image' ? 'IMG' : 'VID'}</span>
                        </div>
                        <div className="flex items-end justify-between gap-1 text-[9px] text-white/70">
                          <span>{formatTime(range.inTime)} → {formatTime(range.outTime)}</span>
                          {marker && <span title="Annotation marker" className="h-2 w-2 shrink-0 rounded-full bg-yellow-300 ring-1 ring-black/60" />}
                        </div>
                      </div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(item._id); }} title="Remove clip" className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded bg-black/70 text-[10px] text-white hover:bg-red-600 group-hover:flex">×</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onTrim(item._id); }} title="Edit in/out" className="absolute bottom-1 right-1 hidden rounded bg-black/70 px-1 text-[9px] text-white hover:bg-purple-600 group-hover:block">Trim</button>
                    </div>
                  );
                })}
                {items.length === 0 && <div className="flex h-[92px] items-center justify-center text-xs text-gray-600">Drop media here to build the sequence</div>}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]" title="Playhead" />
              </div>
            </div>

            <div className="relative flex min-h-10">
              <div className="flex w-28 shrink-0 items-center border-r border-gray-800 bg-[#151820] px-3 text-[10px] uppercase tracking-widest text-gray-600">Annotations</div>
              <div className="relative flex-1 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_41px,rgba(75,85,99,0.1)_42px)]">
                {items.map((item, index) => {
                  const { left, width } = clipLayouts[index];
                  return annotationMarkers[item._id] ? <button type="button" key={item._id} onClick={() => onSelectItem(item._id)} title={`Annotations on ${item.filename}`} className="absolute top-3 h-4 rounded border border-yellow-300/70 bg-yellow-400/60 hover:bg-yellow-300" style={{ left: left + 4, width: Math.max(12, width - 8) }} /> : null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
