# ResumeAI - ATS Resume Optimization Agent PRD

## Original Problem Statement
Build an AI Resume Optimization Agent that:
- Accepts Resume (PDF/DOCX) and Job Description
- Analyzes both for ATS compatibility
- Suggests specific, explainable improvements
- Asks for user approval before changes
- Applies approved changes automatically
- Generates an updated resume PDF
- Preserves original formatting and layout
- Allows the user to download the final PDF

## User Persona
- **Primary**: Job seekers optimizing resumes for ATS systems
- **Secondary**: Career professionals, recruiters reviewing resumes

## Core Requirements (Static)
1. Resume upload (PDF/DOCX)
2. Job description input
3. Resume parsing with section extraction
4. ATS score calculation (before/after)
5. AI-powered improvement suggestions
6. Approval/rejection workflow per suggestion
7. PDF generation with optimized content
8. Download functionality

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Framer Motion
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **LLM**: OpenAI GPT-5.2 via emergentintegrations
- **PDF Processing**: pdfplumber (read), reportlab (write)
- **DOCX Processing**: python-docx

## What's Been Implemented (December 2025)

### Backend APIs
- POST /api/upload-resume - Upload & parse resume
- POST /api/analyze - Analyze resume vs JD, generate suggestions
- POST /api/approve - Apply approved changes, generate PDF
- GET /api/download/{session_id} - Download optimized PDF
- GET /api/session/{session_id} - Get session state

### Frontend Pages
- Landing Page - Resume upload + JD input with step indicator
- Analysis Dashboard - ATS score ring, suggestions with diff view
- Results Page - Before/after comparison, download button

### Features Completed
- PDF & DOCX file parsing
- Resume section extraction (summary, skills, experience, education, projects)
- JD keyword extraction via GPT-5.2
- ATS score calculation algorithm
- AI-generated improvement suggestions
- Diff view (original vs suggested)
- Approve/reject per suggestion
- Batch approve all
- Session state persistence in MongoDB
- PDF generation with clean formatting
- Dark theme "Obsidian" UI design

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Resume upload and parsing
- [x] JD analysis
- [x] ATS scoring
- [x] Suggestion generation
- [x] Approval workflow
- [x] PDF generation
- [x] Download functionality

### P1 (Important) - Next Phase
- [ ] DOCX output format option
- [ ] Multiple resume versions
- [ ] Resume history/versioning
- [ ] User authentication

### P2 (Nice to Have)
- [ ] Email delivery of optimized resume
- [ ] Resume templates
- [ ] Real-time collaboration
- [ ] Analytics dashboard

## Next Action Items
1. Add user authentication for persistent history
2. Support DOCX output format
3. Add resume version history
4. Implement email delivery option
5. Add more ATS scoring factors
