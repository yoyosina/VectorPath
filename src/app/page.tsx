"use client";

import { useState, useEffect } from "react";
import ResumeUploader from "../components/ResumeUploader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function JobEcosystem() {
  const [skills, setSkills] = useState<{name: string, confidence: string}[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [skip, setSkip] = useState(0);
  const [daemonStatus, setDaemonStatus] = useState<any>(null);
  const [metrics, setMetrics] = useState({ applied: 0, interviews: 0, selected: 0, education: 0 });
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeModalJob, setActiveModalJob] = useState<any | null>(null);
  const [summaryModalJob, setSummaryModalJob] = useState<any | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const openSummaryModal = async (job: any) => {
    setSummaryModalJob({
      ...job,
      summary: job.description ? (job.description.slice(0, 250) + "...") : "Analyzing posting details...",
      responsibilities: ["Synthesizing daily expectations..."],
      recruiter_expectations: job.job_skill_map || ["Analyzing required qualifications..."]
    });
    setIsSummaryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs/${job.id}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryModalJob(data);
      }
    } catch (err) {
      console.error("Failed to fetch job summary:", err);
    } finally {
      setIsSummaryLoading(false);
    }
  };


  // Poll live telemetry logs when modal is active
  useEffect(() => {
    if (!activeModalJob || !userId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_URL}/api/logs/latest?user_id=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setAgentLogs(data.logs || []);
        }
      } catch (e) {
        console.error("Error polling logs:", e);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [activeModalJob, userId]);

  // Fetch the latest user profile on load so they don't have to re-upload (with retry)

  useEffect(() => {
    let retries = 5;
    const fetchLatestUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/latest`);
        if (res.ok) {
          const data = await res.json();
          if (data.user_id && data.skills && data.skills.length > 0) {
            setUserId(data.user_id);
            setSkills(data.skills);
            setIsProfileLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch user, retrying...", err);
      }
      if (retries > 0) {
        retries--;
        setTimeout(fetchLatestUser, 2000);
      } else {
        setIsProfileLoading(false);
      }
    };
    fetchLatestUser();
  }, []);

  // Poll Metrics
  useEffect(() => {
    if (!userId) return;
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/api/dashboard/metrics?user_id=${userId}`);
        if (res.ok) {
          setMetrics(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  // Poll Daemon Status
  useEffect(() => {
    if (!userId) return;
    const pollStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/daemon/status?user_id=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setDaemonStatus(data);
        }
      } catch (err) {
        console.error("Failed to poll daemon status:", err);
      }
    };
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchJobs = async (skipCount: number, append: boolean = false, isPolling: boolean = false) => {
    if (skills.length === 0 || !userId) return;
    if (!isPolling) setIsLoadingJobs(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, skills, skip: skipCount, limit: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setJobs(prev => [...prev, ...data.jobs]);
        } else {
          setJobs(data.jobs);
        }
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      if (!isPolling) setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (skills.length > 0 && userId && jobs.length === 0) {
      fetchJobs(0, false);
    }
  }, [skills, userId]);

  // Poll for new jobs every 15 seconds if we are on the first page
  useEffect(() => {
    if (!userId || skills.length === 0 || skip !== 0) return;
    
    const interval = setInterval(() => {
      // Background fetch without showing full page loader
      fetchJobs(0, false, true);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [userId, skills, skip]);

  const handleApply = async (jobId: number) => {
    const targetJob = jobs.find(j => j.id === jobId);
    setActiveModalJob({
      id: jobId,
      title: targetJob?.title || "Target Position",
      company: targetJob?.company || "Target Company",
      status: "🤖 AI Agent initializing & synthesizing application packet...",
      cover_letter: ""
    });
    setIsCopied(false);
    try {
      const res = await fetch(`${API_URL}/api/jobs/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, job_id: jobId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveModalJob((prev: any) => ({
          ...prev,
          status: data.autopilot_status || "Autopilot Agent Activated",
          cover_letter: data.cover_letter || ""
        }));
      }
      setMetrics(prev => ({ ...prev, applied: prev.applied + 1 }));
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, applied: true } : j));
    } catch (err) {
      console.error("Failed to apply", err);
    }
  };


  const loadMore = () => {
    const nextSkip = skip + 10;
    setSkip(nextSkip);
    fetchJobs(nextSkip, true);
  };

  if (isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin glow-cyan"></div>
        <p className="mt-4 text-on-surface-variant font-label-lg">Loading your profile vector...</p>
      </div>
    );
  }

  return (
    <>
      {skills.length === 0 && !isProfileLoading && <ResumeUploader onSkillsExtracted={(s, id) => { setSkills(s); setUserId(id); setIsProfileLoading(false); }} />}

      {userId && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center glow-cyan transition-transform hover:-translate-y-1">
            <span className="text-3xl font-black text-primary">{metrics.applied}</span>
            <span className="text-sm text-on-surface-variant mt-1 font-label-md">Jobs Applied</span>
          </div>
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center glow-cyan transition-transform hover:-translate-y-1">
            <span className="text-3xl font-black text-primary">{metrics.interviews}</span>
            <span className="text-sm text-on-surface-variant mt-1 font-label-md">Interviews</span>
          </div>
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center glow-cyan transition-transform hover:-translate-y-1">
            <span className="text-3xl font-black text-primary">{metrics.selected}</span>
            <span className="text-sm text-on-surface-variant mt-1 font-label-md">Selected / Offers</span>
          </div>
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center glow-cyan transition-transform hover:-translate-y-1">
            <span className="text-3xl font-black text-primary">{metrics.education}</span>
            <span className="text-sm text-on-surface-variant mt-1 font-label-md">Education Programs</span>
          </div>
        </section>
      )}

      {userId && daemonStatus && (
        <section className="glass-panel rounded-xl p-6 glow-cyan mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-headline-md text-headline-md text-primary-fixed-dim flex items-center gap-2">
              <span className="material-symbols-outlined">{daemonStatus.is_running ? 'cached' : 'stop_circle'}</span>
              Autonomous Web Scout
            </h3>
            <span className={`font-label-sm px-3 py-1 rounded-full border ${daemonStatus.is_running ? 'bg-primary-fixed-dim/10 text-primary border-primary-fixed-dim/30 animate-pulse' : 'bg-error/10 text-error border-error/30'}`}>
              {daemonStatus.is_running ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex justify-between text-sm text-on-surface-variant mb-2">
            <span>Jobs Collected: {daemonStatus.total_jobs_scraped} / 10,000</span>
            {daemonStatus.last_error && <span className="text-error truncate max-w-xs" title={daemonStatus.last_error}>Error: {daemonStatus.last_error}</span>}
          </div>
          <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
            <div className="h-full bg-primary-fixed-dim" style={{ width: `${Math.min(100, (daemonStatus.total_jobs_scraped / 10000) * 100)}%` }}></div>
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section className="glass-panel rounded-xl p-6 glow-cyan mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-md text-headline-md text-primary-fixed-dim flex items-center gap-2">
              <span className="material-symbols-outlined">data_object</span>
              Profile Vectorization
            </h3>
            <span className="font-label-sm text-label-sm text-primary px-3 py-1 bg-primary-fixed-dim/10 rounded-full border border-primary-fixed-dim/30">Synced</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {skills.map((skill, index) => (
              <span 
                key={index} 
                className={`px-3 py-1 rounded-full font-label-md text-label-md border flex items-center gap-1 ${
                  skill.confidence === 'High' 
                  ? 'bg-primary-fixed-dim/10 text-primary border-primary-fixed-dim/30' 
                  : 'bg-outline-variant/30 text-on-surface-variant border-outline-variant/50 opacity-70'
                }`}
                title={`${skill.confidence} Confidence`}
              >
                {skill.confidence === 'High' ? (
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">help</span>
                )}
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {skills.length > 0 && isLoadingJobs && (
        <div className="flex justify-center items-center py-10 text-primary animate-pulse">
          <span className="material-symbols-outlined animate-spin text-3xl mr-2">sync</span>
          <span className="text-lg">Scoring jobs via AI Ensemble...</span>
        </div>
      )}

      {skills.length > 0 && jobs.length > 0 && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {jobs.map((job, idx) => (
            <article 
              key={idx} 
              onClick={() => openSummaryModal(job)}
              className="glass-panel rounded-xl p-6 border-cyan-top flex flex-col gap-4 hover:shadow-[0_0_30px_rgba(0,219,233,0.2)] transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-headline-md text-headline-md text-on-surface mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                    {job.title}
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity text-primary">info</span>
                  </h4>
                  <p className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">apartment</span>
                    {job.company} • {job.location}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-label-sm text-label-sm text-primary-fixed-dim mb-1">Dual Ensemble Match</span>
                  <div className="text-xl font-black text-primary">{job.match_score}%</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {job.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-surface-variant rounded text-xs text-on-surface-variant">{tag}</span>
                ))}
                <span className="px-2 py-1 bg-surface-variant rounded text-xs text-on-surface-variant font-medium text-primary-fixed-dim">{job.salary}</span>
              </div>
              <div className="bg-surface-container-low p-4 rounded-lg mt-2 border border-outline-variant/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Probability of Admission</span>
                  <span className="font-label-md text-label-md text-primary">{job.match_score > 85 ? 'High' : job.match_score > 70 ? 'Medium' : 'Low'}</span>
                </div>
                <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
                  <div className="h-full bg-primary-fixed-dim progress-fill" style={{ width: `${job.match_score}%` }}></div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-auto pt-4">
                <div className="flex items-center gap-2 text-primary-fixed-dim text-sm">
                  <span className="material-symbols-outlined text-base animate-pulse">robot_2</span>
                  Ready to Autopilot
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!job.applied) handleApply(job.id);
                  }}
                  disabled={job.applied}
                  className={`px-4 py-2 bg-transparent border border-primary-fixed-dim text-primary-fixed-dim rounded font-label-md text-label-md ${job.applied ? 'opacity-50 cursor-not-allowed bg-primary-fixed-dim/20' : 'hover:bg-primary-fixed-dim hover:text-black transition-colors'}`}
                >
                  {job.applied ? "Applied ✓" : "Apply Now"}
                </button>
              </div>
            </article>
          ))}

        </section>
      )}

      {skills.length > 0 && !isLoadingJobs && (
        <div className="flex justify-center mt-8 mb-8">
          <button 
            onClick={loadMore}
            className="px-6 py-3 bg-surface-variant text-on-surface rounded-full hover:bg-primary hover:text-black transition-colors font-label-lg shadow-lg"
          >
            {jobs.length > 0 ? "Load Next 10 Best Matches" : "Refresh Discovered Jobs"}
          </button>
        </div>
      )}

      {activeModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-3xl rounded-2xl p-6 border-cyan-top flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-start pb-4 border-b border-outline-variant/30">
              <div>
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mb-1">
                  <span className="material-symbols-outlined text-sm animate-spin">smart_toy</span>
                  Autonomous Agentic Autopilot
                </div>
                <h3 className="text-xl font-bold text-on-surface">{activeModalJob.title}</h3>
                <p className="text-sm text-on-surface-variant">{activeModalJob.company}</p>
              </div>
              <button 
                onClick={() => setActiveModalJob(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {/* Agent Status Badge */}
              <div className="bg-primary-fixed-dim/10 border border-primary-fixed-dim/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary animate-pulse text-2xl">rocket_launch</span>
                  <div>
                    <div className="text-xs text-on-surface-variant font-medium">Agent Status</div>
                    <div className="text-sm font-bold text-primary">{activeModalJob.status}</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-primary text-black rounded-full text-xs font-bold">LIVE TELEMETRY</span>
              </div>

              {/* Cover Letter Generator Section */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">description</span>
                    Tailored AI Cover Letter
                  </h4>
                  {activeModalJob.cover_letter && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeModalJob.cover_letter);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">{isCopied ? "check" : "content_copy"}</span>
                      {isCopied ? "Copied to Clipboard!" : "Copy Cover Letter"}
                    </button>
                  )}
                </div>

                {activeModalJob.cover_letter ? (
                  <div className="whitespace-pre-wrap text-xs text-on-surface leading-relaxed bg-black/40 p-4 rounded-lg font-mono border border-outline-variant/20 max-h-60 overflow-y-auto select-all">
                    {activeModalJob.cover_letter}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl animate-spin text-primary mb-2">sync</span>
                    <span className="text-xs">Synthesizing personalized cover letter using Gemini 2.5 Flash...</span>
                  </div>
                )}
              </div>

              {/* Real-time Agent Execution Stream */}
              <div className="bg-black/60 rounded-xl p-4 border border-outline-variant/30 font-mono text-xs">
                <div className="flex items-center gap-2 text-on-surface-variant text-[11px] mb-2 font-sans font-semibold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-xs text-emerald-400">terminal</span>
                  Agentic AI Live Telemetry Stream
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
                  {agentLogs.filter(l => l.level === "AUTOPILOT").length > 0 ? (
                    agentLogs.filter(l => l.level === "AUTOPILOT").map((log: any, i: number) => (
                      <div key={i} className="text-emerald-400 flex items-start gap-2">
                        <span className="text-on-surface-variant text-[10px] select-none">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span>{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-on-surface-variant italic">Connecting to background Playwright autonomous agent worker...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
              <button
                onClick={() => setActiveModalJob(null)}
                className="px-5 py-2.5 bg-primary text-black rounded-lg font-bold text-xs hover:bg-primary-fixed-dim transition-colors"
              >
                Close Autopilot Kit
              </button>
            </div>
          </div>
        </div>
      )}

      {summaryModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-3xl rounded-2xl p-6 border-cyan-top flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-start pb-4 border-b border-outline-variant/30">
              <div>
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mb-1">
                  <span className="material-symbols-outlined text-sm">analytics</span>
                  AI Job Intelligence Briefing
                </div>
                <h3 className="text-xl font-bold text-on-surface">{summaryModalJob.title}</h3>
                <p className="text-sm text-on-surface-variant flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">apartment</span>{summaryModalJob.company}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">location_on</span>{summaryModalJob.location}</span>
                </p>
              </div>
              <button 
                onClick={() => setSummaryModalJob(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {/* Key Metadata Badges */}
              <div className="flex flex-wrap gap-3">
                <div className="bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">payments</span>
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Compensation</div>
                    <div className="text-xs font-bold text-on-surface">{summaryModalJob.salary || "Competitive"}</div>
                  </div>
                </div>
                <div className="bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">distance</span>
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Location / Workplace</div>
                    <div className="text-xs font-bold text-on-surface">{summaryModalJob.location || "Remote / Onsite"}</div>
                  </div>
                </div>
                {summaryModalJob.match_score !== undefined && (
                  <div className="bg-primary/10 px-4 py-2 rounded-xl border border-primary/30 flex items-center gap-2 ml-auto">
                    <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                    <div>
                      <div className="text-[10px] text-primary-fixed-dim uppercase tracking-wider">AI Ensemble Match</div>
                      <div className="text-xs font-black text-primary">{summaryModalJob.match_score}%</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Loader or AI Summary */}
              {isSummaryLoading && (
                <div className="flex items-center justify-center py-6 text-primary animate-pulse bg-black/30 rounded-xl border border-outline-variant/20">
                  <span className="material-symbols-outlined animate-spin mr-2">sync</span>
                  <span className="text-xs font-medium">Gemini 2.5 Flash synthesizing executive job summary...</span>
                </div>
              )}

              {/* 1. Executive Summary */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">summarize</span>
                  Executive Role Overview
                </h4>
                <p className="text-xs text-on-surface leading-relaxed">{summaryModalJob.summary}</p>
              </div>

              {/* 2. Responsibilities */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">task_alt</span>
                  What You Are Expected To Do
                </h4>
                <ul className="space-y-2 text-xs text-on-surface">
                  {Array.isArray(summaryModalJob.responsibilities) ? (
                    summaryModalJob.responsibilities.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">check_circle</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">check_circle</span>
                      <span>{summaryModalJob.responsibilities}</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* 3. What Recruiter is Looking For */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">person_search</span>
                  What The Recruiter Is Looking For
                </h4>
                <ul className="space-y-2 text-xs text-on-surface mb-3">
                  {Array.isArray(summaryModalJob.recruiter_expectations) ? (
                    summaryModalJob.recruiter_expectations.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary-fixed-dim text-sm shrink-0 mt-0.5">star</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary-fixed-dim text-sm shrink-0 mt-0.5">star</span>
                      <span>{summaryModalJob.recruiter_expectations}</span>
                    </li>
                  )}
                </ul>

                {summaryModalJob.job_skill_map && summaryModalJob.job_skill_map.length > 0 && (
                  <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap gap-1.5">
                    {summaryModalJob.job_skill_map.map((s: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[11px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/30 flex justify-between items-center">
              <button
                onClick={() => setSummaryModalJob(null)}
                className="px-4 py-2 bg-surface-variant text-on-surface rounded-lg font-bold text-xs hover:bg-outline-variant transition-colors"
              >
                Close Briefing
              </button>
              <button
                onClick={() => {
                  const jId = summaryModalJob.id;
                  setSummaryModalJob(null);
                  handleApply(jId);
                }}
                className="px-5 py-2.5 bg-primary text-black rounded-lg font-bold text-xs hover:bg-primary-fixed-dim transition-colors flex items-center gap-1.5 shadow-lg"
              >
                <span className="material-symbols-outlined text-base">rocket_launch</span>
                Apply Now via Autopilot
              </button>
            </div>
          </div>
        </div>
      )}
    </>


  );
}
