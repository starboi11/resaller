'use client';

import { useEffect, useRef, useState } from 'react';

type NetworkInformation = { saveData?: boolean };

export function HeroMedia() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 768px)');
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    const update = () => setEnabled(desktop.matches && !motion.matches && !connection?.saveData);
    update();
    motion.addEventListener('change', update);
    desktop.addEventListener('change', update);
    return () => {
      motion.removeEventListener('change', update);
      desktop.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !containerRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
      if (inViewRef.current && !document.hidden) {
        void video.play().catch(() => setPlaying(false));
      } else {
        video.pause();
      }
    });
    const onVisibilityChange = () => {
      if (document.hidden) video.pause();
      else if (inViewRef.current) {
        void video.play().catch(() => setPlaying(false));
      }
    };
    observer.observe(containerRef.current);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      video.pause();
    };
  }, [enabled]);

  return (
    <div
      ref={containerRef}
      className={`market-hero__scene${playing ? ' market-hero__scene--playing' : ''}`}
      aria-hidden="true"
    >
      {enabled && (
        <video
          ref={videoRef}
          className={`market-hero__video${playing ? ' market-hero__video--playing' : ''}`}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          poster="/brand/resaller-handoff-poster.png"
          onPlaying={() => setPlaying(true)}
          onError={() => {
            setPlaying(false);
            setEnabled(false);
          }}
        >
          <source src="/ads/resaller-handoff-loop.webm" type="video/webm" />
        </video>
      )}
    </div>
  );
}
