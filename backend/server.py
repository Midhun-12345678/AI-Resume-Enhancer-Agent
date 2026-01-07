from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import base64
from io import BytesIO

# PDF processing with PyMuPDF
import fitz  # PyMuPDF

# LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# LLM API Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# =============================================================================
# IN-MEMORY SESSION STORAGE (No MongoDB)
# =============================================================================
sessions: Dict[str, Dict[str, Any]] = {}

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class AnalyzeRequest(BaseModel):
    job_description: str

class ApplyRequest(BaseModel):
    session_id: str
    approved_ids: List[str]

class TextBlock(BaseModel):
    id: str
    text: str
    page: int
    bbox: List[float]  # [x0, y0, x1, y1]
    font_name: str
    font_size: float
    color: List[float]  # RGB

class Suggestion(BaseModel):
    id: str
    section: str
    original_text: str
    suggested_text: str
    reason: str
    keywords_added: List[str]
    impact: str  # "high", "medium", "low"
    text_block_id: Optional[str] = None

class AnalysisResponse(BaseModel):
    session_id: str
    ats_score_before: int
    ats_score_potential: int
    issues: List[str]
    suggestions: List[Dict[str, Any]]
    jd_keywords: List[str]
    missing_keywords: List[str]
    message: str

# =============================================================================
# PDF PROCESSING WITH PyMuPDF
# =============================================================================

def extract_text_with_positions(pdf_bytes: bytes) -> Dict[str, Any]:
    """Extract text from PDF with position, font, and style metadata."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    text_blocks = []
    full_text = ""
    
    page_count = len(doc)
    
    for page_num in range(page_count):
        page = doc[page_num]
        
        # Get detailed text blocks with formatting
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
        
        for block in blocks.get("blocks", []):
            if block.get("type") == 0:  # Text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if text:
                            text_block = {
                                "id": str(uuid.uuid4()),
                                "text": text,
                                "page": page_num,
                                "bbox": list(span.get("bbox", [0, 0, 0, 0])),
                                "font_name": span.get("font", ""),
                                "font_size": span.get("size", 12),
                                "color": span.get("color", 0),
                                "flags": span.get("flags", 0)
                            }
                            text_blocks.append(text_block)
                            full_text += text + " "
    
    doc.close()
    
    return {
        "text_blocks": text_blocks,
        "full_text": full_text.strip(),
        "page_count": page_count
    }

def extract_text_simple(pdf_bytes: bytes) -> str:
    """Extract plain text from PDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text.strip()

def find_text_in_pdf(pdf_bytes: bytes, search_text: str) -> List[Dict]:
    """Find all occurrences of text in PDF with their positions."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    results = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        # Search for the text
        text_instances = page.search_for(search_text)
        
        for rect in text_instances:
            results.append({
                "page": page_num,
                "bbox": [rect.x0, rect.y0, rect.x1, rect.y1]
            })
    
    doc.close()
    return results

def modify_pdf_text(pdf_bytes: bytes, replacements: List[Dict]) -> bytes:
    """
    Modify PDF by replacing text in-place.
    
    replacements: [
        {
            "original_text": "old text",
            "new_text": "new text",
            "page": 0 (optional, searches all if not provided)
        }
    ]
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for replacement in replacements:
        original = replacement.get("original_text", "")
        new_text = replacement.get("new_text", "")
        target_page = replacement.get("page", None)
        
        if not original or not new_text:
            continue
        
        pages_to_check = [target_page] if target_page is not None else range(len(doc))
        
        for page_num in pages_to_check:
            if page_num >= len(doc):
                continue
                
            page = doc[page_num]
            
            # Find all instances of the original text
            text_instances = page.search_for(original)
            
            for rect in text_instances:
                # Get the font info from this area
                blocks = page.get_text("dict", clip=rect)
                font_name = "helv"  # Default font
                font_size = 11
                text_color = (0, 0, 0)  # Black
                
                # Try to extract font info from the area
                for block in blocks.get("blocks", []):
                    if block.get("type") == 0:
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                font_name = span.get("font", "helv")
                                font_size = span.get("size", 11)
                                color_int = span.get("color", 0)
                                # Convert integer color to RGB
                                if isinstance(color_int, int):
                                    r = ((color_int >> 16) & 255) / 255
                                    g = ((color_int >> 8) & 255) / 255
                                    b = (color_int & 255) / 255
                                    text_color = (r, g, b)
                                break
                
                # Step 1: Redact (white out) the original text
                # Add a small padding to ensure complete coverage
                redact_rect = fitz.Rect(
                    rect.x0 - 1,
                    rect.y0 - 1,
                    rect.x1 + 1,
                    rect.y1 + 1
                )
                
                # Create redaction annotation
                annot = page.add_redact_annot(redact_rect, fill=(1, 1, 1))  # White fill
                
                # Apply the redaction
                page.apply_redactions()
                
                # Step 2: Insert new text at the same position
                # Calculate text insertion point (bottom-left of bbox for baseline)
                insert_point = fitz.Point(rect.x0, rect.y1 - 2)
                
                # Map common fonts to available ones
                font_map = {
                    "helv": "helv",
                    "Helvetica": "helv",
                    "Arial": "helv",
                    "Times": "times-roman",
                    "TimesNewRoman": "times-roman",
                    "Courier": "courier",
                }
                
                # Try to use a similar font
                base_font = font_name.split("-")[0].split(",")[0]
                mapped_font = font_map.get(base_font, "helv")
                
                # Adjust font size if new text is longer
                adjusted_size = font_size
                if len(new_text) > len(original) * 1.2:
                    # Shrink font slightly if text is much longer
                    ratio = len(original) / len(new_text)
                    adjusted_size = max(font_size * ratio, font_size * 0.8)
                
                # Insert the new text
                page.insert_text(
                    insert_point,
                    new_text,
                    fontname=mapped_font,
                    fontsize=adjusted_size,
                    color=text_color
                )
    
    # Save to bytes
    output = BytesIO()
    doc.save(output, garbage=4, deflate=True)
    doc.close()
    
    return output.getvalue()

