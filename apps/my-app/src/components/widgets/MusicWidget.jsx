import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MusicWidget({ isMaximized }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [currentTrack, setCurrentTrack] = useState(0);

  const tracks = [
    { title: "Midnight Dreams", artist: "Ambient Sounds", duration: "4:23", cover: "🌙" },
    { title: "Ocean Waves", artist: "Nature Mix", duration: "3:45", cover: "🌊" },
    { title: "Forest Rain", artist: "Relaxation", duration: "5:12", cover: "🌲" },
    { title: "City Lights", artist: "Lo-Fi Beats", duration: "3:58", cover: "🌃" },
  ];

  const track = tracks[currentTrack];

  const nextTrack = () => {
    setCurrentTrack((currentTrack + 1) % tracks.length);
    setProgress(0);
  };

  const prevTrack = () => {
    setCurrentTrack((currentTrack - 1 + tracks.length) % tracks.length);
    setProgress(0);
  };

  return (
    <div className={cn("flex flex-col", isMaximized && "h-full")}>
      <div className={cn(
        "flex items-center gap-4",
        isMaximized && "flex-col text-center mb-8"
      )}>
        <div className={cn(
          "rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/30",
          "flex items-center justify-center",
          isMaximized ? "w-48 h-48 text-7xl" : "w-16 h-16 text-3xl"
        )}>
          {track.cover}
        </div>
        <div>
          <h3 className={cn(
            "font-medium",
            isMaximized ? "text-2xl" : "text-sm"
          )}>
            {track.title}
          </h3>
          <p className={cn(
            "text-white/50",
            isMaximized ? "text-lg" : "text-xs"
          )}>
            {track.artist}
          </p>
        </div>
      </div>

      <div className={cn("mt-4", isMaximized && "flex-1 flex flex-col justify-center")}>
        <div className="mb-4">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-400 to-purple-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>1:32</span>
            <span>{track.duration}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevTrack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <SkipBack className={cn("text-white/60", isMaximized ? "w-8 h-8" : "w-5 h-5")} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "rounded-full bg-white/20 hover:bg-white/30 transition-all",
              isMaximized ? "p-5" : "p-3"
            )}
          >
            {isPlaying ? (
              <Pause className={cn(isMaximized ? "w-8 h-8" : "w-5 h-5")} />
            ) : (
              <Play className={cn(isMaximized ? "w-8 h-8" : "w-5 h-5")} />
            )}
          </button>
          <button
            onClick={nextTrack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <SkipForward className={cn("text-white/60", isMaximized ? "w-8 h-8" : "w-5 h-5")} />
          </button>
        </div>

        {isMaximized && (
          <div className="mt-8">
            <h4 className="text-white/40 text-sm mb-3">Up Next</h4>
            <div className="space-y-2">
              {tracks.filter((_, i) => i !== currentTrack).map((t, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTrack(tracks.indexOf(t))}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <span className="text-2xl">{t.cover}</span>
                  <div>
                    <div className="text-sm">{t.title}</div>
                    <div className="text-xs text-white/40">{t.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
