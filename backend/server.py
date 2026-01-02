from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import tempfile
import aiofiles
from io import BytesIO

# PDF/DOCX processing
import pdfplumber
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

# LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM API Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Directory for generated PDFs
PDF_OUTPUT_DIR = ROOT_DIR / "generated_pdfs"
PDF_OUTPUT_DIR.mkdir(exist_ok=True)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ResumeSection(BaseModel):
    name: str
    content: str
    bullets: List[str] = []

class ParsedResume(BaseModel):
    full_text: str
    sections: Dict[str, Any]
    skills: List[str] = []
    experience: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []
    summary: str = ""

class JobDescription(BaseModel):
    text: str
    keywords: List[str] = []
    required_skills: List[str] = []
    role_level: str = ""
    tools_technologies: List[str] = []

class Suggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section: str
    original_text: str
    suggested_text: str
    reason: str
    keywords_added: List[str] = []
    status: str = "pending"  # pending, approved, rejected

class ATSAnalysis(BaseModel):
    score_before: int
    score_after: Optional[int] = None
    missing_keywords: List[str] = []
    weak_bullets: List[str] = []
    suggestions: List[Suggestion] = []

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resume_text: str = ""
    resume_sections: Dict[str, Any] = {}
    job_description: str = ""
    jd_analysis: Dict[str, Any] = {}
    ats_analysis: Optional[Dict[str, Any]] = None
    suggestions: List[Dict[str, Any]] = []
    approved_changes: List[str] = []
    rejected_changes: List[str] = []
    optimized_resume: str = ""
    pdf_path: str = ""
    status: str = "created"  # created, analyzed, approved, completed

class UploadResponse(BaseModel):
    session_id: str
    message: str
    resume_preview: str
    sections_found: List[str]

class AnalyzeRequest(BaseModel):
    session_id: str
    job_description: str

class ApproveRequest(BaseModel):
    session_id: str
    approved_ids: List[str]
    rejected_ids: List[str]

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using pdfplumber."""
    text = ""
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file."""
    doc = Document(BytesIO(file_bytes))
    text = []
    for paragraph in doc.paragraphs:
        text.append(paragraph.text)
    return "\n".join(text).strip()

def parse_resume_sections(text: str) -> Dict[str, Any]:
    """Parse resume text into sections."""
    sections = {
        "summary": "",
        "skills": [],
        "experience": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "other": ""
    }
    
    lines = text.split('\n')
    current_section = "other"
    current_content = []
    
    section_keywords = {
        "summary": ["summary", "objective", "profile", "about"],
        "skills": ["skills", "technical skills", "core competencies", "technologies"],
        "experience": ["experience", "work history", "employment", "professional experience"],
        "education": ["education", "academic", "qualifications"],
        "projects": ["projects", "portfolio"],
        "certifications": ["certifications", "certificates", "licenses"]
    }
    
    for line in lines:
        line_lower = line.lower().strip()
        section_found = False
        
        for section, keywords in section_keywords.items():
            if any(kw in line_lower for kw in keywords) and len(line.strip()) < 50:
                if current_content:
                    if current_section in ["skills"]:
                        sections[current_section] = [item.strip() for item in " ".join(current_content).split(",") if item.strip()]
                    elif current_section in ["experience", "education", "projects"]:
                        sections[current_section].append("\n".join(current_content))
                    else:
                        sections[current_section] = "\n".join(current_content)
                current_section = section
                current_content = []
                section_found = True
                break
        
        if not section_found and line.strip():
            current_content.append(line.strip())
    
    # Don't forget the last section
    if current_content:
        if current_section in ["skills"]:
            sections[current_section] = [item.strip() for item in " ".join(current_content).split(",") if item.strip()]
        elif current_section in ["experience", "education", "projects"]:
            sections[current_section].append("\n".join(current_content))
        else:
            sections[current_section] = "\n".join(current_content)
    
    return sections

