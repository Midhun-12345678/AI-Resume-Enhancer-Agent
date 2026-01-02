import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  Sparkles,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileText,
  Target,
  Lightbulb,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ATSScoreRing = ({ score, size = 120 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score) => {
    if (score >= 85) return "#10B981";
    if (score >= 70) return "#F59E0B";
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
          className="score-ring transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 10px ${getColor(score)}50)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-['JetBrains_Mono'] text-3xl font-bold text-white">{score}</span>
        <span className="text-[#94A3B8] text-xs">ATS Score</span>
      </div>
    </div>
  );
};

const SuggestionCard = ({ suggestion, onApprove, onReject, isExpanded, onToggle }) => {
  const sectionColors = {
    summary: "#6366F1",
    skills: "#06B6D4",
    experience: "#EC4899",
    education: "#F59E0B",
    projects: "#10B981",
    other: "#94A3B8"
  };

  const color = sectionColors[suggestion.section] || sectionColors.other;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`suggestion-card rounded-xl border transition-all ${
        suggestion.status === 'approved' 
          ? 'bg-[#10B981]/5 border-[#10B981]/30' 
          : suggestion.status === 'rejected'
          ? 'bg-[#F43F5E]/5 border-[#F43F5E]/30 opacity-60'
          : 'bg-[#0A0A0F] border-[#1E293B] hover:border-[#6366F1]/30'
      }`}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full" data-testid={`suggestion-toggle-${suggestion.id}`}>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <Badge 
                variant="outline" 
                className="capitalize text-xs"
                style={{ borderColor: color, color: color }}
              >
                {suggestion.section}
              </Badge>
              {suggestion.status === 'approved' && (
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              )}
              {suggestion.status === 'rejected' && (
                <XCircle className="w-4 h-4 text-[#F43F5E]" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {suggestion.keywords_added?.length > 0 && (
                <span className="text-xs text-[#6366F1]">
                  +{suggestion.keywords_added.length} keywords
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
              )}
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
              {suggestion.original_text && (
                <div className="diff-removed p-3 rounded-lg">
                  <p className="text-xs text-[#F43F5E] mb-1 font-medium">Original</p>
                  <p className="text-sm text-[#94A3B8]">{suggestion.original_text}</p>
                </div>
              )}
              <div className="diff-added p-3 rounded-lg">
                <p className="text-xs text-[#10B981] mb-1 font-medium">Suggested</p>
                <p className="text-sm text-white">{suggestion.suggested_text}</p>
              </div>
            </div>

            {/* Keywords Added */}
            {suggestion.keywords_added?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-[#475569] mb-2">Keywords Added:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.keywords_added.map((kw, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-2 py-1 rounded-full bg-[#6366F1]/10 text-[#6366F1]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {suggestion.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => onApprove(suggestion.id)}
                  data-testid={`approve-${suggestion.id}`}
                  className="flex-1 bg-[#10B981] hover:bg-[#0D9668] text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => onReject(suggestion.id)}
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

const AnalysisDashboard = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [atsScore, setAtsScore] = useState(0);
  const [missingKeywords, setMissingKeywords] = useState([]);
  const [jdAnalysis, setJdAnalysis] = useState({});

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/session/${sessionId}`);
      setSession(response.data);
      setSuggestions(response.data.suggestions || []);
      setAtsScore(response.data.ats_analysis?.score_before || 0);
      setMissingKeywords(response.data.ats_analysis?.missing_keywords || []);
      setJdAnalysis(response.data.jd_analysis || {});
      
      // Auto-expand first suggestion
      if (response.data.suggestions?.length > 0) {
        setExpandedIds(new Set([response.data.suggestions[0].id]));
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = (id) => {
    setSuggestions(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'approved' } : s
    ));
    toast.success("Change approved");
  };

  const handleReject = (id) => {
    setSuggestions(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'rejected' } : s
    ));
    toast.info("Change rejected - will not be applied");
  };

  const handleApproveAll = () => {
    setSuggestions(prev => prev.map(s => 
      s.status === 'pending' ? { ...s, status: 'approved' } : s
    ));
    toast.success("All pending changes approved");
  };

  const handleToggle = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyChanges = async () => {
    const approved = suggestions.filter(s => s.status === 'approved').map(s => s.id);
    const rejected = suggestions.filter(s => s.status === 'rejected').map(s => s.id);

    if (approved.length === 0) {
      toast.error("Please approve at least one suggestion");
      return;
    }

    setIsApplying(true);
    toast.loading("Applying changes and generating PDF...", { id: "applying" });

    try {
      await axios.post(`${API}/approve`, {
        session_id: sessionId,
        approved_ids: approved,
        rejected_ids: rejected
      });

      toast.dismiss("applying");
      toast.success("Resume optimized successfully!");
      navigate(`/results/${sessionId}`);
    } catch (error) {
      console.error("Apply error:", error);
      toast.dismiss("applying");
      toast.error(error.response?.data?.detail || "Failed to apply changes");
    } finally {
      setIsApplying(false);
    }
  };

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;
  const approvedCount = suggestions.filter(s => s.status === 'approved').length;
  const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030304] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#6366F1] animate-spin mx-auto mb-4" />
          <p className="text-[#94A3B8]">Loading analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030304]">
      {/* Grid Overlay */}
      <div className="absolute inset-0 grid-overlay opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[#1E293B]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[#6366F1]" />
              <h1 className="font-['Space_Grotesk'] text-xl font-semibold text-white">
                Resume<span className="text-[#6366F1]">AI</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-[#10B981]">{approvedCount} approved</span>
                <span className="text-[#475569]">•</span>
                <span className="text-[#F43F5E]">{rejectedCount} rejected</span>
                <span className="text-[#475569]">•</span>
                <span className="text-[#94A3B8]">{pendingCount} pending</span>
              </div>
              <Button
                onClick={handleApplyChanges}
                disabled={approvedCount === 0 || isApplying}
                data-testid="apply-changes-btn"
                className="bg-[#6366F1] hover:bg-[#5558E3] text-white rounded-full px-6"
              >
                {isApplying ? "Applying..." : "Apply & Generate PDF"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Score & Keywords */}
          <div className="lg:col-span-1 space-y-6">
            {/* ATS Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white mb-4">
                Current ATS Score
              </h3>
              <div className="flex justify-center mb-4">
                <ATSScoreRing score={atsScore} />
              </div>
              <p className="text-[#94A3B8] text-sm">
                {atsScore < 70 && "Needs significant improvement"}
                {atsScore >= 70 && atsScore < 85 && "Good, but can be better"}
                {atsScore >= 85 && "Excellent ATS compatibility"}
              </p>
            </motion.div>

            {/* Missing Keywords */}
            {missingKeywords.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
                  <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white">
                    Missing Keywords
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {missingKeywords.slice(0, 10).map((kw, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-3 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20"
                    >
                      {kw}
                    </span>
                  ))}
                  {missingKeywords.length > 10 && (
                    <span className="text-xs text-[#475569]">
                      +{missingKeywords.length - 10} more
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {/* JD Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#06B6D4]" />
                <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white">
                  Job Requirements
                </h3>
              </div>
              {jdAnalysis.role_level && (
                <div className="mb-3">
                  <p className="text-xs text-[#475569] mb-1">Role Level</p>
                  <Badge className="capitalize bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20">
                    {jdAnalysis.role_level}
                  </Badge>
                </div>
              )}
              {jdAnalysis.required_skills?.length > 0 && (
                <div>
                  <p className="text-xs text-[#475569] mb-2">Required Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {jdAnalysis.required_skills.slice(0, 8).map((skill, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 rounded-full bg-[#06B6D4]/10 text-[#06B6D4]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Panel - Suggestions */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-white">
                  Improvement Suggestions
                </h2>
                <p className="text-[#94A3B8] text-sm mt-1">
                  Review and approve changes to optimize your resume
                </p>
              </div>
              {pendingCount > 0 && (
                <Button
                  variant="outline"
                  onClick={handleApproveAll}
                  data-testid="approve-all-btn"
                  className="border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve All ({pendingCount})
                </Button>
              )}
            </div>

            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-4">
                <AnimatePresence>
                  {suggestions.map((suggestion, idx) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      isExpanded={expandedIds.has(suggestion.id)}
                      onToggle={() => handleToggle(suggestion.id)}
                    />
                  ))}
                </AnimatePresence>

                {suggestions.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-[#475569] mx-auto mb-4" />
                    <p className="text-[#94A3B8]">No suggestions generated</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
