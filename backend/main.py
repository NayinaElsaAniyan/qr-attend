import os
import uuid
import qrcode
import io
import base64
import csv
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Create the FastAPI app
app = FastAPI(
    title="QR Attendance API",
    description="Smart QR-based attendance for TAs",
    version="1.0.0"
)

# CORS: Allow your frontend to talk to this backend
# Without this, the browser blocks requests from localhost:5173 to localhost:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/api/health")
def health_check():
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}

# --- Pydantic Models ---
# These define what data each endpoint expects.
# If someone sends wrong data, FastAPI auto-rejects with a clear error.

class ClassCreate(BaseModel):
    name: str          # "Physics 101 Lab"
    course_code: str   # "PHYS-1021"

class SessionCreate(BaseModel):
    class_id: str
    expiry_minutes: int = 2  # Default: QR expires in 2 minutes

class AttendanceMark(BaseModel):
    qr_token: str
    student_name: str
    student_email: str

class NoteCreate(BaseModel):
    class_id: str
    week_number: int
    content: str
    tags: list = []
    date: str = None  # Optional, defaults to today

class NoteUpdate(BaseModel):
    content: str = None
    tags: list = None
# ========== CLASSES ==========

@app.post("/api/classes")
def create_class(data: ClassCreate):
    """Create a new class. The TA does this once per class they teach."""
    result = supabase.table("classes").insert({
        "name": data.name,
        "course_code": data.course_code
    }).execute()
    return result.data[0]


@app.get("/api/classes")
def list_classes():
    """List all classes, newest first."""
    result = supabase.table("classes") \
        .select("*") \
        .order("created_at", desc=True) \
        .execute()
    return result.data

# ========== SESSIONS ==========

@app.post("/api/sessions")
def create_session(data: SessionCreate):
    """Start a new attendance session. Deactivates previous ones."""
    
    # Step 1: Deactivate old sessions for this class
    supabase.table("sessions").update({
        "is_active": False
    }).eq("class_id", data.class_id).eq("is_active", True).execute()

    # Step 2: Generate a short unique token (first 8 chars of a UUID)
    qr_token = str(uuid.uuid4())[:8]
    
    # Step 3: Set expiration time
    expires_at = datetime.utcnow() + timedelta(minutes=data.expiry_minutes)

    # Step 4: Save to database
    result = supabase.table("sessions").insert({
        "class_id": data.class_id,
        "qr_token": qr_token,
        "expires_at": expires_at.isoformat(),
        "is_active": True
    }).execute()

    return result.data[0]


@app.get("/api/sessions/{session_id}/qr")
def get_qr_code(session_id: str, base_url: str = "http://localhost:5173"):
    """Generate a QR code image for a session."""
    
    # Fetch the session
    session = supabase.table("sessions") \
        .select("*") \
        .eq("id", session_id) \
        .single() \
        .execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.data["is_active"]:
        raise HTTPException(status_code=400, detail="Session expired")

    # The QR encodes a URL: when student scans, they land on this page
    attendance_url = f"{base_url}/mark/{session.data['qr_token']}"

    # Generate QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(attendance_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    # Convert image to base64 string (so frontend can display it directly)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return {
        "qr_base64": f"data:image/png;base64,{img_base64}",
        "attendance_url": attendance_url,
        "token": session.data["qr_token"],
        "expires_at": session.data["expires_at"]
    }
# ========== ATTENDANCE ==========

@app.post("/api/attendance/mark")
def mark_attendance(data: AttendanceMark, request: Request):
    """Student marks their attendance via QR code scan."""
    
    # Step 1: Find the session by token and check it's active
    session = supabase.table("sessions") \
        .select("*") \
        .eq("qr_token", data.qr_token) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not session.data:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired QR code"
        )

    # Step 2: Check if the QR has expired by time
    expires_at = datetime.fromisoformat(
        session.data["expires_at"].replace("Z", "+00:00")
    )
    if datetime.now(expires_at.tzinfo) > expires_at:
        # Auto-deactivate expired session
        supabase.table("sessions") \
            .update({"is_active": False}) \
            .eq("id", session.data["id"]) \
            .execute()
        raise HTTPException(
            status_code=400,
            detail="QR code has expired. Ask your TA for a new one."
        )

    # Step 3: Check if student already marked attendance
    existing = supabase.table("attendance") \
        .select("id") \
        .eq("session_id", session.data["id"]) \
        .eq("student_email", data.student_email) \
        .execute()

    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="You've already marked attendance for this session"
        )

    # Step 4: Mark attendance!
    client_ip = request.client.host if request.client else None
    
    result = supabase.table("attendance").insert({
        "session_id": session.data["id"],
        "student_name": data.student_name,
        "student_email": data.student_email,
        "ip_address": client_ip
    }).execute()

    return {
        "message": "Attendance marked successfully!",
        "data": result.data[0]
    }
@app.get("/api/attendance/session/{session_id}")
def get_attendance(session_id: str):
    """Get all attendance records for a session (for the live feed)."""
    result = supabase.table("attendance") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("marked_at") \
        .execute()
    return result.data


@app.get("/api/attendance/export/{session_id}")
def export_csv(session_id: str):
    """Export attendance as CSV — ready to upload to university portal."""
    records = supabase.table("attendance") \
        .select("student_name, student_email, marked_at") \
        .eq("session_id", session_id) \
        .order("marked_at") \
        .execute()

    # Build CSV in memory (no temp files needed)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student Name", "Email", "Time", "Status"])
    for r in records.data:
        writer.writerow([
            r["student_name"],
            r["student_email"],
            r["marked_at"],
            "Present"
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=attendance_{session_id[:8]}.csv"
        }
    )

