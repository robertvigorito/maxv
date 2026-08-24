import { useState, useEffect } from 'react';

export default function SearchBar({ onSearch, assets = [] }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [recentQueries, setRecentQueries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('maxv-search-history') || '[]');
    } catch {
      return [];
    }
  });

  const currentTerm = query.split(/\s+/).pop().toLowerCase();
  const unique = (values) => values.filter((value, index, all) => all.indexOf(value) === index);

  const buildSuggestions = (term) => {
    if (!term) return recentQueries;

    const colonIndex = term.indexOf(':');
    if (colonIndex !== -1) {
      const field = term.slice(0, colonIndex).toLowerCase();
      if (field === 'tag') {
        return unique(assets.flatMap((asset) => asset.tags || []))
          .map((tag) => `tag:${tag}`)
          .filter((value) => value.toLowerCase().startsWith(term))
          .slice(0, 20);
      }
      if (field === 'name') {
        return unique(assets.map((asset) => asset.filename))
          .map((filename) => `name:${filename}`)
          .filter((value) => value.toLowerCase().startsWith(term))
          .slice(0, 20);
      }
    }

    return unique([
      ...assets.map((asset) => asset.filename),
      ...assets.flatMap((asset) => asset.tags || []).map((tag) => `tag:${tag}`),
      'name:', 'size:', 'tag:',
    ])
      .filter((value) => value.toLowerCase().includes(term))
      .slice(0, 8);
  };

  const suggestions = buildSuggestions(currentTerm);

  const applySuggestion = (suggestion) => {
    const terms = query.split(/\s+/);
    terms[terms.length - 1] = suggestion;
    setQuery(`${terms.join(' ')}${suggestion.endsWith(':') ? '' : ' '}`);
    setHighlightedSuggestion(-1);
    setFocused(true);
  };

  const saveRecentQuery = (value) => {
    const trimmedQuery = value.trim();
    if (!trimmedQuery) return;

    setRecentQueries((current) => {
      const next = [trimmedQuery, ...current.filter((item) => item !== trimmedQuery)].slice(0, 8);
      localStorage.setItem('maxv-search-history', JSON.stringify(next));
      return next;
    });
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setHighlightedSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setHighlightedSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && highlightedSuggestion >= 0) {
      event.preventDefault();
      applySuggestion(suggestions[highlightedSuggestion]);
    } else if (event.key === 'Enter') {
      saveRecentQuery(query);
      onSearch(query);
    } else if (event.key === 'Escape') {
      setFocused(false);
      setHighlightedSuggestion(-1);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(handler);
  }, [query, onSearch]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <div className="flex-1 relative">
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search files, e.g. name:_A* size:4mb> tag:travel"
            className="w-full bg-gray-900 text-gray-100 placeholder-gray-500 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {focused && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onMouseDown={() => applySuggestion(suggestion)}
                  className={`block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white ${suggestions.indexOf(suggestion) === highlightedSuggestion ? 'bg-gray-800 text-white' : ''}`}
                >
                  {suggestion.includes(':') ? (
                    <>
                      <span className="text-purple-300">{suggestion.split(':')[0]}:</span>
                      <span className="text-gray-200">{suggestion.split(':').slice(1).join(':')}</span>
                    </>
                  ) : suggestion}
                </button>
              ))}
            </div>
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
