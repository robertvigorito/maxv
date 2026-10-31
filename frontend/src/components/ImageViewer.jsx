import { useState } from 'react';
import { api } from '../api/client';

export default function ImageViewer({ asset }) {
  const [fitToScreen, setFitToScreen] = useState(true);

  return (
    <div className="max-w-full max-h-full flex items-center justify-center">
      <img
        src={api.getImageUrl(asset)}
        alt={asset.filename}
        className={`${
          fitToScreen
            ? 'max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain'
            : 'w-auto h-auto'
        } cursor-pointer rounded-lg shadow-2xl`}
        onClick={() => setFitToScreen(!fitToScreen)}
      />
    </div>
  );
}