# =============================================================================
# ATS SCORE CALCULATION
# =============================================================================

def calculate_ats_score(resume_text: str, jd_keywords: List[str], required_skills: List[str]) -> Dict[str, Any]:
    """Calculate ATS score based on keyword matching."""
    resume_lower = resume_text.lower()
    
    # Count matched keywords
    matched_keywords = []
    missing_keywords = []
    
    all_keywords = list(set(jd_keywords + required_skills))
    
    for kw in all_keywords:
        if kw.lower() in resume_lower:
            matched_keywords.append(kw)
        else:
            missing_keywords.append(kw)
    
    # Base score from keyword matching
    if len(all_keywords) > 0:
        keyword_score = (len(matched_keywords) / len(all_keywords)) * 70  # 70% weight to keywords
    else:
        keyword_score = 35
    
    # Bonus points
    bonus = 0
    
    # Action verbs check
    action_verbs = ['achieved', 'improved', 'developed', 'led', 'managed', 'created', 
                   'implemented', 'designed', 'built', 'delivered', 'increased', 
                   'reduced', 'optimized', 'launched', 'established']
    action_verb_count = sum(1 for verb in action_verbs if verb in resume_lower)
    if action_verb_count >= 5:
        bonus += 10
    elif action_verb_count >= 3:
        bonus += 5
    
    # Metrics/numbers check
    import re
    numbers = re.findall(r'\d+%|\d+\+|\$\d+|\d+ years', resume_text)
    if len(numbers) >= 5:
        bonus += 10
    elif len(numbers) >= 2:
        bonus += 5
    
    # Structure check (has sections)
    section_keywords = ['experience', 'education', 'skills', 'projects', 'summary']
    sections_found = sum(1 for s in section_keywords if s in resume_lower)
    if sections_found >= 4:
        bonus += 10
    elif sections_found >= 2:
        bonus += 5
    
    total_score = min(100, int(keyword_score + bonus))
    
    return {
        "score": total_score,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "action_verb_count": action_verb_count,
        "metrics_count": len(numbers),
        "sections_found": sections_found
    }

# =============================================================================
# LLM ANALYSIS
# =============================================================================

async def analyze_with_llm(prompt: str, session_id: str) -> str:
    """Use LLM to analyze and generate suggestions."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"resume-{session_id}",
            system_message="""You are an expert ATS (Applicant Tracking System) optimization specialist. 
You help optimize resumes for better ATS compatibility while maintaining truthfulness.
You NEVER fabricate experience, metrics, or skills.
You suggest improvements that are realistic and professional.
Always respond in valid JSON format."""
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return response
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

async def extract_jd_keywords(job_description: str, session_id: str) -> Dict[str, Any]:
    """Extract keywords and requirements from job description."""
    prompt = f"""Analyze this job description and extract key information.