async def analyze_with_llm(prompt: str, session_id: str) -> str:
    """Use LLM to analyze and generate suggestions."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"resume-{session_id}",
            system_message="You are an expert ATS (Applicant Tracking System) optimization specialist. You help optimize resumes for better ATS compatibility while maintaining truthfulness and professional tone. Always respond in valid JSON format."
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return response
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {str(e)}")

def calculate_ats_score(resume_text: str, jd_keywords: List[str], required_skills: List[str]) -> int:
    """Calculate ATS compatibility score."""
    resume_lower = resume_text.lower()
    total_keywords = len(jd_keywords) + len(required_skills)
    if total_keywords == 0:
        return 50
    
    found_keywords = sum(1 for kw in jd_keywords if kw.lower() in resume_lower)
    found_skills = sum(1 for skill in required_skills if skill.lower() in resume_lower)
    
    keyword_score = (found_keywords + found_skills) / total_keywords * 100
    
    # Additional scoring factors
    has_action_verbs = any(verb in resume_lower for verb in ['achieved', 'improved', 'developed', 'led', 'managed', 'created', 'implemented'])
    has_metrics = any(char.isdigit() for char in resume_text)
    
    bonus = 0
    if has_action_verbs:
        bonus += 5
    if has_metrics:
        bonus += 5
    
    return min(100, int(keyword_score + bonus))

def generate_pdf(resume_data: Dict[str, Any], output_path: str) -> str:
    """Generate a professional PDF from resume data."""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=12,
        textColor='#1a1a1a'
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=8,
        spaceBefore=16,
        textColor='#333333',
        borderPadding=4
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        leading=14,
        textColor='#444444'
    )
    
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=20,
        spaceAfter=4,
        leading=14,
        textColor='#444444'
    )
    
    story = []
    
    # Summary
    if resume_data.get('summary'):
        story.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        story.append(Paragraph(resume_data['summary'], body_style))
        story.append(Spacer(1, 12))
    
    # Skills
    if resume_data.get('skills'):
        story.append(Paragraph("SKILLS", section_style))
        skills_text = ", ".join(resume_data['skills']) if isinstance(resume_data['skills'], list) else resume_data['skills']
        story.append(Paragraph(skills_text, body_style))
        story.append(Spacer(1, 12))
    
    # Experience
    if resume_data.get('experience'):
        story.append(Paragraph("PROFESSIONAL EXPERIENCE", section_style))
        for exp in resume_data['experience']:
            if isinstance(exp, str):
                for line in exp.split('\n'):
                    if line.strip():
                        if line.strip().startswith('•') or line.strip().startswith('-'):
                            story.append(Paragraph(line.strip()[1:].strip(), bullet_style))
                        else:
                            story.append(Paragraph(line.strip(), body_style))
        story.append(Spacer(1, 12))
    
    # Education
    if resume_data.get('education'):
        story.append(Paragraph("EDUCATION", section_style))
        for edu in resume_data['education']:
            if isinstance(edu, str):
                for line in edu.split('\n'):
                    if line.strip():
                        story.append(Paragraph(line.strip(), body_style))
        story.append(Spacer(1, 12))
    
    # Projects
    if resume_data.get('projects'):
        story.append(Paragraph("PROJECTS", section_style))
        for proj in resume_data['projects']:
            if isinstance(proj, str):
                for line in proj.split('\n'):
                    if line.strip():
                        story.append(Paragraph(line.strip(), body_style))
        story.append(Spacer(1, 12))
    
    # Other content
    if resume_data.get('other'):
        story.append(Paragraph(resume_data['other'], body_style))
    
    doc.build(story)
    return output_path

# =============================================================================
# API ROUTES
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "ResumeAI - ATS Optimization Agent API"}

@api_router.post("/upload-resume", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload and parse a resume (PDF or DOCX)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['pdf', 'docx']:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    # Read file content
    content = await file.read()
    
    # Extract text based on file type
    try:
        if file_ext == 'pdf':
            resume_text = extract_text_from_pdf(content)
        else:
            resume_text = extract_text_from_docx(content)
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the file")
    
    # Parse sections
    sections = parse_resume_sections(resume_text)
    
    # Create session
    session_id = str(uuid.uuid4())
    session_doc = {
        "id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resume_text": resume_text,
        "resume_sections": sections,
        "job_description": "",
        "jd_analysis": {},
        "ats_analysis": None,
        "suggestions": [],
        "approved_changes": [],
        "rejected_changes": [],
        "optimized_resume": "",
        "pdf_path": "",
        "status": "created"
    }
    
    await db.sessions.insert_one(session_doc)
    
    sections_found = [k for k, v in sections.items() if v]
    
    return UploadResponse(
        session_id=session_id,
        message="Resume uploaded and parsed successfully",
        resume_preview=resume_text[:500] + "..." if len(resume_text) > 500 else resume_text,
        sections_found=sections_found
    )

@api_router.post("/analyze")
async def analyze_resume(request: AnalyzeRequest):
    """Analyze resume against job description and generate suggestions."""
    # Get session
    session = await db.sessions.find_one({"id": request.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    resume_text = session['resume_text']
    resume_sections = session['resume_sections']
    job_description = request.job_description
    
    # Step 1: Analyze Job Description with LLM
    jd_prompt = f"""Analyze this job description and extract key information. Return ONLY valid JSON:

Job Description:
{job_description}

Return JSON with this exact structure:
{{
    "keywords": ["list of important keywords"],
    "required_skills": ["list of required skills"],
    "role_level": "entry/mid/senior/lead",
    "tools_technologies": ["list of tools and technologies mentioned"]
}}"""
    
    jd_response = await analyze_with_llm(jd_prompt, request.session_id)
    
    try:
        # Clean up the response - remove markdown code blocks if present
        jd_clean = jd_response.strip()
        if jd_clean.startswith('```'):
            jd_clean = jd_clean.split('\n', 1)[1]  # Remove first line with ```json
        if jd_clean.endswith('```'):
            jd_clean = jd_clean.rsplit('```', 1)[0]
        jd_analysis = json.loads(jd_clean.strip())
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse JD analysis: {jd_response}")
        jd_analysis = {
            "keywords": [],
            "required_skills": [],
            "role_level": "mid",
            "tools_technologies": []
        }
    
    # Step 2: Calculate initial ATS score
    keywords = jd_analysis.get('keywords', [])
    required_skills = jd_analysis.get('required_skills', [])
    score_before = calculate_ats_score(resume_text, keywords, required_skills)
    
    # Step 3: Generate improvement suggestions with LLM
    suggestions_prompt = f"""You are an ATS optimization expert. Compare this resume with the job description and suggest specific improvements.

RESUME:
{resume_text}

JOB DESCRIPTION KEYWORDS: {', '.join(keywords)}
REQUIRED SKILLS: {', '.join(required_skills)}

Generate suggestions to improve ATS compatibility. For each suggestion:
1. Identify weak or missing content
2. Suggest specific rewrites using action verbs and quantified impact
3. Include relevant keywords naturally

Return ONLY valid JSON array with this structure:
[
    {{
        "section": "summary|skills|experience|education|projects",
        "original_text": "the original text to replace",
        "suggested_text": "the improved text",
        "reason": "why this change improves ATS score",
        "keywords_added": ["list", "of", "keywords", "added"]
    }}
]

