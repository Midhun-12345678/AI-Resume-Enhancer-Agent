import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { 
  Upload, 
  FileText, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2,
  Zap,
  Target,
  Shield,
  ArrowRight,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ATS Score Ring Component
const ATSScoreRing = ({ score, size = 140, label = "ATS Score" }) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score) => {
    if (score >= 70) return "#10B981";
    if (score >= 50) return "#F59E0B";
    return "#F43F5E";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1E293B"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ 
            filter: `drop-shadow(0 0 10px ${getColor(score)}50)`,
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-['JetBrains_Mono'] text-4xl font-bold text-white">{score}</span>
        <span className="text-[#94A3B8] text-xs">{label}</span>
      </div>
    </div>
  );
};

// Suggestion Card Component
const SuggestionCard = ({ suggestion, onApprove, onReject, isApproved, isRejected, isExpanded, onToggle }) => {
  const sectionColors = {
    summary: "#6366F1",
    skills: "#06B6D4",
    experience: "#EC4899",
    education: "#F59E0B",
    projects: "#10B981",
    other: "#94A3B8"
  };

  const impactColors = {
    high: "#F43F5E",
    medium: "#F59E0B",
    low: "#10B981"
  };

  const color = sectionColors[suggestion.section] || sectionColors.other;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        isApproved 
          ? 'bg-[#10B981]/5 border-[#10B981]/30' 
          : isRejected
          ? 'bg-[#F43F5E]/5 border-[#F43F5E]/30 opacity-50'
          : 'bg-[#0A0A0F] border-[#1E293B] hover:border-[#6366F1]/30'
      }`}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full" data-testid={`suggestion-toggle-${suggestion.id}`}>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <Badge variant="outline" className="capitalize text-xs" style={{ borderColor: color, color: color }}>
                {suggestion.section}
              </Badge>
              <Badge 
                variant="outline" 
                className="capitalize text-xs"
                style={{ borderColor: impactColors[suggestion.impact], color: impactColors[suggestion.impact] }}
              >
                {suggestion.impact} impact
              </Badge>
              {isApproved && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
              {isRejected && <X className="w-4 h-4 text-[#F43F5E]" />}
            </div>
            <div className="flex items-center gap-2">
              {suggestion.keywords_added?.length > 0 && (
                <span className="text-xs text-[#6366F1]">+{suggestion.keywords_added.length} keywords</span>
              )}
              {isExpanded ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {/* Reason */}
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-[#6366F1]/5 border border-[#6366F1]/10">
              <Lightbulb className="w-4 h-4 text-[#6366F1] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#94A3B8]">{suggestion.reason}</p>
            </div>

            {/* Diff View */}
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#F43F5E]/5 border-l-4 border-[#F43F5E]">
                <p className="text-xs text-[#F43F5E] mb-1 font-medium">Original Text</p>
                <p className="text-sm text-[#94A3B8] line-through">{suggestion.original_text}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#10B981]/5 border-l-4 border-[#10B981]">
                <p className="text-xs text-[#10B981] mb-1 font-medium">Suggested Replacement</p>
                <p className="text-sm text-white">{suggestion.suggested_text}</p>
              </div>
            </div>

            {/* Keywords Added */}
            {suggestion.keywords_added?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-[#475569] mb-2">Keywords Added:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.keywords_added.map((kw, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-[#6366F1]/10 text-[#6366F1]">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {!isApproved && !isRejected && (
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={(e) => { e.stopPropagation(); onApprove(suggestion.id); }}
                  data-testid={`approve-${suggestion.id}`}
                  className="flex-1 bg-[#10B981] hover:bg-[#0D9668] text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve Change
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); onReject(suggestion.id); }}
                  variant="outline"
                  data-testid={`reject-${suggestion.id}`}
                  className="flex-1 border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E]/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
};

// Main App Component
const App = () => {
  // State
  const [step, setStep] = useState(1); // 1: Upload, 2: Analysis, 3: Results
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  // Analysis results
  const [atsScoreBefore, setAtsScoreBefore] = useState(0);
  const [atsScorePotential, setAtsScorePotential] = useState(0);
  const [atsScoreAfter, setAtsScoreAfter] = useState(null);
  const [issues, setIssues] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [missingKeywords, setMissingKeywords] = useState([]);
  const [matchedKeywords, setMatchedKeywords] = useState([]);
  
  // Approval state
  const [approvedIds, setApprovedIds] = useState(new Set());
  const [rejectedIds, setRejectedIds] = useState(new Set());
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Dropzone
  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      if (!uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        toast.error("Please upload a PDF file for template preservation");
        return;
      }
      setFile(uploadedFile);
      toast.success(`${uploadedFile.name} selected`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  // Analyze resume
  const handleAnalyze = async () => {
    if (!file || !jobDescription.trim()) {
      toast.error("Please upload a resume and enter job description");
      return;
    }

    setIsLoading(true);
    toast.loading("Analyzing your resume with AI...", { id: "analyzing" });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('job_description', jobDescription);

    try {
      const response = await axios.post(`${API}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSessionId(response.data.session_id);
      setAtsScoreBefore(response.data.ats_score_before);
      setAtsScorePotential(response.data.ats_score_potential);
      setIssues(response.data.issues);
      setSuggestions(response.data.suggestions);
      setMissingKeywords(response.data.missing_keywords);
      setMatchedKeywords(response.data.matched_keywords || []);
      
      // Auto-expand first suggestion
      if (response.data.suggestions?.length > 0) {
        setExpandedIds(new Set([response.data.suggestions[0].id]));
      }

      toast.dismiss("analyzing");
      toast.success(`Analysis complete! ATS Score: ${response.data.ats_score_before}/100`);
      setStep(2);
    } catch (error) {
      console.error("Analysis error:", error);
      toast.dismiss("analyzing");
      toast.error(error.response?.data?.detail || "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Apply changes
  const handleApplyChanges = async () => {
    if (approvedIds.size === 0) {
      toast.error("Please approve at least one suggestion");
      return;
    }

    setIsLoading(true);
    toast.loading("Applying changes to your resume...", { id: "applying" });

    try {
      const response = await axios.post(`${API}/apply`, {
        session_id: sessionId,
        approved_ids: Array.from(approvedIds)
      });

      setAtsScoreAfter(response.data.ats_score_after);
      toast.dismiss("applying");
      toast.success(`Done! New ATS Score: ${response.data.ats_score_after}/100`);
      setStep(3);
    } catch (error) {
      console.error("Apply error:", error);
      toast.dismiss("applying");
      toast.error(error.response?.data?.detail || "Failed to apply changes");
    } finally {
      setIsLoading(false);
    }
  };

  // Download PDF
  const handleDownload = async () => {
    try {
      const response = await axios.get(`${API}/download/${sessionId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `optimized_resume.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Resume downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download resume");
    }
  };

  // Handlers
  const handleApprove = (id) => {
    setApprovedIds(prev => new Set([...prev, id]));
    setRejectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    toast.success("Change approved");
  };

  const handleReject = (id) => {
    setRejectedIds(prev => new Set([...prev, id]));
    setApprovedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleApproveAll = () => {
    const allIds = suggestions.map(s => s.id);
    setApprovedIds(new Set(allIds));
    setRejectedIds(new Set());
    toast.success("All changes approved");
  };

  const handleToggle = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartOver = () => {
    setStep(1);
    setFile(null);
    setJobDescription("");
    setSessionId(null);
    setAtsScoreBefore(0);
    setAtsScorePotential(0);
    setAtsScoreAfter(null);
    setIssues([]);
    setSuggestions([]);
    setMissingKeywords([]);
    setMatchedKeywords([]);
    setApprovedIds(new Set());
    setRejectedIds(new Set());
    setExpandedIds(new Set());
  };

  return (
    <div className="min-h-screen bg-[#030304] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6366F1] rounded-full filter blur-[150px] opacity-20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#EC4899] rounded-full filter blur-[150px] opacity-15" />

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A0A0F] border border-[#1E293B] mb-4">
            <Sparkles className="w-4 h-4 text-[#6366F1]" />
            <span className="text-sm text-[#94A3B8]">AI-Powered ATS Optimization</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl font-bold text-white mb-2">
            Resume<span className="text-[#6366F1]">AI</span>
          </h1>
          <p className="text-[#94A3B8] max-w-xl mx-auto">
            Optimize your resume for ATS while preserving your original template
          </p>
        </motion.header>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { num: 1, label: "Upload" },
            { num: 2, label: "Review" },
            { num: 3, label: "Download" }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                step >= s.num ? 'bg-[#6366F1]' : 'bg-[#1E293B]'
              }`}>
                {step > s.num ? <CheckCircle2 className="w-5 h-5 text-white" /> : <span className="text-white text-sm">{s.num}</span>}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${step >= s.num ? 'text-[#6366F1]' : 'text-[#475569]'}`}>
                {s.label}
              </span>
              {idx < 2 && <ChevronRight className="w-4 h-4 text-[#475569] ml-2" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-8" style={{ background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Upload Zone */}
                <div>
                  <h2 className="font-['Space_Grotesk'] text-xl font-semibold text-white mb-4">Upload Resume (PDF)</h2>
                  <div
                    {...getRootProps()}
                    data-testid="resume-dropzone"
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragActive ? 'border-[#6366F1] bg-[#6366F1]/5' : file ? 'border-[#10B981]' : 'border-[#1E293B]'
                    }`}
                  >
                    <input {...getInputProps()} data-testid="resume-file-input" />
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                          <FileText className="w-7 h-7 text-[#10B981]" />
                        </div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-[#475569] text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-[#6366F1]/10 flex items-center justify-center">
                          <Upload className="w-7 h-7 text-[#6366F1]" />
                        </div>
                        <p className="text-white font-medium">Drop your resume here</p>
                        <p className="text-[#475569] text-sm">PDF only (preserves template)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <h2 className="font-['Space_Grotesk'] text-xl font-semibold text-white mb-4">Job Description</h2>
                  <Textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the complete job description here..."
                    data-testid="job-description-input"
                    className="min-h-[200px] bg-[#0A0A0F] border-[#1E293B] text-white placeholder:text-[#475569] focus:border-[#6366F1] resize-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={!file || !jobDescription.trim() || isLoading}
                data-testid="analyze-btn"
                className="w-full mt-6 bg-[#6366F1] hover:bg-[#5558E3] text-white py-6 rounded-full font-medium transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
              >
                {isLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <>Analyze Resume <Sparkles className="ml-2 w-4 h-4" /></>}
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Analysis & Approval */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Panel */}
              <div className="space-y-6">
                {/* Score Card */}
                <div className="glass rounded-2xl p-6 text-center" style={{ background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white mb-4">Current ATS Score</h3>
                  <div className="flex justify-center mb-4">
                    <ATSScoreRing score={atsScoreBefore} />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-[#94A3B8]">Potential:</span>
                    <span className="text-[#10B981] font-bold">{atsScorePotential}/100</span>
                  </div>
                  {atsScoreBefore < 70 && (
                    <p className="text-[#F59E0B] text-sm mt-2">⚠️ Score below 70 - needs optimization</p>
                  )}
                </div>

                {/* Issues */}
                {issues.length > 0 && (
                  <div className="glass rounded-2xl p-6" style={{ background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
                      <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white">Issues Found</h3>
                    </div>
                    <ul className="space-y-2">
                      {issues.map((issue, idx) => (
                        <li key={idx} className="text-sm text-[#94A3B8] flex items-start gap-2">
                          <span className="text-[#F59E0B]">•</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Missing Keywords */}
                {missingKeywords.length > 0 && (
                  <div className="glass rounded-2xl p-6" style={{ background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-[#F43F5E]" />
                      <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white">Missing Keywords</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {missingKeywords.slice(0, 12).map((kw, idx) => (
                        <span key={idx} className="text-xs px-3 py-1 rounded-full bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - Suggestions */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-white">Suggested Improvements</h2>
                    <p className="text-[#94A3B8] text-sm">Review and approve changes to optimize your resume</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleApproveAll}
                      data-testid="approve-all-btn"
                      className="border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve All
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[calc(100vh-400px)]">
                  <div className="space-y-4 pr-4">
                    {suggestions.map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        isApproved={approvedIds.has(suggestion.id)}
                        isRejected={rejectedIds.has(suggestion.id)}
                        isExpanded={expandedIds.has(suggestion.id)}
                        onToggle={() => handleToggle(suggestion.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>

                {/* Apply Button */}
                <div className="mt-6 flex gap-4">
                  <Button
                    variant="outline"
                    onClick={handleStartOver}
                    className="border-[#1E293B] text-white hover:bg-[#1E293B]"
                  >
                    Start Over
                  </Button>
                  <Button
                    onClick={handleApplyChanges}
                    disabled={approvedIds.size === 0 || isLoading}
                    data-testid="apply-changes-btn"
                    className="flex-1 bg-[#6366F1] hover:bg-[#5558E3] text-white py-4 rounded-full font-medium transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                  >
                    {isLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Applying...</> : <>Apply {approvedIds.size} Changes & Generate PDF <ArrowRight className="ml-2 w-4 h-4" /></>}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Results */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <div className="glass rounded-2xl p-8 text-center" style={{ background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 mb-6">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm text-[#10B981]">Optimization Complete</span>
              </div>

              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-white mb-6">
                Your Resume is Ready!
              </h2>

              {/* Score Comparison */}
              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="text-center">
                  <p className="text-[#475569] text-sm mb-2">Before</p>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 border-[#F43F5E]/40">
                    <span className="font-['JetBrains_Mono'] text-2xl font-bold text-[#F43F5E]">{atsScoreBefore}</span>
                  </div>
                </div>
                <ArrowRight className="w-8 h-8 text-[#6366F1]" />
                <div className="text-center">
                  <p className="text-[#475569] text-sm mb-2">After</p>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 border-[#10B981]" style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)' }}>
                    <span className="font-['JetBrains_Mono'] text-2xl font-bold text-[#10B981]">{atsScoreAfter}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1E293B]">
                  <TrendingUp className="w-6 h-6 text-[#10B981] mx-auto mb-2" />
                  <p className="font-['JetBrains_Mono'] text-2xl font-bold text-white">+{(atsScoreAfter || 0) - atsScoreBefore}</p>
                  <p className="text-[#475569] text-xs">Points Gained</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1E293B]">
                  <CheckCircle2 className="w-6 h-6 text-[#6366F1] mx-auto mb-2" />
                  <p className="font-['JetBrains_Mono'] text-2xl font-bold text-white">{approvedIds.size}</p>
                  <p className="text-[#475569] text-xs">Changes Applied</p>
                </div>
              </div>

              <Button
                onClick={handleDownload}
                data-testid="download-pdf-btn"
                className="w-full bg-[#6366F1] hover:bg-[#5558E3] text-white py-6 rounded-full font-medium text-lg transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Optimized Resume
              </Button>

              <Button
                variant="outline"
                onClick={handleStartOver}
                className="w-full mt-4 border-[#1E293B] text-white hover:bg-[#1E293B] py-4 rounded-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Optimize Another Resume
              </Button>

              <p className="text-[#475569] text-sm mt-6">
                ✨ Your original template, fonts, and layout have been preserved
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default App;
