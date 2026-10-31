import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

export default function SearchBar({ onSearch, assets = [], compact = false }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [availableTags, setAvailableTags] = useState([]);
  const highlightRef = useRef(null);
  const [recentQueries, setRecentQueries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('maxv-search-history') || '[]');
    } catch {
      return [];
    }
  });

  const currentTerm = query.split(/\s+/).pop();
  const unique = (values) => values.filter((value, index, all) => all.indexOf(value) === index);

  useEffect(() => {
    let cancelled = false;
    api.fetchTags()
      .then((data) => {
        if (!cancelled) setAvailableTags(data.tags || []);
      })
      .catch(() => {
        // The asset-derived fallback keeps autocomplete useful during startup.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildSuggestions = (term) => {
    const normalizedTerm = term.toLowerCase();
    if (!term) return recentQueries;
    const colonIndex = normalizedTerm.indexOf(':');
    if (colonIndex !== -1) {
      const field = normalizedTerm.slice(0, colonIndex);
      if (field === 'tag') {
        const tags = availableTags.length > 0 ? availableTags : assets.flatMap((asset) => asset.tags || []);
        const tagPrefix = term.slice(colonIndex + 1);
        const commaIndex = tagPrefix.lastIndexOf(',');
        const completedTags = commaIndex === -1 ? '' : tagPrefix.slice(0, commaIndex + 1);
        const currentTag = commaIndex === -1 ? tagPrefix : tagPrefix.slice(commaIndex + 1);
        return unique(tags)
          .filter((tag) => tag.toLowerCase().startsWith(currentTag.toLowerCase()))
          .map((tag) => `tag:${completedTags}${tag}`)
          .slice(0, 20);
      }
      if (field === 'name') {
        return unique(assets.map((asset) => asset.filename))
          .map((filename) => `name:${filename}`)
          .filter((value) => value.toLowerCase().startsWith(normalizedTerm))
          .slice(0, 20);
      }
      if (field === 'size') {
        return ['size:>1mb', 'size:>10mb', 'size:>100mb', 'size:<1gb', 'size:>=1gb']
          .filter((value) => value.startsWith(normalizedTerm));
      }
      return [];
    }
    return unique([
      ...assets.map((asset) => asset.filename),
      ...assets.flatMap((asset) => asset.tags || []).map((tag) => `tag:${tag}`),
      'name:', 'size:', 'tag:',
    ])
        .filter((value) => value.toLowerCase().includes(normalizedTerm))
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

  const renderQuery = () => query.split(/(\s+)/).map((part, index) => {
    if (/^\s+$/.test(part)) return <span key={index}>{part}</span>;
    const fieldMatch = part.match(/^(name|tag|size):/i);
    if (!fieldMatch) return <span key={index} className="text-gray-100">{part}</span>;
    const value = part.slice(fieldMatch[0].length);
    const valueClass = fieldMatch[1].toLowerCase() === 'size' ? 'text-amber-300' : 'text-emerald-300';
    return (
      <span key={index}>
        <span className="text-sky-300">{fieldMatch[0]}</span>
        <span className={valueClass}>{value}</span>
      </span>
    );
  });

  const syncHighlightScroll = (event) => {
    if (highlightRef.current) highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
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
    const handler = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(handler);
  }, [query, onSearch]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={compact ? 'relative w-full' : 'sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 px-6 py-4 backdrop-blur-sm'}>
      <div className={compact ? 'flex items-center' : 'mx-auto flex max-w-7xl items-center gap-4'}>
        <div className="relative flex-1">
          <div className="relative rounded-lg bg-gray-900">
            <div
              ref={highlightRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1] overflow-hidden whitespace-pre rounded-lg px-4 py-2 text-sm leading-6"
            >
              {query ? renderQuery() : <span className="text-gray-500">Search files, e.g. name:_A* size:4mb&gt; tag:travel</span>}
            </div>
            <input
              id="search-input"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onScroll={syncHighlightScroll}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search files"
              className="relative z-[2] w-full rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-sm leading-6 text-transparent caret-white placeholder-transparent focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
            />
          </div>
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
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
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
