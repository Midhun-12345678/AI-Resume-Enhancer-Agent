import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LandingPage from "./pages/LandingPage";
import AnalysisDashboard from "./pages/AnalysisDashboard";
import ResultsPage from "./pages/ResultsPage";

function App() {
  return (
    <div className="App min-h-screen bg-[#030304]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/analyze/:sessionId" element={<AnalysisDashboard />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
