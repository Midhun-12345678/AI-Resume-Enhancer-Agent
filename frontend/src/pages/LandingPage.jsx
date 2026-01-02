import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
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
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LandingPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [resumePreview, setResumePreview] = useState("");
  const [sectionsFound, setSectionsFound] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop().toLowerCase();
      if (!['pdf', 'docx'].includes(ext)) {
        toast.error("Please upload a PDF or DOCX file");
        return;
      }
      setFile(uploadedFile);
      toast.success(`${uploadedFile.name} selected`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a resume file first");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setSessionId(response.data.session_id);
      setResumePreview(response.data.resume_preview);
      setSectionsFound(response.data.sections_found);
      toast.success("Resume parsed successfully!");
      setStep(2);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Failed to upload resume");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please enter the job description");
      return;
    }

    if (!sessionId) {
      toast.error("Please upload a resume first");
      return;
    }

    setIsUploading(true);
    toast.loading("Analyzing your resume...", { id: "analyzing" });

    try {
      await axios.post(`${API}/analyze`, {
        session_id: sessionId,
        job_description: jobDescription
      });

      toast.dismiss("analyzing");
      toast.success("Analysis complete!");
      navigate(`/analyze/${sessionId}`);
    } catch (error) {
      console.error("Analysis error:", error);
      toast.dismiss("analyzing");
      toast.error(error.response?.data?.detail || "Analysis failed");
    } finally {
      setIsUploading(false);
    }
  };

  const features = [
    { icon: <Zap className="w-5 h-5" />, title: "AI-Powered Analysis", desc: "GPT-5.2 powered optimization" },
    { icon: <Target className="w-5 h-5" />, title: "Keyword Matching", desc: "Match JD requirements precisely" },
    { icon: <Shield className="w-5 h-5" />, title: "Truthful Edits", desc: "Never fabricates experience" }
  ];

  return (
    <div className="min-h-screen bg-[#030304] relative overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 grid-overlay opacity-20 pointer-events-none" />
      
      {/* Gradient Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6366F1] rounded-full filter blur-[150px] opacity-20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#EC4899] rounded-full filter blur-[150px] opacity-15" />

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A0A0F] border border-[#1E293B] mb-6">
            <Sparkles className="w-4 h-4 text-[#6366F1]" />
            <span className="text-sm text-[#94A3B8]">AI-Powered ATS Optimization</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
            Resume<span className="text-[#6366F1]">AI</span>
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            Transform your resume into an ATS-optimized powerhouse. Get specific, explainable improvements with full control over every change.
          </p>
        </motion.header>

        {/* Features */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto"
        >
          {features.map((feature, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-3 p-4 rounded-xl bg-[#0A0A0F]/50 border border-[#1E293B]/50"
            >
              <div className="p-2 rounded-lg bg-[#6366F1]/10 text-[#6366F1]">
                {feature.icon}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{feature.title}</p>
                <p className="text-[#475569] text-xs">{feature.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Main Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#6366F1]' : 'text-[#475569]'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-[#6366F1]' : 'bg-[#1E293B]'}`}>
                {step > 1 ? <CheckCircle2 className="w-5 h-5 text-white" /> : <span className="text-white text-sm">1</span>}
              </div>
              <span className="text-sm font-medium hidden sm:block">Upload Resume</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#475569]" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#6366F1]' : 'text-[#475569]'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-[#6366F1]' : 'bg-[#1E293B]'}`}>
                <span className="text-white text-sm">2</span>
              </div>
              <span className="text-sm font-medium hidden sm:block">Add Job Description</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#475569]" />
            <div className="flex items-center gap-2 text-[#475569]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1E293B]">
                <span className="text-white text-sm">3</span>
              </div>
              <span className="text-sm font-medium hidden sm:block">Get Optimized</span>
            </div>
          </div>

          {/* Step Content */}
          <div className="glass rounded-2xl p-8">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-white mb-6 text-center">
                  Upload Your Resume
                </h2>
                
                <div
                  {...getRootProps()}
                  data-testid="resume-dropzone"
                  className={`upload-zone rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragActive ? 'active border-[#6366F1] bg-[#6366F1]/5' : ''
                  } ${file ? 'border-[#10B981]' : ''}`}
                >
                  <input {...getInputProps()} data-testid="resume-file-input" />
                  
                  {file ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-[#10B981]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-[#475569] text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="text-[#94A3B8] hover:text-white"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        data-testid="remove-file-btn"
                      >
                        Remove & Upload Different
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#6366F1]/10 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-[#6366F1]" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">
                          {isDragActive ? "Drop your resume here" : "Drag & drop your resume"}
                        </p>
                        <p className="text-[#475569] text-sm">PDF or DOCX (max 10MB)</p>
                      </div>
                      <Button variant="outline" className="mt-2 border-[#1E293B] text-white hover:bg-[#1E293B]">
                        Browse Files
                      </Button>
                    </div>
                  )}
                </div>

                {isUploading && (
                  <div className="mt-6">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-center text-[#94A3B8] text-sm mt-2">Uploading... {uploadProgress}%</p>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  data-testid="upload-resume-btn"
                  className="w-full mt-6 bg-[#6366F1] hover:bg-[#5558E3] text-white py-6 rounded-full font-medium transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                >
                  {isUploading ? "Processing..." : "Parse Resume"}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-white mb-2 text-center">
                  Add Job Description
                </h2>
                <p className="text-[#94A3B8] text-center mb-6">
                  Paste the job posting you're applying for
                </p>

                {/* Resume Preview */}
                <div className="mb-6 p-4 rounded-xl bg-[#0A0A0F] border border-[#1E293B]">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-5 h-5 text-[#10B981]" />
                    <span className="text-white font-medium">{file?.name}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#10B981]/10 text-[#10B981]">Parsed</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sectionsFound.map((section, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 rounded-full bg-[#6366F1]/10 text-[#6366F1] capitalize">
                        {section}
                      </span>
                    ))}
                  </div>
                </div>

                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the complete job description here..."
                  data-testid="job-description-input"
                  className="min-h-[200px] bg-[#0A0A0F] border-[#1E293B] text-white placeholder:text-[#475569] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] resize-none"
                />

                <div className="flex gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 border-[#1E293B] text-white hover:bg-[#1E293B] py-6 rounded-full"
                    data-testid="back-btn"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={!jobDescription.trim() || isUploading}
                    data-testid="analyze-btn"
                    className="flex-[2] bg-[#6366F1] hover:bg-[#5558E3] text-white py-6 rounded-full font-medium transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                  >
                    {isUploading ? "Analyzing..." : "Analyze & Optimize"}
                    <Sparkles className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingPage;
