import { useState } from 'react';
import { api } from '../api/client';

export default function FolderPicker({ onScanComplete }) {
  const [folderPath, setFolderPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleScan = async (path) => {
    if (!path || path.trim() === '') {
      setError('Please enter a folder path');
      return;
    }

    try {
      setScanning(true);
      setError('');
      setInfo('');
      await api.triggerScan(path);
      
      // Poll for completion
      let attempts = 0;
      const checkStatus = setInterval(async () => {
        attempts++;
        if (attempts > 60) { // Max 60 seconds
          clearInterval(checkStatus);
          setScanning(false);
          onScanComplete();
          return;
        }
        
        // In a real implementation, check scan status
        // For now, just wait a bit and reload
        if (attempts > 3) {
          clearInterval(checkStatus);
          setScanning(false);
          onScanComplete();
        }
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to scan folder');
      setScanning(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleScan(folderPath);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Try to get folder path from drop
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      
      // For file system entries (modern browsers)
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          // Unfortunately, we can't get the full filesystem path in browser
          // Show a message to the user
          setError('Please paste the folder path in the input field below');
          return;
        }
      }
      
      // Try to extract path from file
      const file = item.getAsFile();
      if (file && file.path) {
        // In Electron or similar, file.path might be available
        const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
        setFolderPath(dirPath);
        handleScan(dirPath);
        return;
      }
    }
    
    setError('Please paste the folder path in the input field');
  };

  const handleBrowseFolder = async () => {
    try {
      // Check if File System Access API is available
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker();
        // Browser only gives us the folder name for security reasons
        // Put the folder name in the input so user can prepend the parent path
        setFolderPath(dirHandle.name);
        setError('');
        setInfo(`Folder "${dirHandle.name}" selected. Please add the parent path before the folder name (e.g., change "${dirHandle.name}" to "/home/user/${dirHandle.name}")`);
      } else {
        setError('Directory picker not supported in this browser. Please enter the full path manually.');
        setInfo('');
      }
    } catch (err) {
      // User cancelled or error occurred
      if (err.name !== 'AbortError') {
        console.error('Error opening directory picker:', err);
        setError('Failed to open directory picker');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div 
        className={`w-full max-w-2xl border-2 border-dashed rounded-lg p-12 transition-all ${
          isDragging 
            ? 'border-purple-500 bg-purple-500/10' 
            : 'border-gray-700 hover:border-gray-600'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-gray-500 text-6xl mb-4">
          {scanning ? '⏳' : '📁'}
        </div>
        
        <h2 className="text-gray-300 text-2xl font-semibold mb-2">
          {scanning ? 'Scanning...' : 'Scan Media Folder'}
        </h2>
        
        <p className="text-gray-500 mb-6">
          {isDragging 
            ? 'Drop folder here...' 
            : 'Enter the full path to your media folder below'
          }
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="/path/to/media/folder"
              disabled={scanning}
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleBrowseFolder}
              disabled={scanning}
              title="Navigate to folder (you'll need to copy the path manually)"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-gray-200 font-medium rounded-lg transition-colors border border-gray-700 hover:border-gray-600"
            >
              📂 Browse
            </button>
            <button
              type="submit"
              disabled={scanning || !folderPath.trim()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {scanning ? 'Scanning...' : 'Scan'}
            </button>
          </div>
          
          {error && (
            <div className="mt-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {info && (
            <div className="mt-3 text-yellow-400 text-sm">
              {info}
            </div>
          )}
        </form>

        <div className="mt-8 text-gray-600 text-sm">
          <p className="mb-2">Examples:</p>
          <code className="block bg-gray-900 text-purple-400 px-3 py-1 rounded text-xs mb-1">
            /home/user/Pictures
          </code>
          <code className="block bg-gray-900 text-purple-400 px-3 py-1 rounded text-xs mb-1">
            C:\Users\Name\Videos
          </code>
          <code className="block bg-gray-900 text-purple-400 px-3 py-1 rounded text-xs">
            /home/robert-v/dev/wgid/maxv/data/media
          </code>
        </div>
      </div>
    </div>
  );
}
