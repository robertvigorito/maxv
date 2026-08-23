export default function TagPanel({ tags, activeTags, onToggleTag, groupBy, onGroupBy, onClearFilters }) {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l border-gray-800 bg-gray-900/60 p-4">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-200">Filter by Tags</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No tags yet</p>
        ) : (
          <ul className="space-y-1">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={activeTags.has(tag)}
                    onChange={() => onToggleTag(tag)}
                    className="accent-purple-500"
                  />
                  <span className="truncate">{tag}</span>
                  <span className="ml-auto text-xs text-gray-500">{count}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {activeTags.size > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 text-xs text-purple-300 hover:text-purple-200"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-5 border-t border-gray-800 pt-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-200">Group by</h2>
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
      </div>
    </aside>
  );
}