JOB DESCRIPTION:
{job_description}

Return ONLY valid JSON with this structure:
{{
    "keywords": ["important keywords from JD"],
    "required_skills": ["required technical skills"],
    "preferred_skills": ["nice-to-have skills"],
    "action_verbs": ["action verbs used in JD"],
    "role_level": "entry/mid/senior/lead",
    "industry_terms": ["industry-specific terms"]
}}"""
    
    response = await analyze_with_llm(prompt, session_id)
    
    try:
        # Clean response
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('\n', 1)[1]
        if clean.endswith('```'):
            clean = clean.rsplit('```', 1)[0]
        return json.loads(clean.strip())
    except:
        return {
            "keywords": [],
            "required_skills": [],
            "preferred_skills": [],
            "action_verbs": [],
            "role_level": "mid",
            "industry_terms": []
        }

async def generate_suggestions(resume_text: str, jd_analysis: Dict, missing_keywords: List[str], current_score: int, session_id: str) -> List[Dict]:
    """Generate specific suggestions to improve ATS score."""
    
    prompt = f"""You are an ATS optimization expert. Analyze this resume against the job requirements and suggest SPECIFIC text replacements.

RESUME TEXT:
{resume_text}

JOB REQUIREMENTS:
- Required Skills: {', '.join(jd_analysis.get('required_skills', []))}
- Keywords: {', '.join(jd_analysis.get('keywords', []))}
- Missing Keywords in Resume: {', '.join(missing_keywords)}

CURRENT ATS SCORE: {current_score}/100
TARGET: Get score above 70

Generate suggestions to improve the resume. For each suggestion:
1. Find a SPECIFIC sentence or phrase that exists in the resume
2. Suggest a better version that includes relevant keywords
3. Keep the same meaning - DO NOT fabricate experience

Return ONLY valid JSON array:
[
    {{
        "section": "summary|skills|experience|education|projects",
        "original_text": "EXACT text from resume to replace (must exist in resume)",
        "suggested_text": "improved version with keywords",
        "reason": "why this improves ATS score",
        "keywords_added": ["list", "of", "keywords"],
        "impact": "high|medium|low"
    }}
]

RULES:
- original_text MUST be an exact match from the resume
- Maximum 8 suggestions
- Focus on HIGH IMPACT changes first
- Never add fake metrics or experience
- Keep professional tone"""

    response = await analyze_with_llm(prompt, session_id + "-suggestions")
    
    try:
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('\n', 1)[1]
        if clean.endswith('```'):
            clean = clean.rsplit('```', 1)[0]
        suggestions = json.loads(clean.strip())
        
        # Add IDs to suggestions
        for sugg in suggestions:
            sugg['id'] = str(uuid.uuid4())
        
        return suggestions
    except Exception as e:
        logger.error(f"Failed to parse suggestions: {e}")
        return []

# =============================================================================
# API ROUTES
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "ResumeAI - ATS Optimization Agent API (No Database)"}

@api_router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(...)
):
    """
    Analyze resume against job description.
    Returns ATS score and suggestions for improvement.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = file.filename.lower().split('.')[-1]
    if file_ext != 'pdf':
        raise HTTPException(status_code=400, detail="Only PDF files are supported for template preservation")
    
    # Read file content
    pdf_bytes = await file.read()
    
    # Extract text with positions
    extraction = extract_text_with_positions(pdf_bytes)
    resume_text = extraction["full_text"]
    
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    
    # Create session
    session_id = str(uuid.uuid4())
    
    # Step 1: Analyze Job Description
    jd_analysis = await extract_jd_keywords(job_description, session_id)
    
    # Step 2: Calculate ATS Score
    all_keywords = jd_analysis.get('keywords', []) + jd_analysis.get('required_skills', [])
    score_data = calculate_ats_score(resume_text, jd_analysis.get('keywords', []), jd_analysis.get('required_skills', []))
    
    current_score = score_data["score"]
    missing_keywords = score_data["missing_keywords"]
    
    # Step 3: Generate Issues List
    issues = []
    if current_score < 70:
        issues.append(f"ATS Score is {current_score}/100 - needs improvement to reach 70+")
    if len(missing_keywords) > 5:
        issues.append(f"Missing {len(missing_keywords)} important keywords from job description")
    if score_data["action_verb_count"] < 3:
        issues.append("Resume lacks strong action verbs")
    if score_data["metrics_count"] < 2:
        issues.append("Resume lacks quantifiable achievements/metrics")
    
    # Step 4: Generate Suggestions
    suggestions = []
    if current_score < 70 or len(missing_keywords) > 0:
        suggestions = await generate_suggestions(
            resume_text, 
            jd_analysis, 
            missing_keywords, 
            current_score, 
            session_id
        )
    
    # Calculate potential score if all suggestions approved
    potential_keywords_added = set()
    for sugg in suggestions:
        potential_keywords_added.update(sugg.get('keywords_added', []))
    
    potential_score = min(100, current_score + len(potential_keywords_added) * 3 + len(suggestions) * 2)
    
    # Store session in memory
    sessions[session_id] = {
        "id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "pdf_bytes": base64.b64encode(pdf_bytes).decode('utf-8'),
        "resume_text": resume_text,
        "job_description": job_description,
        "jd_analysis": jd_analysis,
        "ats_score_before": current_score,
        "ats_score_potential": potential_score,
        "missing_keywords": missing_keywords,
        "suggestions": suggestions,
        "issues": issues,
        "text_blocks": extraction["text_blocks"]
    }
    
    return {
        "session_id": session_id,
        "ats_score_before": current_score,
        "ats_score_potential": potential_score,
        "issues": issues,
        "suggestions": suggestions,
        "jd_keywords": all_keywords,
        "missing_keywords": missing_keywords,
        "matched_keywords": score_data["matched_keywords"],
        "message": f"Analysis complete. Current score: {current_score}/100. Potential after optimization: {potential_score}/100"
    }

