import { useRef, useEffect } from 'react';
import { api } from '../api/client';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function VideoPlayer({ asset }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useLocalStorage('maxv-video-muted', false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' && videoRef.current) {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }

      if ((e.key === 'm' || e.key === 'M') && videoRef.current) {
        setMuted((value) => !value);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMuted]);

  return (
    <div className="max-w-full max-h-full flex items-center justify-center">
      <video
        ref={videoRef}
        src={api.getFileUrl(asset._id)}
        controls
        muted={muted}
        onVolumeChange={() => setMuted(!!videoRef.current?.muted)}
        className="max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
        autoPlay
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}
