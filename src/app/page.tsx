"use client";

import { useState, useEffect } from "react";
import ResumeUploader from "../components/ResumeUploader";

export default function JobEcosystem() {
  const [skills, setSkills] = useState<{name: string, confidence: string}[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [skip, setSkip] = useState(0);
  const [daemonStatus, setDaemonStatus] = useState<any>(null);
  const [metrics, setMetrics] = useState({ applied: 0, interviews: 0, selected: 0, education: 0 });
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Fetch the latest user profile on load so they don't have to re-upload (with retry)
  useEffect(() => {
    let retries = 5;
    const fetchLatestUser = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/user/latest");
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
        const res = await fetch(`http://localhost:8000/api/dashboard/metrics?user_id=${userId}`);
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
        const res = await fetch(`http://localhost:8000/api/daemon/status?user_id=${userId}`);
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

  const fetchJobs = async (skipCount: number, append: boolean = false) => {
    if (skills.length === 0 || !userId) return;
    setIsLoadingJobs(true);
    try {
      const res = await fetch("http://localhost:8000/api/jobs/recommend", {
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
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (skills.length > 0 && userId && jobs.length === 0) {
      fetchJobs(0, false);
    }
  }, [skills, userId]);

  // Auto-fetch jobs if daemon scraped them and we currently have 0 jobs
  useEffect(() => {
    if (skills.length > 0 && userId && jobs.length === 0 && daemonStatus?.total_jobs_scraped > 0 && !isLoadingJobs) {
      fetchJobs(0, false);
    }
  }, [daemonStatus?.total_jobs_scraped, skills, userId, jobs.length, isLoadingJobs]);

  const handleApply = async (jobId: number) => {
    try {
      await fetch("http://localhost:8000/api/jobs/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, job_id: jobId }),
      });
      // Increment applied metric optimistically
      setMetrics(prev => ({ ...prev, applied: prev.applied + 1 }));
      // Remove job from list
      setJobs(prev => prev.filter(j => j.id !== jobId));
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
            <article key={idx} className="glass-panel rounded-xl p-6 border-cyan-top flex flex-col gap-4 hover:shadow-[0_0_30px_rgba(0,219,233,0.1)] transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-headline-md text-headline-md text-on-surface mb-1">{job.title}</h4>
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
                  onClick={() => handleApply(job.id)}
                  className="px-4 py-2 bg-transparent border border-primary-fixed-dim text-primary-fixed-dim rounded hover:bg-primary-fixed-dim hover:text-black transition-colors font-label-md text-label-md"
                >
                  Apply Now
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
    </>
  );
}
