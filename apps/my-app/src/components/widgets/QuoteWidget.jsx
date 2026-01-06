import React, { useState } from 'react';
import { RefreshCw, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QuoteWidget({ isMaximized }) {
  const quotes = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    { text: "Design is not just what it looks like. Design is how it works.", author: "Steve Jobs" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const nextQuote = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((currentIndex + 1) % quotes.length);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className={cn(
      "flex flex-col",
      isMaximized && "h-full justify-center items-center"
    )}>
      <Quote className={cn(
        "text-white/20 mb-4",
        isMaximized ? "w-16 h-16" : "w-8 h-8"
      )} />
      
      <div className={cn(
        "transition-all duration-300",
        isAnimating && "opacity-0 transform translate-y-4"
      )}>
        <p className={cn(
          "font-light leading-relaxed",
          isMaximized ? "text-3xl text-center max-w-2xl" : "text-lg"
        )}>
          "{quotes[currentIndex].text}"
        </p>
        <p className={cn(
          "text-white/50 mt-4",
          isMaximized ? "text-xl text-center" : "text-sm"
        )}>
          — {quotes[currentIndex].author}
        </p>
      </div>

      <button
        onClick={nextQuote}
        className={cn(
          "mt-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all",
          "hover:rotate-180 duration-500",
          isMaximized && "mx-auto"
        )}
      >
        <RefreshCw className="w-5 h-5" />
      </button>
    </div>
  );
}
