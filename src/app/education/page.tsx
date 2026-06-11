export default function EducationEcosystem() {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-white mb-2">Education Ecosystem</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">Matchmaker AI has filtered 4,200 global programs down to optimal ROI pathways aligned with your profile.</p>
        </div>
        <div className="glass-panel p-3 rounded-xl flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-2 border-primary-fixed-dim agent-pulse"></div>
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-white/10 relative z-10">
              <span className="material-symbols-outlined text-primary-fixed-dim text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>join_inner</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Active Agent</span>
            <span className="font-label-md text-label-md text-white">Matchmaker Processing</span>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary-fixed-dim">stars</span>
          <h3 className="font-headline-md text-headline-md text-white">Tier 1: Fully Funded Programs</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-primary-fixed-dim/50 to-transparent ml-4"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="glass-panel rounded-xl p-6 glow-tier1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-fixed-dim/5 rounded-bl-full -z-10 group-hover:bg-primary-fixed-dim/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-fixed-dim/10 text-primary-fixed-dim font-label-sm text-label-sm mb-3">
                  <span className="material-symbols-outlined text-[14px]">verified</span> Fully Funded
                </div>
                <h4 className="font-headline-md text-headline-md text-white">PhD in Machine Learning</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">Technical University of Munich</p>
              </div>
              <div className="text-right">
                <div className="font-headline-md text-headline-md text-white">#37</div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">QS World Rank</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface/50 rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">location_city</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Munich, DE</span>
                </div>
                <div className="font-body-md text-body-md text-white">€1,200/mo Est. Cost</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-secondary-fixed text-sm">trending_up</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">ROI Metric</span>
                </div>
                <div className="font-body-md text-body-md text-white">98% Placement</div>
              </div>
            </div>
            <button className="w-full py-3 rounded-lg bg-primary-fixed-dim text-[#020617] font-label-md text-label-md hover:bg-white transition-colors duration-200">
              Initiate Application
            </button>
          </div>

          {/* Card 2 */}
          <div className="glass-panel rounded-xl p-6 glow-tier1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-fixed-dim/5 rounded-bl-full -z-10 group-hover:bg-primary-fixed-dim/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-fixed-dim/10 text-primary-fixed-dim font-label-sm text-label-sm mb-3">
                  <span className="material-symbols-outlined text-[14px]">verified</span> Stipend Included
                </div>
                <h4 className="font-headline-md text-headline-md text-white">MSc Artificial Intelligence</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">KTH Royal Institute</p>
              </div>
              <div className="text-right">
                <div className="font-headline-md text-headline-md text-white">#73</div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">QS World Rank</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface/50 rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">location_city</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Stockholm, SE</span>
                </div>
                <div className="font-body-md text-body-md text-white">€1,450/mo Est. Cost</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-secondary-fixed text-sm">thermostat</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Climate</span>
                </div>
                <div className="font-body-md text-body-md text-white">Temperate/Cold</div>
              </div>
            </div>
            <button className="w-full py-3 rounded-lg border border-primary-fixed-dim text-primary-fixed-dim font-label-md text-label-md hover:bg-primary-fixed-dim/10 transition-colors duration-200">
              Review Details
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-secondary-container">show_chart</span>
          <h3 className="font-headline-md text-headline-md text-white">Tier 2: High ROI Private</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-secondary-container/50 to-transparent ml-4"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel rounded-xl p-5 glow-tier2">
            <h5 className="font-headline-md text-headline-md text-white mb-1 text-lg">Data Science MS</h5>
            <p className="font-body-md text-body-md text-on-surface-variant text-sm mb-4">Northeastern University</p>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Tuition</span>
                <span className="font-label-md text-label-md text-white">$54k</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Avg Starting</span>
                <span className="font-label-md text-label-md text-secondary-fixed">$112k</span>
              </div>
              <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-[#031427] to-[#571bc1] w-[85%]"></div>
              </div>
            </div>
            <button className="w-full py-2 rounded-lg border border-white/10 text-white font-label-md text-label-md hover:bg-white/5 transition-colors duration-200">
              View ROI Calc
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
