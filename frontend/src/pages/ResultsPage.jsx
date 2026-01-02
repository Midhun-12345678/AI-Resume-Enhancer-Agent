import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  Sparkles,
  Download,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FileText,
  RefreshCw,
  Home,
  Share2,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ScoreComparison = ({ before, after }) => {
  const improvement = after - before;
  
  const getColor = (score) => {
    if (score >= 85) return "#10B981";
    if (score >= 70) return "#F59E0B";
    return "#F43F5E";
  };

  return (
    <div className="flex items-center justify-center gap-8">
      {/* Before */}
      <div className="text-center">
        <p className="text-[#475569] text-sm mb-2">Before</p>
        <div 
          className="w-24 h-24 rounded-full flex items-center justify-center border-4"
          style={{ borderColor: getColor(before) + "40" }}
        >
          <span 
            className="font-['JetBrains_Mono'] text-3xl font-bold"
            style={{ color: getColor(before) }}
          >
            {before}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex flex-col items-center">
        <ArrowRight className="w-8 h-8 text-[#6366F1]" />
        <span className={`text-sm font-medium mt-1 ${improvement > 0 ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>
          {improvement > 0 ? `+${improvement}` : improvement}
        </span>
      </div>

      {/* After */}
      <div className="text-center">
        <p className="text-[#475569] text-sm mb-2">After</p>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="w-24 h-24 rounded-full flex items-center justify-center border-4"
          style={{ 
            borderColor: getColor(after),
            boxShadow: `0 0 30px ${getColor(after)}40`
          }}
        >
          <span 
            className="font-['JetBrains_Mono'] text-3xl font-bold"
            style={{ color: getColor(after) }}
          >
            {after}
          </span>
        </motion.div>
      </div>
    </div>
  );
};

const ResultsPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [scoreBefore, setScoreBefore] = useState(0);
  const [scoreAfter, setScoreAfter] = useState(0);
  const [changesApplied, setChangesApplied] = useState(0);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/session/${sessionId}`);
      setSession(response.data);
      setScoreBefore(response.data.ats_analysis?.score_before || 0);
      setScoreAfter(response.data.ats_analysis?.score_after || 0);
      setChangesApplied(response.data.approved_changes?.length || 0);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load results");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await axios.get(`${API}/download/${sessionId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `optimized_resume_${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Resume downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download resume");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030304] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#6366F1] animate-spin mx-auto mb-4" />
          <p className="text-[#94A3B8]">Loading results...</p>
        </div>
      </div>
    );
  }

  const improvement = scoreAfter - scoreBefore;

  return (
    <div className="min-h-screen bg-[#030304] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-overlay opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B981] rounded-full filter blur-[150px] opacity-15" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#6366F1] rounded-full filter blur-[150px] opacity-15" />

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 mb-6">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span className="text-sm text-[#10B981]">Optimization Complete</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl font-bold text-white mb-4">
            Your Resume is <span className="text-[#10B981]">Optimized</span>
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            Great job! Your resume has been enhanced for better ATS compatibility.
          </p>
        </motion.header>

        {/* Main Results Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <div className="glass rounded-2xl p-8 mb-8">
            {/* Score Comparison */}
            <div className="mb-8">
              <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-white text-center mb-6">
                ATS Score Improvement
              </h3>
              <ScoreComparison before={scoreBefore} after={scoreAfter} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 rounded-xl bg-[#0A0A0F] border border-[#1E293B]">
                <TrendingUp className="w-6 h-6 text-[#10B981] mx-auto mb-2" />
                <p className="font-['JetBrains_Mono'] text-2xl font-bold text-white">
                  {improvement > 0 ? `+${improvement}` : improvement}
                </p>
                <p className="text-[#475569] text-xs">Points Gained</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#0A0A0F] border border-[#1E293B]">
                <CheckCircle2 className="w-6 h-6 text-[#6366F1] mx-auto mb-2" />
                <p className="font-['JetBrains_Mono'] text-2xl font-bold text-white">
                  {changesApplied}
                </p>
                <p className="text-[#475569] text-xs">Changes Applied</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#0A0A0F] border border-[#1E293B]">
                <FileText className="w-6 h-6 text-[#EC4899] mx-auto mb-2" />
                <p className="font-['JetBrains_Mono'] text-2xl font-bold text-white">
                  PDF
                </p>
                <p className="text-[#475569] text-xs">Ready to Download</p>
              </div>
            </div>

            {/* Download Button */}
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              data-testid="download-pdf-btn"
              className="w-full bg-[#6366F1] hover:bg-[#5558E3] text-white py-6 rounded-full font-medium text-lg transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Download Optimized Resume
                </>
              )}
            </Button>

            {/* Secondary Actions */}
            <div className="flex gap-4 mt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                data-testid="start-over-btn"
                className="flex-1 border-[#1E293B] text-white hover:bg-[#1E293B] py-4 rounded-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Start New
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                data-testid="copy-link-btn"
                className="flex-1 border-[#1E293B] text-white hover:bg-[#1E293B] py-4 rounded-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </div>

          {/* Applied Changes Summary */}
          {session?.suggestions?.filter(s => s.status === 'approved').length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6"
            >
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-white mb-4">
                Changes Applied
              </h3>
              <div className="space-y-3">
                {session.suggestions
                  .filter(s => s.status === 'approved')
                  .map((sugg, idx) => (
                    <div 
                      key={sugg.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[#10B981]/5 border border-[#10B981]/20"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
                      <div>
                        <Badge className="mb-1 capitalize bg-[#6366F1]/10 text-[#6366F1] text-xs">
                          {sugg.section}
                        </Badge>
                        <p className="text-sm text-[#94A3B8]">{sugg.reason}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Tips Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20">
              <Sparkles className="w-4 h-4 text-[#6366F1]" />
              <span className="text-sm text-[#94A3B8]">
                Pro Tip: Tailor your resume for each job application for best results
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ResultsPage;
