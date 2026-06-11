"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function TopAppBar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-container-padding h-16 bg-surface/70 dark:bg-surface/70 backdrop-blur-xl border-b border-white/5 shadow-[0_0_20px_rgba(0,219,233,0.1)] md:pl-[304px]">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button (Hidden on md) */}
        <button className="md:hidden text-primary-fixed-dim hover:text-primary-fixed transition-colors duration-300">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="font-headline-lg-mobile md:font-headline-lg tracking-tighter font-black text-primary-fixed-dim hidden md:block">VectoPath</h1>
        <h1 className="font-headline-lg-mobile tracking-tighter font-black text-primary-fixed-dim md:hidden">VectoPath</h1>
      </div>
      <div className="flex items-center gap-4 relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="focus:outline-none transition-transform active:scale-95 hover:opacity-80"
        >
          <img alt="User profile" className="w-8 h-8 rounded-full border border-white/10 object-cover bg-white/5" src="https://api.dicebear.com/9.x/glass/svg?seed=Naren&backgroundColor=00dbe9" />
        </button>
        
        {isDropdownOpen && (
          <div className="absolute top-12 right-0 mt-2 w-56 bg-surface-container-high border border-white/10 rounded-xl shadow-2xl py-2 flex flex-col z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 mb-1">
              <p className="font-label-md text-white truncate">Naren</p>
              <p className="font-label-sm text-on-surface-variant truncate">naren@vectorpath.ai</p>
            </div>
            <Link href="/profile" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2.5 hover:bg-white/5 text-on-surface flex items-center gap-3 transition-colors">
              <span className="material-symbols-outlined text-lg">person</span>
              <span className="font-label-md text-label-md">Your Profile</span>
            </Link>
            <button className="px-4 py-2.5 hover:bg-white/5 text-on-surface flex items-center gap-3 transition-colors text-left">
              <span className="material-symbols-outlined text-lg">settings</span>
              <span className="font-label-md text-label-md">Settings</span>
            </button>
            <div className="h-px w-full bg-white/5 my-1"></div>
            <button className="px-4 py-2.5 hover:bg-error/10 text-error flex items-center gap-3 transition-colors text-left">
              <span className="material-symbols-outlined text-lg">logout</span>
              <span className="font-label-md text-label-md">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
