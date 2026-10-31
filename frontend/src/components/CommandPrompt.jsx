import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

const KNOWN_COMMANDS = ['scan', 'workspace', 'project', 'refresh', 'clear', 'clearfilters', 'watch', 'settings', 'theme'];
const PATH_COMMANDS = ['scan'];

export default function CommandPrompt({ isOpen, onClose, onCommand, defaultPath, projects = [] }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pathCompletions, setPathCompletions] = useState([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [pathNavigated, setPathNavigated] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Prefill the default scan path on open: last scanned path, else server cwd.
  const lastOpenRef = useRef(false);
  useEffect(() => {
    const opened = isOpen && !lastOpenRef.current;
    lastOpenRef.current = isOpen;
    if (!opened) return;

    const lastCommand = window.localStorage.getItem('maxv-last-command');
    if (lastCommand) {
      setInput(lastCommand);
      return;
    }

    const prefill = (path) => setInput(`scan ${path}`);
    if (defaultPath) {
      prefill(defaultPath);
      return;
    }
    let cancelled = false;
    api.getDefaultScanPath()
      .then((data) => {
        if (!cancelled && data.path) prefill(data.path);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, defaultPath]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const commandInput = input.trim().toLowerCase();
  const watchSuggestions = commandInput === 'watch' || commandInput.startsWith('watch ')
    ? ['watch add', 'watch show']
    : [];
  const workspaceCommand = input.trim().toLowerCase().startsWith('project') ? 'project' : 'workspace';
  const isWorkspaceInput = /^(workspace|project)(\s|$)/i.test(input.trim());
  const workspaceSuggestions = isWorkspaceInput
    ? [
        `${workspaceCommand} all projects`,
        ...projects.map((project) => `${workspaceCommand} ${project.name}`),
      ]
    : [];
  const suggestions = commandInput
    ? [...new Set([...KNOWN_COMMANDS, ...watchSuggestions, ...workspaceSuggestions, ...history])]
        .filter((candidate) => candidate.toLowerCase().startsWith(commandInput))
        .slice(0, 8)
    : [];

  const inlineSuggestion = suggestions[0] || '';
  const suffix = inlineSuggestion.toLowerCase().startsWith(input.trim().toLowerCase())
    ? inlineSuggestion.slice(input.trim().length)
    : '';

  // zsh-style path completion for scan and watch add: the
  // text after the command word(s) is a filesystem path completed by the
  // backend (empty -> home listing, trailing / -> subdirs, else prefix match).
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  const commandMatch = input.match(/^\s*([^\s]+)/);
  const command = commandMatch ? commandMatch[1].toLowerCase() : '';
  const sub = (parts[1] || '').toLowerCase();
  const isWatchSub = command === 'watch' && sub === 'add';
  const isPathCommand = PATH_COMMANDS.includes(command) || isWatchSub;

  let pathPrefix = '';
  let pathPartial = '';
  let hasPathArg = false;
  if (PATH_COMMANDS.includes(command)) {
    const restMatch = input.match(/^\s*\S+\s+(.*)$/s);
    if (restMatch) {
      hasPathArg = true;
      const rest = restMatch[1];
      pathPrefix = input.slice(0, input.length - rest.length);
      pathPartial = rest.trim();
    }
  } else if (isWatchSub) {
    const restMatch = input.match(/^\s*\S+\s+\S+\s+(.*)$/s);
    if (restMatch) {
      hasPathArg = true;
      const rest = restMatch[1];
      pathPrefix = input.slice(0, input.length - rest.length);
      pathPartial = rest.trim();
    }
  }

  useEffect(() => {
    setPathNavigated(false);
    if (!hasPathArg) {
      setPathCompletions([]);
      setTabIndex(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api.completePath(pathPartial);
        if (!cancelled) {
          setPathCompletions(data.items || []);
          setTabIndex(0);
        }
      } catch (error) {
        if (!cancelled) setPathCompletions([]);
      }
    }, 120); // Debounce keystrokes
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasPathArg, pathPartial]);

  const acceptSuggestion = (value) => {
    setInput(value);
    inputRef.current?.focus();
  };

  const cyclePathCompletion = () => {
    if (!pathCompletions.length) return;
    const completion = pathCompletions[tabIndex % pathCompletions.length];
    setInput(`${pathPrefix}${completion}`);
    setTabIndex((index) => (index + 1) % pathCompletions.length);
    inputRef.current?.focus();
  };

  const movePathHighlight = (direction) => {
    if (!(isPathCommand && hasPathArg) || pathCompletions.length === 0) return false;
    setPathNavigated(true);
    setTabIndex((index) => {
      const len = pathCompletions.length;
      return (index + direction + len) % len;
    });
    return true;
  };

  const submit = () => {
    if (!input.trim()) return;
    const rawCommand = input.trim();
    window.localStorage.setItem('maxv-last-command', rawCommand);
    setHistory([rawCommand]);
    setHistoryIndex(-1);
    const parts = rawCommand.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    onCommand({ command, args, raw: rawCommand });
    setInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && pathNavigated && isPathCommand && hasPathArg && pathCompletions.length) {
      e.preventDefault();
      const completion = pathCompletions[tabIndex % pathCompletions.length];
      setInput(`${pathPrefix}${completion}`);
      setPathNavigated(false);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      // Filesystem completion takes priority for scan and watch add.
      if (isPathCommand && hasPathArg && pathCompletions.length) {
        cyclePathCompletion();
        return;
      }
      if (suffix) {
        acceptSuggestion(inlineSuggestion);
        return;
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Move the autocomplete highlight when the path dropdown is open.
      if (movePathHighlight(-1)) return;
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (movePathHighlight(1)) return;
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
            <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-500/20 text-xs text-purple-300">›_</span>
            <span className="text-gray-200 font-medium">Command Palette</span>
            <span className="text-xs text-gray-600">Commands</span>
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
              <span className="text-purple-400 font-mono">›</span>
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

          {isPathCommand && hasPathArg && pathCompletions.length > 0 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950">
              {pathCompletions.map((completion, index) => (
                <button
                  key={completion}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(`${pathPrefix}${completion}`);
                    setPathCompletions([]);
                  }}
                  className={`block w-full px-3 py-1.5 text-left font-mono text-sm ${
                    index === tabIndex % pathCompletions.length
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {completion}
                </button>
              ))}
            </div>
          )}

          {isWorkspaceInput && suggestions.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
              <p className="border-b border-gray-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                Workspaces
              </p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    acceptSuggestion(suggestion);
                  }}
                  className={`block w-full px-3 py-2 text-left font-mono text-sm ${
                    index === 0
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            <p className="mb-2 font-semibold text-gray-400">Available Commands:</p>
            <div className="space-y-1 font-mono">
              <p><span className="text-purple-400">scan</span> <span className="text-gray-600">&lt;path&gt;</span> - Scan a folder for media files</p>
              <p><span className="text-purple-400">workspace</span> <span className="text-gray-600">&lt;name&gt;</span> - Switch the active workspace</p>
              <p><span className="text-purple-400">refresh</span> - Re-scan the configured media path</p>
              <p><span className="text-purple-400">clear</span> - Remove all indexed assets from the database (files stay on disk)</p>
              <p><span className="text-purple-400">clearfilters</span> - Clear all active filters</p>
              <p><span className="text-purple-400">watch</span> <span className="text-gray-600">add &lt;path&gt;</span> - Watch a folder; new media is indexed automatically</p>
              <p><span className="text-purple-400">watch</span> <span className="text-gray-600">show</span> - Open the watched-folder manager</p>
            </div>
            <div className="mt-3 text-xs text-gray-600">
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">Tab</kbd> to complete paths / commands</p>
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">↑</kbd> <kbd className="px-1 py-0.5 bg-gray-800 rounded">↓</kbd> for history</p>
              <p>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> to close</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
