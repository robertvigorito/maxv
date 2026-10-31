import { useState } from 'react';

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A1.75 1.75 0 0 1 5.5 5h4l1.75 2h7.25a1.75 1.75 0 0 1 1.75 1.75v8.5A1.75 1.75 0 0 1 18.5 19h-13a1.75 1.75 0 0 1-1.75-1.75v-10.5Z" />
    </svg>
  );
}

export default function ProjectPicker({ projects, totalAssetCount, selectedProjectId, selectedAssetCount, onSelect, onCreate, onAddSelected }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const selectedProject = projects.find((project) => project._id === selectedProjectId);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      await onCreate(name.trim());
      setName('');
      setCreating(false);
      setOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const selectProject = (projectId) => {
    onSelect(projectId);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className="group flex h-10 min-w-[190px] items-center gap-3 rounded-xl border border-sky-400/20 bg-gray-800/90 px-3 text-left shadow-sm shadow-black/10 transition hover:border-sky-400/50 hover:bg-gray-750">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><FolderIcon /></span>
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Workspace</span><span className="block max-w-[125px] truncate text-sm font-medium text-gray-100">{selectedProject?.name || 'All projects'}</span></span>
        <span className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {selectedProjectId && selectedAssetCount > 0 && (
        <button type="button" onClick={onAddSelected} title={`Add ${selectedAssetCount} selected asset${selectedAssetCount === 1 ? '' : 's'} to this project`} className="flex h-10 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-medium text-emerald-300 transition hover:border-emerald-300/60 hover:bg-emerald-400/20"><span className="text-base leading-none">+</span><span>Add {selectedAssetCount}</span></button>
      )}

      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/40">
          <div className="border-b border-gray-800 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Projects</p><p className="mt-1 text-xs text-gray-400">Choose the data workspace to view.</p></div>
          <div className="max-h-64 overflow-y-auto p-2">
            <button type="button" role="menuitem" onClick={() => selectProject('')} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${!selectedProjectId ? 'bg-sky-400/10 text-sky-200' : 'text-gray-300 hover:bg-gray-800'}`}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-800 text-gray-400"><span className="text-sm">✦</span></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">All projects</span><span className="block text-[11px] text-gray-500">{totalAssetCount == null ? 'All existing indexed data' : `${totalAssetCount} ${totalAssetCount === 1 ? 'asset' : 'assets'}`}</span></span>{!selectedProjectId && <span className="text-sky-300">✓</span>}</button>
            {projects.map((project) => (
              <button type="button" role="menuitem" key={project._id} onClick={() => selectProject(project._id)} className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${selectedProjectId === project._id ? 'bg-sky-400/10 text-sky-200' : 'text-gray-300 hover:bg-gray-800'}`}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-400/10 text-purple-300"><FolderIcon /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{project.name}</span><span className="block text-[11px] text-gray-500">{project.asset_count} {project.asset_count === 1 ? 'asset' : 'assets'}</span></span>{selectedProjectId === project._id && <span className="text-sky-300">✓</span>}</button>
            ))}
          </div>
          <div className="border-t border-gray-800 p-2">
            {!creating ? <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"><span className="text-lg leading-none text-sky-300">+</span> Create new project</button> : (
              <form onSubmit={submit}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-sky-400" /><div className="mt-2 flex gap-2"><button type="submit" className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500">Create</button><button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:bg-gray-800">Cancel</button></div>{error && <p className="mt-2 text-xs text-red-300">{error}</p>}</form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
