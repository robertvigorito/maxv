import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function TagPopup({ assetCount, onClose, onSave }) {
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.fetchTags()
      .then((data) => setTags(data.tags || []))
      .catch(() => setError('Could not load previously used tags.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const createTag = (event) => {
    event.preventDefault();
    const tag = newTag.trim();
    if (!tag) return;

    setTags((current) => [...new Set([...current, tag])].sort((a, b) => a.localeCompare(b)));
    setSelectedTags((current) => new Set([...current, tag]));
    setNewTag('');
  };

  const saveTags = async () => {
    if (selectedTags.size === 0) return;
    setSaving(true);
    setError('');
    try {
      await onSave([...selectedTags]);
    } catch (saveError) {
      setError(saveError.message || 'Could not add tags.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-popup-title"
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="tag-popup-title" className="text-xl font-semibold text-white">Add tags</h2>
            <p className="mt-1 text-sm text-gray-400">Apply tags to {assetCount} selected {assetCount === 1 ? 'asset' : 'assets'}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close tag popup" className="text-xl text-gray-400 hover:text-white">&times;</button>
        </div>

        <form onSubmit={createTag} className="mt-5 flex gap-2">
          <input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            placeholder="Create a new tag"
            className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <button type="submit" className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">Create</button>
        </form>

        <div className="mt-5 max-h-52 overflow-y-auto rounded-lg border border-gray-800 p-3">
          {loading && <p className="text-sm text-gray-500">Loading tags...</p>}
          {!loading && tags.length === 0 && <p className="text-sm text-gray-500">No tags have been used yet.</p>}
          <div className="grid grid-cols-2 gap-2">
            {tags.map((tag) => (
              <label key={tag} className="flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800">
                <input type="checkbox" checked={selectedTags.has(tag)} onChange={() => toggleTag(tag)} className="accent-purple-500" />
                <span className="truncate" title={tag}>{tag}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          <button type="button" onClick={saveTags} disabled={saving || selectedTags.size === 0} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Adding...' : 'Add selected tags'}
          </button>
        </div>
      </section>
    </div>
  );
}