import Link from 'next/link';

export default function NavigationDrawer() {
  return (
    <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40 w-[280px] bg-surface-container border-r border-white/10 shadow-2xl pt-16">
      <div className="p-container-padding border-b border-white/5 flex flex-col items-start gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img alt="VectoPath Logo" className="w-12 h-12 rounded-xl object-cover border border-primary-fixed-dim/30" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTZIYWo63xBtN2DTbN_YluUqLNLsNGmVORcwg8DABnie01aWDbGWVHcB-kECois0GaRGHQwzMIh1AncB8SfZadd2V5trDefiCsQ8aH1YQvdOeAZDeSOVKD4f0Ng5xvCU7eLRpAClwTHJHh8sbfMQnAaJKW_tSmDkt6cTjCChRiI0Xfyr0kq95H0PogTRHZqyttOgKbwXzdz8bTSjW1LFF2Q5k0uM8vjea2jkOLsQOC1zeeEetEYv6PFne1BcAZYiGEyoiX5Vwf1Gg" />
            <div className="absolute -inset-1 border-2 border-primary-fixed-dim rounded-xl anim-pulse-cyan"></div>
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-primary">Agent Cluster</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">6 Agents Active</p>
            <p className="font-label-sm text-label-sm text-primary-fixed-dim mt-1">System Nominal</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-stack-md flex flex-col gap-1">
        <Link href="/" className="text-on-surface-variant px-4 py-3 hover:bg-white/5 transition-colors duration-200 flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">work</span>
          <span className="font-label-md text-label-md">Job Ecosystem</span>
        </Link>
        <Link href="/education" className="text-on-surface-variant px-4 py-3 hover:bg-white/5 transition-colors duration-200 flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">school</span>
          <span className="font-label-md text-label-md">Education Ecosystem</span>
        </Link>
        <Link href="/agents" className="text-on-surface-variant px-4 py-3 hover:bg-white/5 transition-colors duration-200 flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">hub</span>
          <span className="font-label-md text-label-md">Agent Oversight</span>
        </Link>
      </div>
    </nav>
  );
}
