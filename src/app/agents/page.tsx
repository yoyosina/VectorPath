export default function AgentClusterOversight() {
  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface text-glow">Cluster Oversight</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Real-time telemetry and state mutation monitoring.</p>
        </div>
        <button className="flex items-center gap-2 bg-secondary-container text-white px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-on-secondary-fixed-variant transition-all border border-secondary-fixed/20 shadow-[0_0_15px_rgba(87,27,193,0.3)]">
          <span className="material-symbols-outlined text-sm">download</span>
          Download Excel Ledger
        </button>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">
        {/* Global Status Visualization */}
        <div className="lg:col-span-8 bg-surface-container rounded-xl p-6 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim to-secondary-container"></div>
          <h3 className="font-headline-md text-white mb-4">System Telemetry</h3>
          <div className="flex items-center justify-center h-64 border border-dashed border-white/10 rounded-lg bg-surface-dim/50">
            <p className="text-on-surface-variant flex items-center gap-2">
               <span className="material-symbols-outlined animate-spin text-primary-fixed-dim">sync</span>
               Waiting for Agent Streams...
            </p>
          </div>
        </div>

        {/* Agent Logs */}
        <div className="lg:col-span-4 glass-panel rounded-xl p-6 border-cyan-top flex flex-col gap-4">
          <h3 className="font-headline-md text-white">Active Logs</h3>
          <div className="flex-1 bg-[#020617] rounded-lg p-4 font-mono text-xs terminal-scroll overflow-y-auto border border-white/5 space-y-3 h-64">
             <div className="text-primary-fixed-dim">[SYS] Initializing Cluster Manager...</div>
             <div className="text-on-surface-variant"><span className="text-primary-fixed">[SCOUT]</span> Executing LinkedIn query for "Frontend"...</div>
             <div className="text-secondary-fixed"><span className="text-secondary-fixed-dim">[MATCH]</span> Ranking complete. Best match: 94%.</div>
             <div className="text-on-surface-variant"><span className="text-primary-container">[EXEC]</span> Completing Workday form for Requisition ID: #4492...</div>
          </div>
        </div>
      </div>
    </>
  );
}
