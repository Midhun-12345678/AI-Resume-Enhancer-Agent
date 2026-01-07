import requests
import sys
import json
import tempfile
import os
from datetime import datetime
from pathlib import Path

class ResumeAITester:
    def __init__(self, base_url="https://resumate-ai-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                details += f", Response: {response.json()}"
            self.log_test("API Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("API Health Check", False, str(e))
            return False

    def create_test_pdf(self):
        """Create a simple test PDF file"""
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph
            from reportlab.lib.styles import getSampleStyleSheet
            
            # Create temporary PDF
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            doc = SimpleDocTemplate(temp_file.name, pagesize=letter)
            styles = getSampleStyleSheet()
            
            story = []
            story.append(Paragraph("John Doe", styles['Title']))
            story.append(Paragraph("Software Engineer", styles['Heading2']))
            story.append(Paragraph("SUMMARY", styles['Heading3']))
            story.append(Paragraph("Experienced software engineer with 5 years in web development.", styles['Normal']))
            story.append(Paragraph("SKILLS", styles['Heading3']))
            story.append(Paragraph("Python, JavaScript, React, Node.js, MongoDB", styles['Normal']))
            story.append(Paragraph("EXPERIENCE", styles['Heading3']))
            story.append(Paragraph("Senior Developer at Tech Corp (2020-2024)", styles['Normal']))
            story.append(Paragraph("• Developed web applications using React and Node.js", styles['Normal']))
            story.append(Paragraph("• Improved system performance by 30%", styles['Normal']))
            story.append(Paragraph("EDUCATION", styles['Heading3']))
            story.append(Paragraph("BS Computer Science, University of Tech (2016-2020)", styles['Normal']))
            
            doc.build(story)
            temp_file.close()
            return temp_file.name
        except Exception as e:
            print(f"Failed to create test PDF: {e}")
            return None

    def test_analyze_resume(self):
        """Test resume analysis endpoint (POST /api/analyze)"""
        pdf_path = self.create_test_pdf()
        if not pdf_path:
            self.log_test("Analyze Resume", False, "Could not create test PDF")
            return False

        job_description = """
        We are looking for a Senior Software Engineer to join our team.
        
        Requirements:
        - 5+ years of experience in software development
        - Strong proficiency in Python, JavaScript, React
        - Experience with Node.js and MongoDB
        - Knowledge of web development best practices
        - Experience with agile development methodologies
        - Strong problem-solving skills
        - Bachelor's degree in Computer Science or related field
        
        Responsibilities:
        - Develop and maintain web applications
        - Collaborate with cross-functional teams
        - Write clean, maintainable code
        - Participate in code reviews
        - Mentor junior developers
        """

        try:
            with open(pdf_path, 'rb') as f:
                files = {'file': ('test_resume.pdf', f, 'application/pdf')}
                data = {'job_description': job_description}
                response = requests.post(f"{self.base_url}/analyze", files=files, data=data, timeout=60)
            
            # Clean up
            os.unlink(pdf_path)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                self.session_id = data.get('session_id')
                score_before = data.get('ats_score_before', 0)
                score_potential = data.get('ats_score_potential', 0)
                suggestions_count = len(data.get('suggestions', []))
                details = f"Session ID: {self.session_id}, ATS Score: {score_before}/{score_potential}, Suggestions: {suggestions_count}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Analyze Resume", success, details)
            return success
        except Exception as e:
            self.log_test("Analyze Resume", False, str(e))
            return False

    def test_get_session(self):
        """Test session retrieval endpoint (GET /api/session/{session_id})"""
        if not self.session_id:
            self.log_test("Get Session", False, "No session ID")
            return False

        try:
            response = requests.get(f"{self.base_url}/session/{self.session_id}", timeout=10)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                score_before = data.get('ats_score_before', 0)
                suggestions_count = len(data.get('suggestions', []))
                details = f"ATS Score: {score_before}, Suggestions: {suggestions_count}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Get Session", success, details)
            return success
        except Exception as e:
            self.log_test("Get Session", False, str(e))
            return False

    def test_apply_changes(self):
        """Test apply changes endpoint (POST /api/apply)"""
        if not self.session_id:
            self.log_test("Apply Changes", False, "No session ID")
            return False

        # First get session to get suggestions
        try:
            session_response = requests.get(f"{self.base_url}/session/{self.session_id}", timeout=10)
            if session_response.status_code != 200:
                self.log_test("Apply Changes", False, "Could not get session data")
                return False
            
            session_data = session_response.json()
            suggestions = session_data.get('suggestions', [])
            
            if not suggestions:
                self.log_test("Apply Changes", False, "No suggestions to approve")
                return False
            
            # Approve first suggestion
            approved_ids = [suggestions[0]['id']] if suggestions else []
            
            payload = {
                "session_id": self.session_id,
                "approved_ids": approved_ids
            }
            
            response = requests.post(f"{self.base_url}/apply", json=payload, timeout=60)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                score_before = data.get('ats_score_before', 0)
                score_after = data.get('ats_score_after', 0)
                changes_applied = data.get('changes_applied', 0)
                details = f"Score: {score_before}→{score_after}, Changes: {changes_applied}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Apply Changes", success, details)
            return success
        except Exception as e:
            self.log_test("Apply Changes", False, str(e))
            return False

    def test_download_resume(self):
        """Test resume download endpoint (GET /api/download/{session_id})"""
        if not self.session_id:
            self.log_test("Download Resume", False, "No session ID")
            return False

        try:
            response = requests.get(f"{self.base_url}/download/{self.session_id}", timeout=30)
            
            success = response.status_code == 200
            if success:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                details = f"Content-Type: {content_type}, Size: {content_length} bytes"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Download Resume", success, details)
            return success
        except Exception as e:
            self.log_test("Download Resume", False, str(e))
            return False

    def test_delete_session(self):
        """Test session deletion endpoint (DELETE /api/session/{session_id})"""
        if not self.session_id:
            self.log_test("Delete Session", False, "No session ID")
            return False

        try:
            response = requests.delete(f"{self.base_url}/session/{self.session_id}", timeout=10)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                details = f"Response: {data.get('message', 'Session deleted')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Delete Session", success, details)
            return success
        except Exception as e:
            self.log_test("Delete Session", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting ResumeAI Backend Tests")
        print(f"📍 Testing API at: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_api_health,
            self.test_analyze_resume,
            self.test_get_session,
            self.test_apply_changes,
            self.test_download_resume,
            self.test_delete_session
        ]
        
        for test in tests:
            test()
            print()
        
        # Summary
        print("=" * 60)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    tester = ResumeAITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())