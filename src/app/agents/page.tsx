'use client';

import React, { useEffect, useState, useRef } from "react";

const API_URL = "https://vectorpath.onrender.com";

interface TelemetryStats {
  total_jobs: number;
  high_match: number;
  medium_match: number;
  low_match: number;
  unscored: number;
  daemon_running: boolean;
  last_scraped: string | null;
}

export default function AgentClusterOversight() {
  const [logs, setLogs] = useState<{level: string, message: string, timestamp: string}[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    total_jobs: 0,
    high_match: 0,
    medium_match: 0,
    low_match: 0,
    unscored: 0,
    daemon_running: false,
    last_scraped: null
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch telemetry stats
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const userId = localStorage.getItem("vp_user_id") || "2";
        const res = await fetch(`${API_URL}/api/telemetry/stats?user_id=${userId}`);
        if (res.ok) {
          setTelemetry(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch telemetry stats:", err);
      }
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const userId = localStorage.getItem("vp_user_id") || "2";
        const res = await fetch(`${API_URL}/api/logs/latest?user_id=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate percentages for the distribution chart
  const totalScored = telemetry.high_match + telemetry.medium_match + telemetry.low_match;
  const getPct = (val: number) => {
    if (totalScored === 0) return 0;
    return Math.round((val / totalScored) * 100);
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Global Status Visualization (Telemetry) */}
        <div className="lg:col-span-8 bg-surface-container rounded-xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim to-secondary-container"></div>
          
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-white">System Telemetry</h3>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5 ${
              telemetry.daemon_running 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <span className={`w-2 h-2 rounded-full ${telemetry.daemon_running ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
              Daemon {telemetry.daemon_running ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            {/* Left side: Live Ring / Radar Visualizer */}
            <div className="flex flex-col items-center justify-center p-4 border border-white/5 rounded-lg bg-surface-dim/40 relative">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Outer spinning ring */}
                <div className="absolute inset-0 border-2 border-dashed border-cyan-400/20 rounded-full animate-spin [animation-duration:15s]"></div>
                {/* Inner pulsing ring */}
                <div className="absolute w-28 h-28 border border-primary/30 rounded-full animate-ping [animation-duration:3s]"></div>
                {/* Core Status */}
                <div className="w-24 h-24 rounded-full bg-surface-container border border-white/10 flex flex-col items-center justify-center z-10 shadow-lg">
                  <span className="text-2xl font-black text-primary">{telemetry.total_jobs}</span>
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Total Scraped</span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant mt-4 font-mono">
                Memory state mutations: <span className="text-cyan-300">Synchronized</span>
              </p>
            </div>

            {/* Right side: Real-time Match Score Distribution */}
            <div className="flex flex-col justify-center gap-3 p-4 border border-white/5 rounded-lg bg-surface-dim/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Match Profile Distribution</h4>
              
              {/* High Matches */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">High Match (80%+)</span>
                  <span className="text-white">{telemetry.high_match} jobs ({getPct(telemetry.high_match)}%)</span>
                </div>
                <div className="w-full h-2 bg-surface-dim rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${getPct(telemetry.high_match)}%` }}></div>
                </div>
              </div>

              {/* Medium Matches */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-cyan-400 font-bold">Medium Match (50-79%)</span>
                  <span className="text-white">{telemetry.medium_match} jobs ({getPct(telemetry.medium_match)}%)</span>
                </div>
                <div className="w-full h-2 bg-surface-dim rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full transition-all duration-500" style={{ width: `${getPct(telemetry.medium_match)}%` }}></div>
                </div>
              </div>

              {/* Low Matches */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-rose-400 font-bold">Low Match (&lt;50%)</span>
                  <span className="text-white">{telemetry.low_match} jobs ({getPct(telemetry.low_match)}%)</span>
                </div>
                <div className="w-full h-2 bg-surface-dim rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${getPct(telemetry.low_match)}%` }}></div>
                </div>
              </div>

              {/* Unscored Queue */}
              {telemetry.unscored > 0 && (
                <div className="space-y-1 mt-2 p-2 bg-white/5 border border-white/5 rounded">
                  <div className="flex justify-between text-xs font-mono text-on-surface-variant">
                    <span className="animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                      Evaluating Match Scores...
                    </span>
                    <span>{telemetry.unscored} queued</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Agent Logs */}
        <div className="lg:col-span-4 glass-panel rounded-xl p-6 border-cyan-top flex flex-col gap-4">
          <h3 className="font-headline-md text-white">Active Logs</h3>
          <div className="flex-1 bg-[#020617] rounded-lg p-4 font-mono text-xs terminal-scroll overflow-y-auto border border-white/5 space-y-3 h-64">
             {logs.length === 0 ? (
                <div className="text-primary-fixed-dim animate-pulse">[SYS] Initializing Cluster Manager...</div>
             ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={
                    log.level === 'ERROR' ? 'text-red-400' :
                    log.level === 'SCOUT' ? 'text-cyan-300' :
                    log.level === 'MATCH' ? 'text-green-400' :
                    log.level === 'EXEC' ? 'text-purple-400' :
                    'text-on-surface-variant'
                  }>
                    <span className="font-bold">[{log.level}]</span> {log.message}
                  </div>
                ))
             )}
             <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </>
  );
}
