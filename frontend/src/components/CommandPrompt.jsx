import { useState, useEffect, useRef } from 'react';

export default function CommandPrompt({ isOpen, onClose, onCommand }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add to history
    setHistory([input, ...history]);
    setHistoryIndex(-1);

    // Parse and execute command
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    onCommand({ command, args, raw: input });

    // Clear input
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-mono text-lg">❯</span>
            <span className="text-gray-300 font-medium">Command Prompt</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3">
              <span className="text-purple-400 font-mono">❯</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="scan /path/to/media"
                className="flex-1 bg-transparent text-gray-200 outline-none font-mono"
              />
            </div>
          </form>

          <div className="mt-4 text-sm text-gray-500">
            <p className="mb-2 font-semibold text-gray-400">Available Commands:</p>
            <div className="space-y-1 font-mono">
              <p><span className="text-purple-400">scan</span> <span className="text-gray-600">&lt;path&gt;</span> - Scan a folder for media files</p>
              <p><span className="text-purple-400">add</span> <span className="text-gray-600">&lt;path&gt;</span> - Same as scan</p>
              <p><span className="text-purple-400">index</span> <span className="text-gray-600">&lt;path&gt;</span> - Same as scan</p>
            </div>
            <div className="mt-3 text-xs text-gray-600">
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">↑</kbd> <kbd className="px-1 py-0.5 bg-gray-800 rounded">↓</kbd> for history</p>
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> to close</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