# ========== ANALYTICS ==========

@app.get("/api/analytics/class/{class_id}")
def class_analytics(class_id: str):
    """Get attendance stats and trend data for a class."""

    # Get all sessions for this class
    sessions = supabase.table("sessions") \
        .select("id, created_at") \
        .eq("class_id", class_id) \
        .order("created_at") \
        .execute()

    # For each session, count attendance
    trend = []
    total_attendance = 0
    for session in sessions.data:
        count_res = supabase.table("attendance") \
            .select("id", count="exact") \
            .eq("session_id", session["id"]) \
            .execute()
        count = count_res.count if count_res.count else 0
        total_attendance += count
        trend.append({
            "session_id": session["id"],
            "date": session["created_at"][:10],
            "count": count
        })

    total_sessions = len(sessions.data)
    avg_attendance = round(total_attendance / total_sessions, 1) if total_sessions > 0 else 0

    # Get unique students who have ever attended this class
    all_student_emails = set()
    for session in sessions.data:
        att = supabase.table("attendance") \
            .select("student_email") \
            .eq("session_id", session["id"]) \
            .execute()
        for record in att.data:
            all_student_emails.add(record["student_email"])

    return {
        "total_sessions": total_sessions,
        "total_unique_students": len(all_student_emails),
        "average_attendance": avg_attendance,
        "trend": trend
    }
# ========== EXPORT ALL ==========

@app.get("/api/attendance/export-all/class/{class_id}")
def export_all_csv(class_id: str):
    """Export attendance for ALL sessions of a class as one CSV."""
    sessions = supabase.table("sessions") \
        .select("id, created_at, qr_token") \
        .eq("class_id", class_id) \
        .order("created_at") \
        .execute()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Session Date", "Session Token", "Student Name", "Email", "Marked At", "Status"])

    for session in sessions.data:
        records = supabase.table("attendance") \
            .select("student_name, student_email, marked_at") \
            .eq("session_id", session["id"]) \
            .order("marked_at") \
            .execute()
        for r in records.data:
            writer.writerow([
                session["created_at"][:10],
                session["qr_token"],
                r["student_name"],
                r["student_email"],
                r["marked_at"],
                "Present"
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=all_attendance_{class_id[:8]}.csv"
        }
    )
# ========== ALERTS ==========

@app.get("/api/alerts/class/{class_id}")
def low_attendance_alerts(class_id: str, threshold: int = 3):
    sessions = supabase.table("sessions") \
        .select("id") \
        .eq("class_id", class_id) \
        .execute()

    if not sessions.data:
        return {"alerts": [], "total_sessions": 0}

    total_sessions = len(sessions.data)
    session_ids = [s["id"] for s in sessions.data]

    student_counts = {}
    for sid in session_ids:
        att = supabase.table("attendance") \
            .select("student_email, student_name") \
            .eq("session_id", sid) \
            .execute()
        for record in att.data:
            email = record["student_email"]
            if email not in student_counts:
                student_counts[email] = {
                    "name": record["student_name"],
                    "email": email,
                    "attended": 0
                }
            student_counts[email]["attended"] += 1

    alerts = []
    for email, data in student_counts.items():
        missed = total_sessions - data["attended"]
        if missed >= threshold:
            alerts.append({
                "student_name": data["name"],
                "student_email": email,
                "attended": data["attended"],
                "missed": missed,
                "total_sessions": total_sessions
            })

    alerts.sort(key=lambda x: x["missed"], reverse=True)
    return {"alerts": alerts, "total_sessions": total_sessions}


# ========== NOTES ==========

@app.post("/api/notes")
def create_note(data: NoteCreate):
    note_data = {
        "class_id": data.class_id,
        "week_number": data.week_number,
        "content": data.content,
        "tags": data.tags,
    }
    if data.date:
        note_data["date"] = data.date
    result = supabase.table("notes").insert(note_data).execute()
    return result.data[0]


@app.get("/api/notes/class/{class_id}")
def list_notes(class_id: str):
    result = supabase.table("notes") \
        .select("*") \
        .eq("class_id", class_id) \
        .order("week_number", desc=True) \
        .execute()
    return result.data


@app.put("/api/notes/{note_id}")
def update_note(note_id: str, data: NoteUpdate):
    update_data = {}
    if data.content is not None:
        update_data["content"] = data.content
    if data.tags is not None:
        update_data["tags"] = data.tags
    update_data["updated_at"] = datetime.utcnow().isoformat()
    result = supabase.table("notes") \
        .update(update_data) \
        .eq("id", note_id) \
        .execute()
    return result.data[0]


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: str):
    supabase.table("notes").delete().eq("id", note_id).execute()
    return {"message": "Note deleted"}

# ========== SESSION HISTORY ==========

@app.get("/api/sessions/history/{class_id}")
def session_history(class_id: str):
    """Get all sessions for a class with attendance counts."""
    sessions = supabase.table("sessions") \
        .select("id, qr_token, created_at, is_active, expires_at") \
        .eq("class_id", class_id) \
        .order("created_at", desc=True) \
        .execute()

    result = []
    for s in sessions.data:
        count_res = supabase.table("attendance") \
            .select("id", count="exact") \
            .eq("session_id", s["id"]) \
            .execute()
        result.append({
            **s,
            "attendance_count": count_res.count if count_res.count else 0
        })

    return result