@api_router.post("/apply")
async def apply_changes(request: ApplyRequest):
    """
    Apply approved suggestions and return modified PDF.
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Get original PDF bytes
    pdf_bytes = base64.b64decode(session["pdf_bytes"])
    
    # Filter approved suggestions
    approved_suggestions = [
        s for s in session["suggestions"] 
        if s["id"] in request.approved_ids
    ]
    
    if not approved_suggestions:
        raise HTTPException(status_code=400, detail="No suggestions approved")
    
    # Prepare replacements
    replacements = []
    for sugg in approved_suggestions:
        replacements.append({
            "original_text": sugg["original_text"],
            "new_text": sugg["suggested_text"]
        })
    
    # Modify PDF
    try:
        modified_pdf = modify_pdf_text(pdf_bytes, replacements)
    except Exception as e:
        logger.error(f"PDF modification error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to modify PDF: {str(e)}")
    
    # Calculate new score
    new_text = extract_text_simple(modified_pdf)
    jd_analysis = session["jd_analysis"]
    new_score_data = calculate_ats_score(
        new_text, 
        jd_analysis.get('keywords', []), 
        jd_analysis.get('required_skills', [])
    )
    
    # Update session
    session["ats_score_after"] = new_score_data["score"]
    session["modified_pdf"] = base64.b64encode(modified_pdf).decode('utf-8')
    session["applied_suggestions"] = request.approved_ids
    
    return {
        "session_id": request.session_id,
        "ats_score_before": session["ats_score_before"],
        "ats_score_after": new_score_data["score"],
        "changes_applied": len(approved_suggestions),
        "message": f"Applied {len(approved_suggestions)} changes. New ATS score: {new_score_data['score']}/100"
    }

@api_router.get("/download/{session_id}")
async def download_pdf(session_id: str):
    """Download the modified PDF."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if "modified_pdf" not in session:
        raise HTTPException(status_code=400, detail="No modifications applied yet")
    
    pdf_bytes = base64.b64decode(session["modified_pdf"])
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=optimized_resume_{session_id[:8]}.pdf"
        }
    )

@api_router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Return session without the binary PDF data
    return {
        "id": session["id"],
        "created_at": session["created_at"],
        "ats_score_before": session["ats_score_before"],
        "ats_score_potential": session.get("ats_score_potential"),
        "ats_score_after": session.get("ats_score_after"),
        "issues": session["issues"],
        "suggestions": session["suggestions"],
        "missing_keywords": session["missing_keywords"],
        "jd_analysis": session["jd_analysis"],
        "applied_suggestions": session.get("applied_suggestions", [])
    }

@api_router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session to free memory."""
    if session_id in sessions:
        del sessions[session_id]
        return {"message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
