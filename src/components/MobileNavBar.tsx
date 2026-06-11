import Link from 'next/link';

export default function MobileNavBar() {
  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-low/80 backdrop-blur-md rounded-t-full border-t border-white/5 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
      <Link href="/" className="flex flex-col items-center justify-center text-primary-fixed-dim font-bold hover:bg-primary-container/10 rounded-xl px-4 py-1 hover:shadow-[0_0_15px_rgba(0,219,233,0.15)] active:scale-90 transition-all duration-200">
        <span className="material-symbols-outlined">work</span>
        <span className="font-label-sm text-label-sm mt-1">Job</span>
      </Link>
      <Link href="/education" className="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-on-surface transition-all active:scale-90 duration-200">
        <span className="material-symbols-outlined">school</span>
        <span className="font-label-sm text-label-sm mt-1">Education</span>
      </Link>
      <Link href="/agents" className="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-on-surface transition-all active:scale-90 duration-200">
        <span className="material-symbols-outlined">hub</span>
        <span className="font-label-sm text-label-sm mt-1">Agents</span>
      </Link>
    </nav>
  );
}
