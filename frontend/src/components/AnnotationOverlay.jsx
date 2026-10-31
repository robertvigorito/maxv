import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const TOOLS = ['select', 'freehand', 'rectangle', 'arrow', 'text'];
const COLORS = [
  ['gray-6', '#57606a'], ['blue-5', '#0969da'], ['green-5', '#1a7f37'],
  ['yellow-4', '#bf8700'], ['orange-5', '#bc4c00'], ['red-5', '#cf222e'],
  ['purple-5', '#8250df'], ['pink-5', '#bf3989'], ['coral-5', '#d12e1e'],
  ['gray-0', '#f6f8fa'], ['blue-2', '#80ccff'], ['green-2', '#6fdd8b'],
].map(([name, value]) => ({ name, value }));

function frameKey(time) {
  return String(Math.max(0, Math.round((Number(time) || 0) * 10) / 10));
}

function point(event, element) {
  const bounds = element.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * 100,
    y: ((event.clientY - bounds.top) / bounds.height) * 100,
  };
}

function drawAnnotation(annotation) {
  const common = { stroke: annotation.color, strokeWidth: annotation.width, fill: 'none', vectorEffect: 'non-scaling-stroke' };
  if (annotation.type === 'freehand') {
    return <polyline key={annotation.id} points={annotation.points.map(({ x, y }) => `${x},${y}`).join(' ')} {...common} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (annotation.type === 'rectangle') {
    const width = annotation.end.x - annotation.start.x;
    const height = annotation.end.y - annotation.start.y;
    return <rect key={annotation.id} x={annotation.start.x} y={annotation.start.y} width={width} height={height} {...common} />;
  }
  if (annotation.type === 'arrow') {
    return <line key={annotation.id} x1={annotation.start.x} y1={annotation.start.y} x2={annotation.end.x} y2={annotation.end.y} {...common} markerEnd="url(#annotation-arrow)" />;
  }
  return <text key={annotation.id} x={annotation.start.x} y={annotation.start.y} fill={annotation.color} fontSize="3" vectorEffect="non-scaling-stroke">{annotation.text}</text>;
}

export default function AnnotationOverlay({ assetId, currentTime = 0, onSaved }) {
  const surfaceRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#facc15');
  const [width, setWidth] = useState(3);
  const [savedAnnotations, setSavedAnnotations] = useLocalStorage('maxv-annotations', {});
  const [annotations, setAnnotations] = useState([]);
  const [draft, setDraft] = useState(null);
  const [visible, setVisible] = useState(true);
  const [orientation, setOrientation] = useState('horizontal');
  const [toolbarPosition, setToolbarPosition] = useState({ x: 50, y: 90 });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [scope, setScope] = useState('frame');
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const memoryAnnotationsRef = useRef({});
  const currentFrameKey = frameKey(currentTime);
  const annotationKey = scope === 'clip' ? `${assetId}:clip` : `${assetId}:frame:${currentFrameKey}`;

  useEffect(() => {
    const clip = savedAnnotations[assetId] || {};
    const diskAnnotations = scope === 'clip' ? clip.clip || [] : clip.frames?.[currentFrameKey] || [];
    setAnnotations(memoryAnnotationsRef.current[annotationKey] || diskAnnotations);
  }, [annotationKey, assetId, currentFrameKey, savedAnnotations, scope]);

  const handlePointerDown = (event) => {
    if (tool === 'select' || !surfaceRef.current) return;
    const start = point(event, surfaceRef.current);
    const base = { id: crypto.randomUUID(), type: tool, start, end: start, color, width };
    setDraft(tool === 'freehand' ? { ...base, points: [start] } : base);
    surfaceRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!draft || !surfaceRef.current) return;
    const next = point(event, surfaceRef.current);
    setDraft((current) => current.type === 'freehand'
      ? { ...current, points: [...current.points, next], end: next }
      : { ...current, end: next });
  };

  const rememberAnnotations = (nextAnnotations) => {
    memoryAnnotationsRef.current[annotationKey] = nextAnnotations;
    setAnnotations(nextAnnotations);
  };

  const persistAnnotations = (nextAnnotations) => {
    const savedFrame = currentFrameKey;
    setSavedAnnotations((current) => {
      const clip = current[assetId] || { clip: [], frames: {} };
      if (scope === 'clip') return { ...current, [assetId]: { ...clip, clip: nextAnnotations } };
      return { ...current, [assetId]: { ...clip, frames: { ...clip.frames, [savedFrame]: nextAnnotations } } };
    });
    memoryAnnotationsRef.current[annotationKey] = nextAnnotations;
    onSaved?.(assetId, scope, savedFrame);
  };

  const handlePointerUp = () => {
    if (!draft) return;
    if (draft.type === 'text') {
      const text = window.prompt('Annotation text');
      if (text) {
        const nextAnnotations = [...annotations, { ...draft, text }];
        rememberAnnotations(nextAnnotations);
      }
    } else if (draft.type !== 'freehand' || draft.points.length > 1) {
      const nextAnnotations = [...annotations, draft];
      rememberAnnotations(nextAnnotations);
    }
    setDraft(null);
  };

  const handleToolbarPointerDown = (event) => {
    const container = surfaceRef.current?.parentElement;
    if (!container) return;
    const toolbar = event.currentTarget.parentElement;
    const toolbarBounds = toolbar.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - (toolbarBounds.left + toolbarBounds.width / 2),
      y: event.clientY - (toolbarBounds.top + toolbarBounds.height / 2),
    };
    draggingRef.current = true;
    event.preventDefault();
    container.setPointerCapture(event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleToolbarPointerMove = (event) => {
    if (!draggingRef.current) return;
    const container = surfaceRef.current?.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    setToolbarPosition({
      x: Math.max(8, Math.min(92, ((event.clientX - dragOffsetRef.current.x - bounds.left) / bounds.width) * 100)),
      y: Math.max(8, Math.min(92, ((event.clientY - dragOffsetRef.current.y - bounds.top) / bounds.height) * 100)),
    });
  };

  const handleToolbarPointerUp = (event) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const saveAnnotations = () => {
    persistAnnotations(annotations);
  };

  const undoAnnotation = () => {
    const nextAnnotations = annotations.slice(0, -1);
    rememberAnnotations(nextAnnotations);
  };

  const clearAnnotations = () => rememberAnnotations([]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {visible && (
        <svg
          ref={surfaceRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-auto absolute inset-0 h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDraft(null)}
        >
          <defs>
            <marker id="annotation-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill={color} />
            </marker>
          </defs>
          {annotations.map(drawAnnotation)}
          {draft && drawAnnotation(draft)}
        </svg>
      )}
      <div
        className={`pointer-events-auto absolute flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-950/90 p-1 shadow-lg ${orientation === 'horizontal' ? 'flex-row' : 'flex-col'}`}
        style={{ left: `${toolbarPosition.x}%`, top: `${toolbarPosition.y}%`, transform: 'translate(-50%, -50%)' }}
      >
        <button
          type="button"
          onPointerDown={handleToolbarPointerDown}
          onPointerMove={handleToolbarPointerMove}
          onPointerUp={handleToolbarPointerUp}
          onPointerCancel={handleToolbarPointerUp}
          title="Drag annotation toolbar"
          className="cursor-move rounded px-2 py-1 text-gray-500 hover:bg-gray-800 hover:text-white"
        >
          ⠿
        </button>
        {TOOLS.map((name) => (
          <button key={name} type="button" onClick={() => setTool(name)} className={`rounded px-2 py-1 text-xs capitalize ${tool === name ? 'bg-yellow-500 text-black' : 'text-gray-300 hover:bg-gray-800'}`}>
            {name}
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            aria-label="Choose annotation color"
            title="Choose annotation color"
            onClick={() => setColorPickerOpen((value) => !value)}
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-600 bg-gray-900 hover:border-gray-400"
          >
            <span className="h-4 w-4 rounded-full border border-white/50" style={{ backgroundColor: color }} />
          </button>
          {colorPickerOpen && (
            <div className={`absolute z-20 rounded-lg border border-gray-700 bg-gray-950 p-2 shadow-xl ${orientation === 'horizontal' ? 'bottom-9 left-1/2 -translate-x-1/2' : 'left-9 top-1/2 -translate-y-1/2'}`}>
              <div className="grid grid-cols-5 gap-1.5">
                {COLORS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    aria-label={`Use Primer ${preset.name}`}
                    title={`Primer ${preset.name}`}
                    onClick={() => {
                      setColor(preset.value);
                      setColorPickerOpen(false);
                    }}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === preset.value ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 border-t border-gray-800 pt-2 text-[10px] text-gray-400">
                <span>Custom</span>
                <input aria-label="Custom annotation color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
              </label>
            </div>
          )}
        </div>
        <input aria-label="Annotation width" type="range" min="1" max="8" value={width} onChange={(event) => setWidth(Number(event.target.value))} className="w-16" />
        <button type="button" onClick={undoAnnotation} className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">Undo</button>
        <button type="button" onClick={clearAnnotations} className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">Clear</button>
        <button type="button" onClick={saveAnnotations} title="Save this annotation from RAM to browser disk storage" className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500">Save to disk</button>
        <button type="button" onClick={() => setScope((value) => value === 'frame' ? 'clip' : 'frame')} title="Choose whether annotations apply to this draw frame or the whole frame" className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">
          {scope === 'frame' ? 'Draw frame' : 'Whole frame'}
        </button>
        <button type="button" onClick={() => setVisible((current) => !current)} className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">{visible ? 'Hide' : 'Show'}</button>
        <button
          type="button"
          onClick={() => setOrientation((value) => value === 'horizontal' ? 'vertical' : 'horizontal')}
          title={`Switch to ${orientation === 'horizontal' ? 'vertical' : 'horizontal'} toolbar`}
          className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
        >
          {orientation === 'horizontal' ? '↕' : '↔'}
        </button>
      </div>
    </div>
  );
}