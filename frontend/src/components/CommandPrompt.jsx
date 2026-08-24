import { useState, useEffect, useRef } from 'react';

const KNOWN_COMMANDS = ['scan', 'add', 'index', 'refresh'];

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

  const suggestions = input.trim()
    ? [...new Set([...KNOWN_COMMANDS, ...history])]
        .filter((candidate) => candidate.toLowerCase().startsWith(input.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const inlineSuggestion = suggestions[0] || '';
  const suffix = inlineSuggestion.toLowerCase().startsWith(input.trim().toLowerCase())
    ? inlineSuggestion.slice(input.trim().length)
    : '';

  const acceptSuggestion = (value) => {
    setInput(value);
    inputRef.current?.focus();
  };

  const submit = () => {
    if (!input.trim()) return;
    setHistory([input, ...history]);
    setHistoryIndex(-1);
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    onCommand({ command, args, raw: input });
    setInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && suffix) {
      e.preventDefault();
      acceptSuggestion(inlineSuggestion);
      return;
    }

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
              <div className="relative flex-1 font-mono">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 whitespace-pre text-gray-200"
                >
                  {input}
                  <span className="text-gray-600">{suffix}</span>
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="scan /path/to/media"
                  className="relative w-full bg-transparent text-transparent caret-purple-400 outline-none placeholder:text-gray-500"
                />
              </div>
            </div>
          </form>

          <div className="mt-4 text-sm text-gray-500">
            <p className="mb-2 font-semibold text-gray-400">Available Commands:</p>
            <div className="space-y-1 font-mono">
              <p><span className="text-purple-400">scan</span> <span className="text-gray-600">&lt;path&gt;</span> - Scan a folder for media files</p>
              <p><span className="text-purple-400">add</span> <span className="text-gray-600">&lt;path&gt;</span> - Same as scan</p>
              <p><span className="text-purple-400">index</span> <span className="text-gray-600">&lt;path&gt;</span> - Same as scan</p>
              <p><span className="text-purple-400">refresh</span> - Re-scan the configured media path</p>
            </div>
            <div className="mt-3 text-xs text-gray-600">
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">Tab</kbd> to accept inline completion</p>
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">↑</kbd> <kbd className="px-1 py-0.5 bg-gray-800 rounded">↓</kbd> for history</p>
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> to close</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
