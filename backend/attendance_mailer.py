import pandas as pd
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re

def send_email(to_email, student_name, absent_dates, session_name):
    current_year = datetime.now().year
    formatted_dates = ", ".join([f"{date}-{current_year}" for date in absent_dates])

    subject = "Absence Notification"
    body = f"""
    Dear {student_name},

    We noticed that you were absent for the enrolled course {session_name} on the following days:
    {formatted_dates}

    Regular attendance is essential to stay aligned with the course content and placement activities. Please ensure you go through the missed session before attending the upcoming ones.

    Kindly note 85% attendance is mandatory to get certification and placement assistance. A minimum of 70% attendance is mandatory to be eligible for certification and placement support.

    Warm Regards,
    Learning Coordinator
    ChipEdge Technologies Pvt Ltd
    https://chipedge.com/
    """

    msg = MIMEMultipart("alternative")
    msg['Subject'] = subject
    msg['From'] = "customer.success@chipedge.com"  # replace with your sender email
    msg['To'] = to_email
    msg.attach(MIMEText(body, "plain"))

    # Use actual email credentials / environment variables for security
    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login("customer.success@chipedge.com", "hvxdizbuidwsitpg")  # Secure app password
        server.send_message(msg)

def process_attendance(file_path):
    # Read CSV with possible header skip and metadata lines according to your notebook
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Extract session name from line 4 (index 3)
    session_name = ""
    if len(lines) > 3:
        line_text = " ".join(lines[3].strip().split(","))
        match = re.search(r'Course\s*Name\s*[:-]*\s*(.*)', line_text, re.IGNORECASE)
        session_name = match.group(1).strip() if match else line_text

    # Load attendance data skipping first 6 rows (metadata)
    df = pd.read_csv(file_path, skiprows=6)
    df.columns = df.columns.str.strip()

    required_columns = ['Learners', 'Email']
    for col in required_columns:
        if col not in df.columns:
            return f"Missing required column: {col}"

    dates = df.columns[4:]  # Adjust if needed

    absent_students = {}
    for _, row in df.iterrows():
        student_name = row['Learners']
        email = row['Email']
        absent_dates = []
        for date in dates: # type: ignore
            cell = str(row[date]).strip().upper()
            if cell in ['A', 'OL']:
                absent_dates.append(date.split('.')[0])
        if absent_dates:
            absent_students[email] = (student_name, absent_dates)

    # Send emails
    count = 0
    for email, (student_name, absent_dates) in absent_students.items():
        send_email(email, student_name, absent_dates, session_name)
        count += 1

    return f"✅ Emails sent to {count} learner(s)."