IMPORTANT: 
- Never fabricate experience or metrics
- Keep suggestions truthful and professional
- Maximum 6 suggestions focusing on highest impact areas"""
    
    suggestions_response = await analyze_with_llm(suggestions_prompt, request.session_id + "-suggestions")
    
    try:
        # Clean up response
        sugg_clean = suggestions_response.strip()
        if sugg_clean.startswith('```'):
            sugg_clean = sugg_clean.split('\n', 1)[1]
        if sugg_clean.endswith('```'):
            sugg_clean = sugg_clean.rsplit('```', 1)[0]
        suggestions_raw = json.loads(sugg_clean.strip())
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse suggestions: {suggestions_response}")
        suggestions_raw = []
    
    # Add IDs to suggestions
    suggestions = []
    for sugg in suggestions_raw:
        suggestions.append({
            "id": str(uuid.uuid4()),
            "section": sugg.get('section', 'other'),
            "original_text": sugg.get('original_text', ''),
            "suggested_text": sugg.get('suggested_text', ''),
            "reason": sugg.get('reason', ''),
            "keywords_added": sugg.get('keywords_added', []),
            "status": "pending"
        })
    
    # Find missing keywords
    resume_lower = resume_text.lower()
    missing_keywords = [kw for kw in keywords if kw.lower() not in resume_lower]
    
    # Update session
    ats_analysis = {
        "score_before": score_before,
        "score_after": None,
        "missing_keywords": missing_keywords,
        "weak_bullets": [],
        "suggestions": suggestions
    }
    
    await db.sessions.update_one(
        {"id": request.session_id},
        {"$set": {
            "job_description": job_description,
            "jd_analysis": jd_analysis,
            "ats_analysis": ats_analysis,
            "suggestions": suggestions,
            "status": "analyzed"
        }}
    )
    
    return {
        "session_id": request.session_id,
        "score_before": score_before,
        "missing_keywords": missing_keywords,
        "jd_analysis": jd_analysis,
        "suggestions": suggestions,
        "message": "Analysis complete. Please review and approve suggestions."
    }

@api_router.post("/approve")
async def approve_changes(request: ApproveRequest):
    """Apply approved changes and generate optimized resume."""
    session = await db.sessions.find_one({"id": request.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    suggestions = session.get('suggestions', [])
    resume_sections = session.get('resume_sections', {})
    resume_text = session.get('resume_text', '')
    jd_analysis = session.get('jd_analysis', {})
    
    # Update suggestion statuses
    for sugg in suggestions:
        if sugg['id'] in request.approved_ids:
            sugg['status'] = 'approved'
        elif sugg['id'] in request.rejected_ids:
            sugg['status'] = 'rejected'
    
    # Apply approved changes to resume text
    optimized_text = resume_text
    optimized_sections = dict(resume_sections)
    
    for sugg in suggestions:
        if sugg['status'] == 'approved':
            # Apply to full text
            if sugg['original_text'] and sugg['original_text'] in optimized_text:
                optimized_text = optimized_text.replace(sugg['original_text'], sugg['suggested_text'])
            
            # Apply to sections
            section = sugg['section']
            if section in optimized_sections:
                if isinstance(optimized_sections[section], str):
                    if sugg['original_text'] in optimized_sections[section]:
                        optimized_sections[section] = optimized_sections[section].replace(
                            sugg['original_text'], sugg['suggested_text']
                        )
                elif isinstance(optimized_sections[section], list):
                    for i, item in enumerate(optimized_sections[section]):
                        if isinstance(item, str) and sugg['original_text'] in item:
                            optimized_sections[section][i] = item.replace(
                                sugg['original_text'], sugg['suggested_text']
                            )
    
    # Calculate new ATS score
    keywords = jd_analysis.get('keywords', [])
    required_skills = jd_analysis.get('required_skills', [])
    score_after = calculate_ats_score(optimized_text, keywords, required_skills)
    
    # Generate PDF
    pdf_filename = f"optimized_resume_{request.session_id}.pdf"
    pdf_path = str(PDF_OUTPUT_DIR / pdf_filename)
    
    try:
        generate_pdf(optimized_sections, pdf_path)
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
    
    # Update session
    await db.sessions.update_one(
        {"id": request.session_id},
        {"$set": {
            "suggestions": suggestions,
            "approved_changes": request.approved_ids,
            "rejected_changes": request.rejected_ids,
            "optimized_resume": optimized_text,
            "optimized_sections": optimized_sections,
            "ats_analysis.score_after": score_after,
            "pdf_path": pdf_path,
            "status": "completed"
        }}
    )
    
    # Get score before
    score_before = session.get('ats_analysis', {}).get('score_before', 0)
    
    return {
        "session_id": request.session_id,
        "score_before": score_before,
        "score_after": score_after,
        "score_improvement": score_after - score_before,
        "changes_applied": len(request.approved_ids),
        "changes_rejected": len(request.rejected_ids),
        "pdf_ready": True,
        "message": "Changes applied successfully. Your optimized resume is ready for download."
    }

@api_router.get("/download/{session_id}")
async def download_resume(session_id: str):
    """Download the optimized resume PDF."""
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    pdf_path = session.get('pdf_path')
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    
    return FileResponse(
        path=pdf_path,
        filename=f"optimized_resume_{session_id}.pdf",
        media_type="application/pdf"
    )

@api_router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details and state."""
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
