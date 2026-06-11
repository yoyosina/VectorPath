"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ResumeUploader({ onSkillsExtracted }: { onSkillsExtracted: (skills: any[], userId: number) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/resume/parse`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to parse resume.");
      }
      
      const data = await res.json();
      onSkillsExtracted(data.skills, data.user_id);
      
    } catch (err: any) {
      setError(err.message || "An error occurred during processing.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl p-6 glow-cyan relative overflow-hidden flex flex-col items-center justify-center border border-white/5 bg-surface-container/50 min-h-[200px] w-full mb-6">
      <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Upload Your Resume</h3>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6 text-center max-w-lg">
        Upload your PDF resume. Our LangGraph ensemble (Gemini 2.5 Flash + Groq Llama-3) will extract your skills and calculate matching confidence.
      </p>
      
      <label className="relative cursor-pointer group">
        <input 
          type="file" 
          accept=".pdf"
          className="hidden" 
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        <div className={`px-6 py-3 rounded-full font-label-md text-label-md transition-all duration-300 flex items-center gap-2 ${isUploading ? 'bg-outline-variant text-on-surface-variant cursor-not-allowed' : 'bg-primary text-on-secondary hover:scale-105 hover:shadow-[0_0_15px_var(--color-primary)]'}`}>
          <span className="material-symbols-outlined text-[20px]">
            {isUploading ? 'hourglass_empty' : 'upload_file'}
          </span>
          {isUploading ? 'AI Ensemble Processing...' : 'Select PDF Resume'}
        </div>
      </label>
      
      {error && (
        <div className="mt-4 text-error font-label-sm flex items-center gap-1 bg-error/10 px-3 py-2 rounded">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </div>
      )}
    </div>
  );
}
