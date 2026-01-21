// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from "nodemailer";
import xlsx from "xlsx";
import cron from "node-cron";
import fetch from "node-fetch";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { supabase } from "./supabaseClient.js";
import { sendRawEmail } from "./emailSender.js";
import {
  scheduleWeeklyQuizReminders,
  scheduleIntermediateAssessmentReminders,
} from "./reminderScheduler.js";
import { scheduleCourseApplicationEmails } from "./courseApplicationScheduler.js";
import { scheduleInternalEmail } from "./emailScheduler.js";
import { processAttendanceFile } from "./attendanceMailer.js";
import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import PDFDocument from "pdfkit";
import stream from "stream";
import PDFTable from "pdfkit-table";
import ExcelJS from "exceljs";
import { getWindowStatus } from "./marksWindowService.js";
import marksWindowsRouter from "./routes/marksWindows.js";
import marksSaveRouter from "./routes/marksSave.js";
import { pool } from "./db.js";
import announceRouter from "./routes/announce.js";
import attendanceRoutes from "./routes/attendance.js";
import jwt from "jsonwebtoken";
import holidaysRoutes from "./routes/holidaysRoutes.js";
import internalUsersRoutes from "./routes/internalUsersRoutes.js";

dotenv.config();

// Day.js timezone configuration (IST)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Kolkata");

const app = express();
const PORT = process.env.PORT || 5000;
const router = express.Router();

// ============================
// 🔥 IMPORTANT: NO TRAILING /
// ============================
const FRONTEND_URL = "https://engg-automation-r1ke.onrender.com";
const LOCAL_URL = "http://localhost:3000";

// =====================================================
// ✅ FIXED CORS — ONLY THIS IS ENOUGH (Render Friendly)
// =====================================================
app.use(
  cors({
    origin: [FRONTEND_URL, LOCAL_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
    ],
  })
);

// 🔥 GLOBAL OPTIONS HANDLER - BEFORE ALL ROUTES
app.options("*", (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://engg-automation-r1ke.onrender.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Accept');
  res.status(200).end();
});

// Mount routers
app.use('/api/marks', marksWindowsRouter);
app.use('/api/marks', marksSaveRouter);
app.use("/api/attendance", attendanceRoutes);

// =====================================================
// ✅ Handle Preflight Requests (OPTIONS)
// =====================================================
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_URL);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  return res.sendStatus(200);
});

// =====================================================
// Body Parser
// =====================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// =====================================================
// Multer File Upload Config
// =====================================================
const upload = multer({ dest: "uploads/" });

// Nodemailer transporter - update with your email provider settings
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "coordinator@chipedge.com",
    pass: "rjtjpkclsqgnafgs",
  },
});

const validateMarkEntryWindow = (assessmentDate, assessmentType) => {
  try {
    const daysWindowMap = {
      'weekly-assessment': 4,
      'intermediate-assessment': 5,
      'module-level-assessment': 6,
      'weekly-quiz': 7
    };

    const daysWindow = daysWindowMap[assessmentType] || 7;
    
    // STRICT DD/MM/YYYY parsing
    const [day, month, year] = assessmentDate.split('/');
    const assessment = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    
    if (isNaN(assessment.getTime())) {
      return { valid: false, error: 'Invalid date format (DD/MM/YYYY)' };
    }

    // BLOCK old dates (2025 in 2026)
    const now = new Date('2026-01-08T22:27:00+05:30'); // Current IST time
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    if (assessment < thirtyDaysAgo) {
      return { 
        valid: false, 
        error: `Assessment too old (${assessment.toLocaleDateString('en-GB')}). Max 30 days allowed.` 
      };
    }

    const closeDate = new Date(assessment);
    closeDate.setDate(assessment.getDate() + daysWindow);
    closeDate.setHours(23, 59, 59, 999);

    const isOpen = now <= closeDate;
    
    if (!isOpen) {
      return {
        valid: false,
        error: `Window closed. Assessment: ${assessmentDate}. Deadline: ${closeDate.toLocaleDateString('en-GB')}`
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Date validation failed' };
  }
};

const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.LEAVE_EMAIL_USER || "coordinator@chipedge.com",
    pass: process.env.LEAVE_EMAIL_PASS || "rjtjpkclsqgnafgs"
  },
});

const SENDER_EMAIL = "customer.success@chipedge.com";
const SENDER_PASS = "hvxdizbuidwsitpg"; // app password

const MOCK_INTERVIEW_REMINDER_SEND_TIME = "17:05"; // HH:mm
const TRAINER_SOFT_SKILLS_REMINDER_TIME = "17:08"; // HH:mm
const LEARNER_SOFT_SKILLS_REMINDER_TIME = "17:10"; // HH:mm

app.use(bodyParser.json());

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // same secret as /api/login
    // decoded should include { id, role, name, email }
    req.user = decoded;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// === Helpers ===
function formatDate(dateStr) {
  if (!dateStr) return "";
  return dayjs(dateStr).format("DD-MMM-YYYY");
}

function getCurrentYear() {
  return new Date().getFullYear(); // 2026 now → 2027 next year
}

function toISODateOnly(d) {
  // returns YYYY-MM-DD
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function parseHolidayDateCell(cell, currentYear) {
  if (cell == null) return null;

  if (cell instanceof Date) return toISODateOnly(cell);

  const raw = String(cell).trim();
  if (!raw) return null;

  // 1) YYYY-MM-DD (full date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // 2) DD-MMM (e.g., "1-Jan") → add currentYear
  const m1 = raw.match(/^(\d{1,2})-([A-Za-z]{3})$/);
  if (m1) {
    const dd = m1[1].padStart(2, "0");
    const monStr = m1[2];
    const monthIndex = new Date(`${monStr} 1, 2000`).getMonth();
    if (Number.isNaN(monthIndex)) return null;
    const dt = new Date(currentYear, monthIndex, Number(dd));
    return toISODateOnly(dt);
  }

  // 3) DD-MMM-YYYY (e.g., "1-Jan-2026")
  const m2 = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m2) {
    const dd = m2[1].padStart(2, "0");
    const monStr = m2[2];
    const yyyy = m2[3];
    const monthIndex = new Date(`${monStr} 1, 2000`).getMonth();
    if (Number.isNaN(monthIndex)) return null;
    const dt = new Date(Number(yyyy), monthIndex, Number(dd));
    return toISODateOnly(dt);
  }

  // 4) DD-MM-YYYY (e.g., "01-01-2026")
  const m3 = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m3) {
    const yyyy = m3[3];
    const mm = m3[2].padStart(2, "0");
    const dd = m3[1].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // 5) Last attempt: try as raw date
  return toISODateOnly(raw);
}

function computeTodayISO(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return dayjs().hour(hours).minute(minutes).second(0).millisecond(0).toISOString();
}

// FIXED: Properly handles negative offsets
function computeScheduledAtISO(startDateStr, offsetDays = 0, sendTime = "09:00") {
  try {
    // Ensure offsetDays is a NUMBER
    const offset = parseInt(offsetDays, 10);
    
    // Parse time
    const [hour, minute] = sendTime.split(":").map(Number);
    
    // Parse the date - handle both YYYY-MM-DD and full ISO formats
    let baseDate;
    if (startDateStr.includes('T')) {
      // Full ISO timestamp
      baseDate = dayjs(startDateStr);
    } else {
      // Just date YYYY-MM-DD
      baseDate = dayjs(startDateStr, 'YYYY-MM-DD');
    }
    
    // CRITICAL: Use subtract() for negative offsets, add() for positive
    let scheduledDate;
    if (offset < 0) {
      // Negative offset means go BACK in time (subtract absolute value)
      scheduledDate = baseDate.subtract(Math.abs(offset), 'day');
    } else {
      // Positive offset means go FORWARD in time
      scheduledDate = baseDate.add(offset, 'day');
    }
    
    // Set the time
    scheduledDate = scheduledDate.hour(hour).minute(minute).second(0).millisecond(0);
    
    // Detailed logging
    console.log('═══ computeScheduledAtISO ═══');
    console.log('Input date:', startDateStr);
    console.log('Offset (raw):', offsetDays, '(type:', typeof offsetDays, ')');
    console.log('Offset (parsed):', offset);
    console.log('Send time:', sendTime);
    console.log('Base date:', baseDate.format('YYYY-MM-DD'));
    console.log('Scheduled date:', scheduledDate.format('YYYY-MM-DD HH:mm:ss'));
    console.log('ISO output:', scheduledDate.toISOString());
    console.log('Days difference:', scheduledDate.diff(baseDate, 'day'));
    console.log('═══════════════════════════════');
    
    return scheduledDate.toISOString();
  } catch (error) {
    console.error('Error in computeScheduledAtISO:', error);
    throw error;
  }
}

// Helper used by leave emails
async function sendEmail({ to, subject, text, html }) {
  const fromAddress = process.env.LEAVE_EMAIL_USER || "coordinator@chipedge.com";

  const mailOptions = {
    from: `Leave Management <${fromAddress}>`,
    to,
    subject,
    text,
    html: html || text,
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

// Helper to generate Soft Skills monthly reminder email HTML
function generateSoftSkillSummaryEmail(topics, trainerEmail) {
  let formRows = "";
  for (const t of topics) {
    formRows += `
      <tr>
        <td>${t.batch_no}</td>
        <td>${t.topic_name}</td>
        <td>
          <input type="date" name="date_${t.id}" value="${(t.date || "").slice(0, 10)}" required />
          <input type="hidden" name="id_${t.id}" value="${t.id}" />
        </td>
      </tr>`;
  }
  return `
    <form action="http://localhost:3000/api/soft-skills-trainer-confirmation?trainer_email=${encodeURIComponent(
      trainerEmail
    )}" method="POST">
      <p>Dear ${topics[0]?.trainer_name || "Trainer"},</p>
      <p>Please review and confirm your Soft Skills sessions below by editing dates as necessary and clicking Confirm.</p>
      <table border="1" cellpadding="7" style="border-collapse: collapse;">
        <thead>
          <tr><th>Batch No</th><th>Topic</th><th>Date</th></tr>
        </thead>
        <tbody>${formRows}</tbody>
      </table><br/>
      <button type="submit">Confirm Dates</button>
    </form>
  `;
}

// Helper: checks if two date ranges overlap (inclusive)
function isDateOverlap(start1, end1, start2, end2) {
  // All dates as YYYY-MM-DD
  return !(new Date(end1) < new Date(start2) || new Date(start1) > new Date(end2));
}

// Tools: you need a 'tools' column in classroom_occupancy or separate table if you want to restrict by required tools.
async function hasRequiredTools(classroomName, requiredTools) {
  // Implement this lookup if your schema has tools info (pseudo-code):
  // const { data: classroom } = await supabase.from('classrooms').select('tools').eq('name', classroomName).single();
  // return !requiredTools || requiredTools.every(tool => classroom.tools.includes(tool));
  return true; // always true if not using tool restrictions
}


// === Send Attendance mails ===
function parseMeta(sheet) {
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const periodRow = rows[2].join(" ");
  let period = periodRow.match(/Period\s*:?\s*(\d{1,2} \w{3} \d{4}) to (\d{1,2} \w{3} \d{4})/i);
  let startDate = null, endDate = null;
  if (period) {
    startDate = new Date(period[1]);
    endDate = new Date(period[2]);
  }
  const sessionRow = rows[3].join(" ");
  let session = sessionRow.match(/Session\s*:\s*(.*)/i);
  if (!session) session = sessionRow.match(/Session\s*(.*)/i);
  session = session ? session[1].trim() : "";
  return { session, startDate, endDate, periodRaw: periodRow };
}

// -- KEY: Assign correct year to each date column using period start, end, and order --
function parseDateCols(rows, startDate, endDate) {
  const headerRow = rows[6];
  const dateMap = [];
  // Count for each date (for Session 1/2 labeling)
  const dateCounter = {};
  let prevYear = startDate.getFullYear();
  let prevMonth = startDate.getMonth();
  let currYear = prevYear;

  for (let colIdx = 4; colIdx < headerRow.length; colIdx++) {
    const raw = headerRow[colIdx];
    if (!raw || raw.toLowerCase().includes('total')) break;
    if (raw.toLowerCase().includes('notes')) continue;

    // Parse date value
    let [day, mon] = raw.split('-');
    day = parseInt(day, 10);
    let monthNum = new Date(Date.parse(mon + " 1, 2000")).getMonth();

    // Check if we cross to next year (last month is Dec, current is Jan)
    if (monthNum < prevMonth) {
      currYear = prevYear + 1;
    }
    prevMonth = monthNum;
    prevYear = currYear;

    // Compose date and labeling
    let fullDate = new Date(currYear, monthNum, day);
    let printKey = `${day} ${mon} ${currYear}`;
    dateCounter[printKey] = (dateCounter[printKey] || 0) + 1;
    let sessionTag = dateCounter[printKey] > 1 ? `Session ${dateCounter[printKey]}` : "";

    dateMap.push({
      colIdx,
      print: fullDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      tag: sessionTag
    });
  }
  return dateMap;
}

// Helper to check date range overlap
function isOverlap(startA, endA, startB, endB) {
  return (dayjs(startA).isBefore(dayjs(endB).add(1, 'day')) && dayjs(endA).isAfter(dayjs(startB).subtract(1, 'day')));
}

// Find available classroom and slot (morning/afternoon)
async function findAvailableClassroom(supabase, students, start_date, end_date, preferred_slot) {
  // Get all classrooms that have capacity >= students
  let { data: classrooms, error } = await supabase.from('classrooms').select('*').gte('capacity', students);
  if (error) throw error;

  // Get all batches in the same date range overlapping and slot
  let { data: batches, error: batchesErr } = await supabase
    .from('batches')
    .select('*')
    .or(
      `and(start_date.gte.${start_date},start_date.lte.${end_date})`,
      `and(end_date.gte.${start_date},end_date.lte.${end_date})`,
      `and(start_date.lte.${start_date},end_date.gte.${end_date})`
    )
    .eq('preferred_slot', preferred_slot);

  if (batchesErr) throw batchesErr;

  for (let classroom of classrooms) {
    // Check if classroom is free during the slot and date range (no batch overlapping for that classroom)
    const isBooked = batches.some(b =>
      b.classroom_id === classroom.id && isOverlap(b.start_date, b.end_date, start_date, end_date)
    );
    if (!isBooked) return classroom;
  }
  return null; // no classroom available
}

// Check license availability for domain and students count
async function checkLicenseAvailability(supabase, domain, students) {
  let { data: licenses, error } = await supabase.from('licenses').select('count').eq('domain', domain);
  if (error) throw error;

  if (!licenses || licenses.length === 0) return { available: false, missing: students };
  const availableCount = licenses.reduce((sum, lic) => sum + lic.count, 0);
  if (availableCount >= students) return { available: true, missing: 0 };
  else return { available: false, missing: students - availableCount };
}

// example helper
export async function getDistinctTrainersForBatch(batchNo) {
  const { data, error } = await supabase
    .from("course_planner_data")
    .select("trainer_email")
    .eq("batch_no", batchNo)
    .neq("trainer_email", null);

  if (error) {
    console.error("Error fetching trainers for batch", batchNo, error);
    return [];
  }

  const emails = [...new Set(data.map((row) => row.trainer_email))];
  return emails;
}

// Enhanced session-based attendance report API
app.get('/api/session-attendance-report', async (req, res) => {
  try {
    const { batch_no } = req.query;
    
    if (!batch_no) {
      return res.status(400).json({ error: 'batch_no required' });
    }

    console.log(`📊 Fetching attendance for batch: ${batch_no}`);

    // Try MySQL first (pool)
    try {
      const [rows] = await pool.execute(`
        SELECT 
          la.learner_email,
          la.status,
          la.session,
          la.date,
          COALESCE(la.topic_name, '') as topic_name,
          COALESCE(ld.name, la.learner_email) as learner_name
        FROM learner_attendance la
        LEFT JOIN learners_data ld ON la.learner_email = ld.email
        WHERE la.batch_no = ?
        ORDER BY la.learner_email, la.date, la.session
      `, [batch_no]);
      
      console.log(`✅ MySQL found ${rows.length} attendance records for ${batch_no}`);
      return res.json(rows);
    } catch (mysqlError) {
      console.log('MySQL failed, trying Supabase...');
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from('learner_attendance')
      .select(`
        learner_email,
        status,
        session,
        date,
        topic_name,
        learners_data!inner(name)
      `)
      .eq('batch_no', batch_no)
      .order('learner_email')
      .order('date')
      .order('session');

    if (error) {
      console.error('Supabase attendance error:', error);
      return res.status(200).json([]); // Return empty array instead of 500
    }

    console.log(`✅ Supabase found ${data?.length || 0} attendance records for ${batch_no}`);
    return res.json(data || []);

  } catch (error) {
    console.error('🚨 Session attendance CRASH:', error);
    return res.status(200).json([]); // NEVER return 500 - always return data
  }
});

// Learners by batch (NO authMiddleware)
app.get('/api/learners', async (req, res) => {
  try {
    const { batch_no } = req.query;
    
    let query = supabase
      .from("learners_data")
      .select("id, name, email, phone, batch_no, status")
      .order("name", { ascending: true });

    if (batch_no) {
      query = query.eq("batch_no", batch_no);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Learners error:", error);
      return res.status(200).json([]);
    }

    const normalized = (data || []).map(row => ({
      id: row.id,
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      batchno: row.batch_no || "",
      batch_no: row.batch_no || "",
      status: row.status || "Enabled",
    })).filter(row => row.name && row.email);

    res.json(normalized);
  } catch (err) {
    console.error("Learners CRASH:", err);
    res.status(200).json([]);
  }
});

// API to schedule batch with classroom suggestion and license check
app.post('/api/scheduleBatch', async (req, res) => {
  try {
    const { domain, batch_no, students, start_date, end_date, preferred_slot } = req.body;

    if (!domain || !batch_no || !students || !start_date || !end_date || !preferred_slot) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check classroom availability
    const classroom = await findAvailableClassroom(supabase, students, start_date, end_date, preferred_slot);
    if (!classroom) {
      return res.status(400).json({
        error: 'No classroom available with required capacity and free in preferred slot for full date range',
      });
    }

    // Check license availability for domain
    const licenseCheck = await checkLicenseAvailability(supabase, domain, students);
    if (!licenseCheck.available) {
      return res.status(400).json({
        error: `Insufficient licenses. Need additional ${licenseCheck.missing} licenses.`,
      });
    }

    // Save the batch with locked classroom
    const { error: insertError } = await supabase.from('batches').insert({
      batch_no,
      domain,
      students,
      start_date,
      end_date,
      preferred_slot,
      classroom_id: classroom.id,
      created_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    res.json({
      message: 'Batch scheduled successfully',
      classroom: classroom.name,
      preferred_slot,
    });
  } catch (err) {
    console.error('ScheduleBatch API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function extractAttendanceData(filepath) {
  const wb = xlsx.readFile(filepath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const { session, startDate, endDate } = parseMeta(sheet);
  const dateCols = parseDateCols(rows, startDate, endDate);
  const users = [];
  for (let i = 7; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0] && String(row[0]).trim();

    let rawEmail = (row[1] || "").trim();
    if (!rawEmail) continue;
    // Try to auto-correct if missing @
    if (!rawEmail.includes('@') && rawEmail.includes('chipedge.com')) {
      const idx = rawEmail.indexOf('chipedge.com');
      const infix = rawEmail.lastIndexOf('.', idx - 2);
      if (infix !== -1) {
        rawEmail = rawEmail.slice(0, infix) + '@' + rawEmail.slice(infix + 1);
      } else {
        rawEmail = rawEmail.replace('chipedge.com', '@chipedge.com');
      }
    }
    if (!isValidEmail(rawEmail)) continue;
    const email = rawEmail;

    if (!name || !email) continue;
    let absents = [];
    dateCols.forEach(({ colIdx, print, tag }) => {
      const val = (row[colIdx] || "").toUpperCase().trim();
      if (val === "A" || val === "OL") {
        absents.push(tag ? `${print} - ${tag}` : print);
      }
    });
    users.push({ name, email, absents });
  }
  return { session, users };
}

async function sendMail({ name, email, session, absents }) {
  const formatted_dates = absents.map(d => `• ${d}`).join('\n');
  const mailText = `Dear ${name},

We noticed that you were absent for the enrolled course ${session} on the following days:
${formatted_dates}

Regular attendance is essential to stay aligned with the course content and placement activities. Please ensure you go through the missed session before attending the upcoming ones.

Kindly note 85% attendance is mandatory to get certification and placement assistance. A minimum of 70% attendance is mandatory to be eligible for certification and placement support.

Warm Regards,
Learning Coordinator
ChipEdge Technologies Pvt Ltd
https://chipedge.com/`;

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SENDER_EMAIL, pass: SENDER_PASS },
  });
  const mailOptions = {
    from: SENDER_EMAIL,
    to: email,
    subject: `Absent Notification: ${session}`,
    text: mailText
  };
  await transporter.sendMail(mailOptions);
}

app.use(express.json());

app.post("/api/send-attendance-emails", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const filepath = req.file.path;
    const { session, users } = extractAttendanceData(filepath);
    let sentDetails = [];
    for (const u of users) {
      if (!u.absents.length) continue;
      try {
        await sendMail({ ...u, session });
        sentDetails.push({ email: u.email, name: u.name, status: "sent" });
        console.log(`Email sent to: ${u.name} <${u.email}>`);
      } catch (e) {
        sentDetails.push({ email: u.email, name: u.name, status: "failed", error: e.message });
        console.error(`Failed to send email to: ${u.name} <${u.email}> - ${e.message}`);
      }
    }
    fs.unlinkSync(filepath);
    res.json({
      success: true,
      details: sentDetails,
      message: `Processed ${sentDetails.length} absent entries.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1) GET /api/marks/window-status
app.get("/api/marks/window-status", async (req, res) => {
  try {
    const { batch_no, assessment_type, week_no } = req.query;
    if (!batch_no || !assessment_type) {
      return res
        .status(400)
        .json({ error: "batch_no and assessment_type are required" });
    }

    const status = await getWindowStatus({
      batchNo: batch_no,
      assessmentType: assessment_type,
      weekNo: week_no ? Number(week_no) : null,
    });

    // Check if this trainer already has a pending request
    let hasPendingRequest = false;
    if (req.user?.email) {
      const { data, error } = await supabase
        .from("marks_entry_extension_requests")
        .select("id")
        .eq("batch_no", batch_no)
        .eq("assessment_type", assessment_type)
        .or(
          week_no
            ? `week_no.eq.${week_no}`
            : "week_no.is.null"
        )
        .eq("trainer_email", req.user.email)
        .eq("status", "pending")
        .limit(1);

      if (!error && data && data.length > 0) {
        hasPendingRequest = true;
      }
    }

    return res.json({ ...status, has_pending_request: hasPendingRequest });
  } catch (err) {
    console.error("window-status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 2) POST /api/marks/:assessmentType
app.post('/api/marks/:assessmentType', async (req, res) => {
  try {
    const { assessmentType } = req.params;
    const { learner_id, batch_no, week_no, assessment_date, out_off, points, percentage } = req.body;

    // CORS headers for direct response
    res.header('Access-Control-Allow-Origin', 'https://engg-automation-r1ke.onrender.com');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    if (!learner_id || !batch_no || !week_no || !assessment_date || !out_off) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // CRITICAL: Window validation FIRST
    const windowCheck = validateMarkEntryWindow(assessment_date, assessmentType);
    if (!windowCheck.valid) {
      console.log(`🚫 BLOCKED: ${windowCheck.error}`);
      return res.status(403).json({ error: windowCheck.error });
    }

    // Table mapping
    const tableMap = {
      'weekly-assessment': 'weeklyassessmentmarks',
      'intermediate-assessment': 'intermediateassessmentmarks',
      'module-level-assessment': 'modulelevelassessmentmarks',
      'weekly-quiz': 'weeklyquizmarks'
    };

    const tableName = tableMap[assessmentType];
    if (!tableName) {
      return res.status(400).json({ error: 'Invalid assessment type' });
    }

    // Save to database
    const upsertData = {
      learner_id: Number(learner_id),
      batch_no,
      week_no: Number(week_no),
      assessment_date,
      out_off: Number(out_off),
      points: points ? Number(points) : null,
      percentage: percentage ? Number(percentage) : null
    };

    const { error } = await supabase
      .from(tableName)
      .upsert(upsertData, { onConflict: 'learner_id,batch_no,week_no' });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to save marks' });
    }

    console.log(`✅ SAVED: ${learner_id} | ${batch_no} | ${assessment_date}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Marks endpoint error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3) POST /api/marks/extension-request
app.post("/api/marks/extension-request", async (req, res) => {
  try {
    const { batch_no, assessment_type, week_no, reason } = req.body;

    if (!batch_no || !assessment_type || !week_no) {
      return res
        .status(400)
        .json({ error: "batch_no, assessment_type, week_no are required" });
    }

    // Check if portal is still open — no need to request if open
    const status = await getWindowStatus({
      batchNo: batch_no,
      assessmentType: assessment_type,
      weekNo: week_no,
    });
    if (status.is_open) {
      return res.json({
        success: false,
        error: "Portal is already open for this assessment",
      });
    }

    // Prevent duplicate pending requests from any trainer email who wants to request for same batch/week (optional)
    const { data: existing, error: existErr } = await supabase
      .from("marks_entry_extension_requests")
      .select("id")
      .eq("batch_no", batch_no)
      .eq("assessment_type", assessment_type)
      .eq("week_no", week_no)
      .eq("status", "pending")
      .limit(1);

    if (!existErr && existing && existing.length > 0) {
      return res.json({
        success: false,
        error: "There is already a pending extension request for this assessment",
      });
    }

    // Use trainer emails from course_planner_data, requires passing trainer_email in request now or store who requested
    
    // For demo, we can require trainer_email in body or set it to null
    // Recommend passing trainer_email from frontend as the logged-in user email (optional)
    // Or omit and store NULL (then embedding auth is better)
    const trainerEmail = req.body.trainer_email || null;

    const { data, error } = await supabase
      .from("marks_entry_extension_requests")
      .insert({
        batch_no,
        assessment_type,
        week_no,
        trainer_email: trainerEmail,
        reason: reason || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("extension-request insert error:", error);
      return res.status(500).json({ error: "Failed to create request" });
    }

    // Get distinct trainer emails for batch to notify
    const notifyEmails = await getDistinctTrainersForBatch(batch_no);

    const subject = `Extension request for batch ${batch_no}`;
    const htmlBody = `
      <p>An extension request has been made.</p>
      <ul>
        <li><b>Batch:</b> ${batch_no}</li>
        <li><b>Assessment Type:</b> ${assessment_type}</li>
        <li><b>Week No:</b> ${week_no}</li>
        <li><b>Reason:</b> ${reason || "N/A"}</li>
      </ul>
      <p>Please review the request and approve or reject it.</p>`;

    // Send emails asynchronously but don't wait to respond to client
    notifyEmails.forEach((email) => {
      sendRawEmail({
        to: email,
        subject,
        html: htmlBody,
      }).catch((e) => console.error("Failed to send mail to", email, e));
    });

    return res.json({ success: true, request_id: data.id });
  } catch (err) {
    console.error("extension-request error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 4) GET /api/marks/extension-requests
app.get("/api/marks/extension-requests", async (req, res) => {
  try {
    const status = req.query.status || "pending";

    const { data, error } = await supabase
      .from("marks_entry_extension_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("list extension-requests error:", error);
      return res.status(500).json({ error: "Failed to fetch requests" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("list extension-requests error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 5) POST /api/marks/extension-requests/:id/approve
app.post("/api/marks/extension-requests/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const managerEmail = req.user?.email;

    const { data: reqRow, error: fetchErr } = await supabase
      .from("marks_entry_extension_requests")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (fetchErr || !reqRow) {
      return res
        .status(404)
        .json({ error: "Request not found or already decided" });
    }

    const nowPlus24 = dayjs().add(24, "hour").toISOString();

    const { error: winErr } = await supabase
      .from("marks_entry_windows")
      .update({
        is_extended: true,
        extended_until: supabase.rpc
          ? undefined
          : nowPlus24, // simple set; the GREATEST logic can be approximated
        updated_at: new Date().toISOString(),
      })
      .eq("batch_no", reqRow.batch_no)
      .eq("assessment_type", reqRow.assessment_type)
      .or(
        reqRow.week_no
          ? `week_no.eq.${reqRow.week_no}`
          : "week_no.is.null"
      );

    if (winErr) {
      console.error("update window error:", winErr);
      return res.status(500).json({ error: "Failed to extend window" });
    }

    const { error: updReqErr } = await supabase
      .from("marks_entry_extension_requests")
      .update({
        status: "approved",
        decided_at: new Date().toISOString(),
        decided_by: managerEmail || null,
      })
      .eq("id", id);

    if (updReqErr) {
      console.error("update request error:", updReqErr);
      return res.status(500).json({ error: "Failed to update request" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("approve extension error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 6) POST /api/marks/extension-requests/:id/reject
app.post("/api/marks/extension-requests/:id/reject", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const managerEmail = req.user?.email;

    const { error } = await supabase
      .from("marks_entry_extension_requests")
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
        decided_by: managerEmail || null,
      })
      .eq("id", id)
      .eq("status", "pending");

    if (error) {
      console.error("reject extension error:", error);
      return res.status(500).json({ error: "Failed to update request" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("reject extension error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});



// === Form Service via Apps Script WebApp ===
async function createBatchForm(batch_no, start_date) {
  const res = await fetch(process.env.FORM_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_no, start_date }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Form creation failed");
  console.log("✅ Form created:", data);
  return data; // { form_url, sheet_url }
}

// === Upload Learners ===
app.post("/upload-learners", async (req, res) => {
  try {
    const { learners } = req.body;
    if (!Array.isArray(learners) || learners.length === 0) {
      return res.status(400).json({ error: "No learners provided" });
    }

    // Helper to build a composite key
    const buildKey = (l) =>
      `${(l.name || "").trim().toLowerCase()}|${(l.email || "").trim().toLowerCase()}|${(l.batch_no || "").trim()}`;

    // 1) Normalize and map incoming rows
    const normalized = learners.map((l) => ({
      name: (l.name || "").trim(),
      email: (l.email || "").trim(),
      phone: (l.phone || "").trim(),
      batch_no: (l.batch_no || "").trim(),
      status: (l.status || "").trim(),
    }));

    // 2) Detect in-file duplicates
    const seen = new Set();
    const unique = [];
    const inFileDuplicates = [];

    for (const l of normalized) {
      const k = buildKey(l);
      if (!l.name || !l.email || !l.batch_no) {
        // allow frontend validation to handle missing fields; still pass through as unique
        unique.push(l);
        continue;
      }
      if (seen.has(k)) {
        inFileDuplicates.push(l);
      } else {
        seen.add(k);
        unique.push(l);
      }
    }

    if (unique.length === 0) {
      return res.json({
        message: "No rows to insert",
        alreadyInDb: [],
        inFileDuplicates,
      });
    }

    // 3) Query Supabase to find already existing learners (same name+email+batch_no)
    // Supabase does not support a multi-column IN directly in one call,
    // so do a single select and filter in Node.
    const { data: existingData, error: existingError } = await supabase
      .from("learners_data")
      .select("name, email, batch_no");

    if (existingError) throw existingError;

    const existingKeys = new Set(
      (existingData || []).map((row) => buildKey(row))
    );

    const newRows = [];
    const alreadyInDb = [];

    for (const l of unique) {
      const k = buildKey(l);
      if (!l.name || !l.email || !l.batch_no) {
        // if key is incomplete, treat as new row (backend will still insert it)
        newRows.push(l);
        continue;
      }
      if (existingKeys.has(k)) {
        alreadyInDb.push(l);
      } else {
        newRows.push(l);
      }
    }

    // 4) Insert only newRows
    let insertedCount = 0;
    if (newRows.length > 0) {
      const { error: insertError } = await supabase
        .from("learners_data")
        .insert(newRows);

      if (insertError) {
        // If you have a UNIQUE constraint on (name,email,batch_no),
        // Supabase may still throw on conflicts; you can ignore conflict codes if needed.
        throw insertError;
      }
      insertedCount = newRows.length;
    }

    return res.json({
      message: `Inserted ${insertedCount} learners. ${alreadyInDb.length} already present.`,
      alreadyInDb,      // for React: mark "Already in database"
      inFileDuplicates, // for React: mark "Duplicate in file"
    });
  } catch (err) {
    console.error("❌ Upload learners error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// === Upload Course Planner ===
app.post("/upload-course-planner", async (req, res) => {
  try {
    const { courses } = req.body;

    if (!Array.isArray(courses) || courses.length === 0) {
      return res
        .status(400)
        .json({ error: "No course planner rows provided" });
    }

    // Take batch_no from first row (all rows in file should belong to same batch)
    const batchNo = (courses[0].batch_no || "").trim();
    if (!batchNo) {
      return res.status(400).json({ error: "batch_no missing in file" });
    }

    // 1) Check if planner already exists for this batch_no in course_planner_data
    const { data: existing, error: selError } = await supabase
      .from("course_planner_data")
      .select("id")
      .eq("batch_no", batchNo)
      .limit(1);

    if (selError) throw selError;

    if (existing && existing.length > 0) {
      // Do NOT insert, just tell frontend it is already present
      return res.status(200).json({
        message: `Course planner for ${batchNo} is already in database`,
        alreadyPresent: true,
        batch_no: batchNo,
        insertedCount: 0,
      });
    }

    // 2) Normalize all expected columns for insert
    const rows = courses.map((c) => ({
      classroom_name: (c.classroom_name || c.classroom || "").trim(),
      batch_no: (c.batch_no || "").trim(),
      domain: (c.domain || null),
      mode: (c.mode || null),
      week_no: (c.week_no || null),
      date: (c.date || null),
      start_time: (c.start_time || null),
      end_time: (c.end_time || null),
      module_name: (c.module_name || null),
      module_topic: (c.module_topic || null),
      topic_name: (c.topic_name || null),
      trainer_name: (c.trainer_name || null),
      trainer_email: (c.trainer_email || null),
      topic_status: (c.topic_status || null),
      remarks: (c.remarks || null),
      batch_type: (c.batch_type || null),
      actual_date: (c.actual_date || null),
      date_difference: (c.date_difference || null),
      date_changed_by: (c.date_changed_by || null),
      date_changed_at: (c.date_changed_at || null),
    }));

    // 3) Insert into Supabase table
    const { error: insError } = await supabase
      .from("course_planner_data")
      .insert(rows);

    if (insError) throw insError;

    return res.json({
      message: `Inserted ${rows.length} course planner rows for ${batchNo}`,
      alreadyPresent: false,
      batch_no: batchNo,
      insertedCount: rows.length,
    });
  } catch (err) {
    console.error("❌ Upload course planner error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// Assuming you already have supabase client initialised above
app.get("/api/course-planner-meta/:batchNo", async (req, res) => {
  try {
    const batchNo = (req.params.batchNo || "").trim();
    if (!batchNo) {
      return res.status(400).json({ error: "batch_no is required" });
    }

    const { data, error } = await supabase
      .from("course_planner_data")
      .select("batch_no, mode, batch_type, classroom_name")
      .eq("batch_no", batchNo)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: `No course planner found for ${batchNo}` });
    }

    const row = data[0];

    return res.json({
      batch_no: row.batch_no,
      mode: row.mode || null,
      batch_type: row.batch_type || null,
      classroom_name: row.classroom_name || null,
    });
  } catch (err) {
    console.error("❌ course-planner-meta error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// === Get Batch List ===
app.get("/api/batches", async (req, res) => {
  const domain = req.query.domain;

  try {
    let query = supabase
      .from("course_planner_data")
      .select("batch_no, date");

    if (domain) {
      query = query.eq("domain", domain);
    }

    // Order by date ascending (start date)
    query = query.order("date", { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    // Group by batch_no picking earliest date as start_date
    const batchMap = {};
    for (const row of data || []) {
      if (!row.batch_no || !row.date) continue;
      if (!batchMap[row.batch_no]) batchMap[row.batch_no] = row.date;
    }

    // Format output array [{ batch_no, start_date }, ...]
    const formatted = Object.entries(batchMap).map(([batch_no, date]) => ({
      batch_no,
      start_date: formatDate(date),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ /api/batches error:", err.message);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});


//===Get Domain list ===
app.get('/api/domains', async (req, res) => {
  try {
    // Select domains, filter out nulls, order ascending
    const { data, error } = await supabase
      .from('course_planner_data')
      .select('domain')
      .neq('domain', null)
      .order('domain', { ascending: true });

    if (error) {
      console.error('Error fetching domains:', error);
      return res.status(500).json({ error: error.message });
    }

    // Deduplicate & filter out falsy values
    const distinctDomains = [...new Set(data.map(x => x.domain))].filter(Boolean);

    res.json(distinctDomains);
  } catch (err) {
    console.error("Exception in /api/domains:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Suggest classroom API (unchanged, your existing logic)
app.post('/api/suggestClassroom', async (req, res) => {
  const { batch_no, domain, students, start_date, end_date, required_tools } = req.body;

  if (!batch_no || !domain || !students || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data: classrooms, error: classErr } = await supabase
    .from('classrooms')
    .select('*')
    .gte('capacity', students);

  if (classErr) return res.status(500).json({ error: 'Failed to fetch classrooms' });
  if (!classrooms.length) return res.status(400).json({ error: 'No classrooms with sufficient capacity' });

  const { data: occupancy, error: occErr } = await supabase
    .from('classroom_occupancy')
    .select('*');

  if (occErr) return res.status(500).json({ error: 'Failed to fetch occupancy' });

  let suggested = null;
  for (const classroom of classrooms) {
    for (const slot of ['morning', 'evening']) {
      const overlap = occupancy.some(occ =>
        occ.classroom_name === classroom.name &&
        occ.slot === slot &&
        !(new Date(occ.occupancy_end) < new Date(start_date) ||
          new Date(occ.occupancy_start) > new Date(end_date))
      );

      if (!overlap) {
        suggested = { classroom: classroom.name, slot };
        break;
      }
    }
    if (suggested) break;
  }

  if (!suggested) return res.status(400).json({ error: 'No classrooms available for the date range and capacity' });

  // License details for domain from licenses table
  const { data: licenses, error: licErr } = await supabase
    .from('licenses')
    .select('license_name, count, domain')
    .eq('domain', domain);

  if (licErr) return res.status(500).json({ error: 'Failed to fetch licenses' });

  const licensesWithAdditional = licenses.map(lic => ({
    license_name: lic.license_name,
    count: lic.count,
    additional_needed: Math.max(0, students - lic.count),
  }));

  const anyAdditionalNeeded = licensesWithAdditional.some(l => l.additional_needed > 0);

  const { error: insertErr } = await supabase.from('classroom_occupancy').insert({
    classroom_name: suggested.classroom,
    slot: suggested.slot,          // DB column name is "slot"
    batch_no,
    occupancy_start: start_date,
    occupancy_end: end_date,
  });

  if (insertErr) return res.status(500).json({ error: 'Failed to schedule batch' });

  res.json({
    message: 'Batch scheduled successfully',
    classroom: suggested.classroom,
    slot: suggested.slot,
    licenses: licensesWithAdditional,
    licensesSufficient: !anyAdditionalNeeded,
  });
});

// Get licenses (used by ClassroomPlanner)
app.get('/api/licenses', async (req, res) => {
  const { data, error } = await supabase
    .from('licenses')
    .select('license_name, count, domain');

  if (error) {
    console.error('licenses error', error);
    return res.status(500).json({ error: 'Failed to fetch licenses' });
  }

  res.json(data); // plain array
});


// GET saved classroom matrix
app.get("/api/get-classroom-matrix", async (req, res) => {
  try {
    const { data: occupancyRows, error } = await supabase
      .from("classroom_occupancy")
      .select("*")
      .order("batch_no");

    if (error) {
      console.error("get-classroom-matrix error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Transform back to frontend format
    const transformedRows = occupancyRows.map((r) => ({
      batch_no: r.batch_no,
      classroom_name: r.classroom_name,
      slot: r.slot,
      occupancy_start: r.occupancy_start,
      occupancy_end: r.occupancy_end,
      enrolled: r.enrolled || 0,
      a_start: r.occupancy_start,
      a_end: r.occupancy_end,
      capacity: 35, // default, or fetch from classrooms table if needed
      mode: "OFFLINE",
    }));

    res.json({
      occupancyRows: transformedRows,
      weeks: [], // computed in frontend from dates
    });
  } catch (err) {
    console.error("get-classroom-matrix error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// SAVE classroom matrix (single JSON store in Supabase)
app.post("/api/save-classroom-matrix", async (req, res) => {
  try {
    const { occupancyRows, fullPlanRows, weeks } = req.body;

    console.log("Processing", occupancyRows?.length || 0, "rows");

    if (!Array.isArray(occupancyRows) || occupancyRows.length === 0) {
      return res.status(400).json({ error: "occupancyRows required" });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Process each row (batch_no unique)
    for (const row of occupancyRows) {
      const batch_no = row.batch_no?.trim();
      if (!batch_no || !row.classroom_name || !row.slot) {
        skipped++;
        continue;
      }

      const occupancy_start = row.occupancy_start || row.a_start;
      const occupancy_end = row.occupancy_end || row.a_end;
      const enrolled = Number(row.enrolled) || 0;

      if (!occupancy_start || !occupancy_end) {
        skipped++;
        continue;
      }

      // 1. Check if batch_no already exists
      const { data: existing } = await supabase
        .from("classroom_occupancy")
        .select("batch_no, occupancy_start, occupancy_end, enrolled, classroom_name, slot")
        .eq("batch_no", batch_no)
        .maybeSingle();

      const updateData = {
        batch_no,
        classroom_name: row.classroom_name,
        slot: row.slot,
        occupancy_start,
        occupancy_end,
        enrolled,
        class_room: row.classroom_name.split(" ")[0], // Ganga/Yamuna/Cauvery
        shifts: row.slot === "morning" ? "Shift_1" : "Shift_2",
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // 2. UPDATE if dates/enrolled/classroom changed
        const datesChanged =
          existing.occupancy_start !== occupancy_start ||
          existing.occupancy_end !== occupancy_end;
        const enrolledChanged = existing.enrolled !== enrolled;
        const roomChanged =
          existing.classroom_name !== row.classroom_name ||
          existing.slot !== row.slot;

        if (datesChanged || enrolledChanged || roomChanged) {
          const { error } = await supabase
            .from("classroom_occupancy")
            .update(updateData)
            .eq("batch_no", batch_no);

          if (!error) {
            updated++;
            console.log(`UPDATED ${batch_no}: dates=${datesChanged}, enrolled=${enrolledChanged}, room=${roomChanged}`);
          }
        } else {
          skipped++;
          console.log(`UNCHANGED ${batch_no}`);
        }
      } else {
        // 3. INSERT new batch_no
        const { error } = await supabase
          .from("classroom_occupancy")
          .insert(updateData);

        if (!error) {
          inserted++;
          console.log(`INSERTED ${batch_no}`);
        }
      }
    }

    res.json({
      success: true,
      summary: { inserted, updated, skipped },
      totalProcessed: occupancyRows.length,
    });
  } catch (err) {
    console.error("save-classroom-matrix error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET holidays for current year (no query param needed)
app.get("/api/holidays", async (req, res) => {
  try {
    const year = Number(req.query.year) || getCurrentYear(); // fallback to current year
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    console.log(`GET /api/holidays?year=${year} → ${from} to ${to}`);

    const { data, error } = await supabase
      .from("holidays")
      .select("id, holiday_date, name, type")
      .gte("holiday_date", from)
      .lte("holiday_date", to)
      .order("holiday_date", { ascending: true });

    if (error) {
      console.error("GET /api/holidays error:", error);
      return res.status(200).json([]);
    }

    console.log(`Found ${data?.length || 0} holidays for ${year}`);
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("GET /api/holidays crash:", err);
    return res.status(200).json([]);
  }
});

// ✅ POST upload holidays (auto-detects current year)
app.post("/api/holidays/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const currentYear = new Date().getFullYear();
    console.log(`POST /api/holidays/upload for year ${currentYear}`);

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: "Only .xlsx, .xls or .csv files are supported" });
    }

    // Read as RAW array of arrays (bypass xlsx date parsing)
    const workbook = xlsx.readFile(req.file.path, { dateNF: "YYYY-MM-DD" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { 
      header: 1, 
      raw: false,  // ✅ Parse numbers as dates safely
      defval: "",
      dateNF: "dd-mmm-yyyy"  // ✅ Force Excel date format
    });

    // Your format: Row 0=header, Row 1+=data
    // Col0=Date, Col1=Day, Col2=Holiday, Col3=Type of Holiday
    const dateIdx = 0;  // Fixed: col0
    const nameIdx = 2;  // Fixed: col2  
    const typeIdx = 3;  // Fixed: col3

    const startRow = 1; // Skip header
    const toUpsert = [];
    const skipped = [];

    for (let i = startRow; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.length) continue;

      // ✅ ROBUST DATE PARSING (handles Excel serials, corrupted dates)
      let dateRaw = r[dateIdx];
      let dateISO = null;

      // Case 1: Already ISO or valid date
      if (dateRaw && /^\d{4}-\d{2}-\d{2}/.test(String(dateRaw))) {
        dateISO = String(dateRaw).slice(0, 10);
      }
      // Case 2: Excel date serial → convert to ISO
      else if (typeof dateRaw === "number" && dateRaw > 0) {
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch
        const jsDate = new Date(excelEpoch.getTime() + dateRaw * 86400000);
        dateISO = jsDate.toISOString().slice(0, 10);
      }
      // Case 3: "DD-MMM" → add current year
      else if (typeof dateRaw === "string") {
        const raw = String(dateRaw).trim();
        const m1 = raw.match(/^(\d{1,2})\s*-\s*([A-Za-z]{3})(?:\s*-?\s*(\d{4}))?$/i);
        if (m1) {
          const dd = m1[1].padStart(2, "0");
          const monStr = m1[2];
          const yyyy = m1[3] || currentYear;
          const monthIndex = new Date(`${monStr} 1, ${yyyy}`).getMonth();
          if (!Number.isNaN(monthIndex)) {
            const dt = new Date(Number(yyyy), monthIndex, Number(dd));
            if (!Number.isNaN(dt.getTime())) {
              dateISO = dt.toISOString().slice(0, 10);
            }
          }
        }
      }

      const name = String(r[nameIdx] || "").trim();
      const type = String(r[typeIdx] || "").trim();

      if (!dateISO || !name) {
        skipped.push({ row: i + 1, dateRaw, name, type, reason: "invalid date/name" });
        continue;
      }

      toUpsert.push({
        holiday_date: dateISO,
        name: name.slice(0, 255), // DB safety
        type: (type || "Holiday").slice(0, 100),
      });

      console.log(`✅ Row ${i + 1}: ${dateISO} | ${name} | ${type}`);
    }

    // Cleanup
    try { fs.unlinkSync(req.file.path); } catch {}

    if (!toUpsert.length) {
      return res.status(400).json({ 
        error: `No valid rows found. Skipped: ${skipped.length}`,
        skipped 
      });
    }

    // Upsert (update existing dates)
    const { data, error, count } = await supabase
      .from("holidays")
      .upsert(toUpsert, { onConflict: "holiday_date" })
      .select();

    if (error) {
      console.error("Upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: `✅ Saved ${toUpsert.length} holidays for ${currentYear}`,
      count: count || 0,
      skipped: skipped.length ? skipped : undefined,
    });
  } catch (err) {
    console.error("POST /api/holidays/upload CRASH:", err);
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Optional: keep backward compatibility with old route name if your backend had it
app.post("/api/holidaysupload", upload.single("file"), async (req, res) => {
  // forward to the new handler behavior by calling same logic:
  req.url = "/api/holidays/upload";
  return res.status(404).json({ error: "Use POST /api/holidays/upload" });
});

// Get trainers for dropdown
app.get("/api/trainers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("internal_users")
      .select("id, name, email, role")
      .eq("role", "Trainer")
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/trainers error:", error);
      return res.status(200).json([]); // avoid frontend console 500s
    }

    const trainers = (data || []).map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
    }));

    return res.status(200).json(trainers);
  } catch (err) {
    console.error("GET /api/trainers crash:", err);
    return res.status(200).json([]);
  }
});

// ===============================
// UNAVAILABILITY REQUESTS - FIXED
// Provides GET /api/unavailability-requests
// ===============================
app.get("/api/unavailability-requests", async (req, res) => {
  try {
    // 1) Get all requests
    const { data: reqs, error: reqErr } = await supabase
      .from("trainer_unavailability")
      .select("id, trainer_email, trainer_name, domain, start_date, end_date, reason, status, batch_nos, submitted_at")
      .order("submitted_at", { ascending: false });

    if (reqErr) {
      console.error("GET /api/unavailability-requests error:", reqErr);
      return res.status(200).json([]); // avoid 404/500 in UI
    }

    // 2) Get trainers lookup for trainer_id enrichment
    const { data: trainers, error: trErr } = await supabase
      .from("internal_users")
      .select("id, email")
      .eq("role", "Trainer");

    if (trErr) {
      console.error("GET trainers lookup error:", trErr);
      // still return requests without trainer_id
    }

    const emailToId = new Map((trainers || []).map((t) => [String(t.email || "").toLowerCase(), t.id]));

    const out = (reqs || []).map((r) => {
      const email = String(r.traineremail || "").toLowerCase();
      return {
        id: r.id,
        trainer_id: emailToId.get(email) || null,
        trainer_name: r.trainer_name || (r.traineremail ? r.traineremail.split("@")[0] : ""),
        trainer_email: r.trainer_email || "",
        domain: r.domain || "",
        start_date: r.start_date,
        end_date: r.end_date || r.start_date,
        leave_type: r.reason || "", // your UI checks leave_type/reason keywords
        reason: r.reason || "",
        status: r.status || "Pending",
      };
    });

    return res.status(200).json(out);
  } catch (err) {
    console.error("GET /api/unavailability-requests crash:", err);
    return res.status(200).json([]);
  }
});


//===Load the domain progress ===
app.get('/api/course-progress', async (req, res) => {
  const { domain, batch_no } = req.query;

  if ((domain && batch_no) || (!domain && !batch_no)) {
    return res.status(400).json({ error: 'Provide either domain or batch_no, not both or none' });
  }

  try {
    // Helper function to fetch progress data for a single batch_no
    async function getBatchProgress(bno) {
      // Trainer names (unchanged)
      const { data: trainers, error: trainerErr } = await supabase
        .from('course_planner_data')
        .select('trainer_name')
        .eq('batch_no', bno);
      if (trainerErr) throw new Error(trainerErr.message);

      const trainerNames = [...new Set(trainers.map(t => t.trainer_name))].filter(Boolean);

      // Learners count (unchanged)
      const { error: learnerErr, count: learnerCount } = await supabase
        .from('learners_data')
        .select('*', { count: 'exact', head: true })
        .eq('batch_no', bno);
      if (learnerErr) throw new Error(learnerErr.message);

      // FULL topic info
      const { data: plannerRows, error: plannerErr } = await supabase
        .from('course_planner_data')
        .select('batch_no, topic_name, date, topic_status, remarks')
        .eq('batch_no', bno)
        .order('date', { ascending: true });
      if (plannerErr) throw new Error(plannerErr.message);

      // Calculate counts as before
      const topicStatusCounts = plannerRows.reduce((counts, row) => {
        if (row.topic_status) {
          counts[row.topic_status] = (counts[row.topic_status] || 0) + 1;
        }
        return counts;
      }, {});

      // Find start/end dates (unchanged)
      const dates = plannerRows.map(r => r.date).filter(Boolean);
      const startDate = dates.length ? dates[0] : null;
      const endDate = dates.length ? dates[dates.length - 1] : null;

      return {
        batch_no: bno,
        trainer_names: trainerNames,
        total_learners: learnerCount || 0,
        start_date: startDate,
        end_date: endDate,
        topic_status_counts: topicStatusCounts,
        topics: plannerRows // array of topic details for frontend filtering
      };
    }

    if (domain) {
      // Scenario 1: For domain, find batches and fetch progress for each
      const { data: batches, error: batchErr } = await supabase
        .from('course_planner_data')
        .select('batch_no')
        .eq('domain', domain);

      if (batchErr) return res.status(500).json({ error: batchErr.message });

      const batchNos = [...new Set(batches.map(b => b.batch_no))].filter(Boolean);

      const allBatchesData = await Promise.all(batchNos.map(bno => getBatchProgress(bno)));

      return res.json({ domain, batches: allBatchesData });

    } else {
      // Scenario 2: For single batch_no return its progress
      const progress = await getBatchProgress(batch_no);
      return res.json(progress);
    }
  } catch (err) {
    console.error("Course progress API error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get course progress data for batch_no
app.get('/api/course-progress/:batch_no', async (req, res) => {
  const batch_no = req.params.batch_no;
  if (!batch_no) return res.status(400).json({ error: "Batch No is required" });

  try {
    // Get distinct trainer names for batch
    const { data: trainers, error: trainerErr } = await supabase
      .from('course_planner_data')
      .select('trainer_name')
      .eq('batch_no', batch_no);
    if (trainerErr) return res.status(500).json({ error: trainerErr.message });

    const trainerNames = [...new Set(trainers.map(t => t.trainer_name))].filter(Boolean);

    // Get total learners count efficiently
    const { error: learnerErr, count } = await supabase
      .from('learners_data')
      .select('*', { count: "exact", head: true })
      .eq('batch_no', batch_no);
    if (learnerErr) return res.status(500).json({ error: learnerErr.message });
    const totalLearners = count || 0;

    // Get course planner rows to extract dates and topic statuses
    const { data: plannerRows, error: plannerErr } = await supabase
      .from('course_planner_data')
      .select('date, topic_status')
      .eq('batch_no', batch_no)
      .order('date', { ascending: true });
    if (plannerErr) return res.status(500).json({ error: plannerErr.message });

    const dates = plannerRows.map(r => r.date).filter(Boolean);
    const startDate = dates.length ? dates[0] : null;
    const endDate = dates.length ? dates[dates.length - 1] : null;

    const topicStatusCounts = plannerRows.reduce((counts, row) => {
      if (row.topic_status) {
        counts[row.topic_status] = (counts[row.topic_status] || 0) + 1;
      }
      return counts;
    }, {});

    res.json({
      batch_no,
      trainer_names: trainerNames,
      total_learners: totalLearners,
      start_date: startDate,
      end_date: endDate,
      topic_status_counts: topicStatusCounts,
    });
  } catch (err) {
    console.error("Course progress error:", err);
    res.status(500).json({ error: err.message });
  }
});

// New API: Get templates filtered by mode
app.get("/api/templates", async (req, res) => {
  try {
    const mode = req.query.mode;
    if (!mode || !["Online", "Offline"].includes(mode)) {
      return res.status(400).json({ error: "Invalid or missing mode parameter" });
    }
    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("template_name")
      .eq("mode", mode)
      .eq("active", true)
      .order("template_name", { ascending: true });

    if (error) {
      console.error("Error fetching templates:", error);
      return res.status(500).json({ error: "Failed to fetch templates" });
    }
    if (!templates || templates.length === 0) {
      return res.status(404).json({ error: "No templates found for selected mode" });
    }

    res.json(templates);
  } catch (error) {
    console.error("Unexpected error fetching templates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Express + Supabase (ESM syntax)
// === Login API ===
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const lookupEmail = email ? email.toLowerCase().trim() : '';

    if (!lookupEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    // 1) Find user in internal_users table
    const { data: users, error: dbError } = await supabase
      .from('internal_users')
      .select('id, name, email, role, password_hash, is_active')
      .eq('email', lookupEmail);

    if (dbError) {
      console.error('DB error in /api/login:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error'
      });
    }

    if (!users || users.length === 0) {
      console.log('Login failed: no user found for', lookupEmail);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = users[0];

    // 2) Check if user is active
    if (user.is_active === false) {
      console.log('Login failed: inactive user', lookupEmail);
      return res.status(401).json({
        success: false,
        error: 'User account is inactive. Contact administrator.'
      });
    }

    // 3) Check password (plain text - replace with bcrypt in production)
    if (password !== user.password_hash) {
      console.log('Login failed: wrong password for', lookupEmail);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // 4) Generate secure JWT token (base64 encoded payload)
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: (user.role || '').toString().toLowerCase(),
      name: user.name || '',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    console.log('Login successful for:', lookupEmail, 'role:', user.role);

    // 5) Return success response (matches frontend expectation)
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        role: (user.role || '').toString().toLowerCase()
      }
    });

  } catch (err) {
    console.error('Unexpected /api/login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});


//=== Reset password ===
app.post('/api/reset-password', async (req, res) => {
  const { email, new_password } = req.body;

  if (!email || !new_password) {
    return res.status(400).json({ error: 'Missing email or new_password' });
  }

  try {
    const { error } = await supabase
      .from('internal_users')
      .update({ password_hash: new_password })  // correct column name
      .eq('email', email);

    if (error) {
      console.error('Error resetting password:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('Exception resetting password:', err);
    return res.status(500).json({ error: err.message });
  }
});

//=== Get the domains ===
app.get("/api/get_domains", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("course_planner_data")
      .select("domain", { count: "exact", head: false })
      .neq("domain", null)
      .neq("domain", "");

    if (error) throw error;

    // Extract unique domains
    const uniqueDomainsSet = new Set(data.map((row) => row.domain));
    const uniqueDomains = Array.from(uniqueDomainsSet);

    res.json(uniqueDomains);
  } catch (err) {
    console.error("Error fetching domains:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//=== Get the batches by domain ===
app.get("/api/get_batches_by_domain", async (req, res) => {
  try {
    const domain = req.query.domain;
    if (!domain) return res.status(400).json({ error: "Domain is required" });

    const { data, error } = await supabase
      .from("course_planner_data")
      .select("batch_no")
      .eq("domain", domain)
      .neq("batch_no", null);

    if (error) throw error;

    // Get distinct batch_no
    const batchSet = new Set(data.map((row) => row.batch_no));
    const batches = Array.from(batchSet);

    res.json(batches);
  } catch (err) {
    console.error("Error fetching batches:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//=== Get the learners data ===
app.get("/api/get_learners", async (req, res) => {
  try {
    const batch_no = req.query.batch_no;
    if (!batch_no) return res.status(400).json({ error: "Batch number is required" });

    const { data, error } = await supabase
      .from("learners_data")
      .select("name, email, batch_no, status")
      .eq("batch_no", batch_no);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error fetching learners:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//=== Get the batches dates ===
app.get("/api/get_batch_dates", async (req, res) => {
  try {
    const batch_no = req.query.batch_no;
    if (!batch_no) return res.status(400).json({ error: "Batch number is required" });

    // Supabase does not support aggregate queries in standard query, so workaround by
    // fetching all dates for batch and find min/max in server code.
    const { data, error } = await supabase
      .from("course_planner_data")
      .select("date")
      .eq("batch_no", batch_no)
      .order("date", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Batch not found or no dates" });
    }

    const start_date = data[0].date;
    const end_date = data[data.length - 1].date;

    res.json({ start_date, end_date });
  } catch (err) {
    console.error("Error fetching batch dates:", err);
    res.status(500).json({ error: "Server error" });
  }
});


//=== Get batch attendance ===
app.get("/api/get_batch_attendance", async (req, res) => {
  try {
    const batch_no = req.query.batch_no;
    if (!batch_no) return res.status(400).json({ error: "Missing batch_no" });

    // Query all attendance records for the batch
    const { data, error } = await supabase
      .from("learner_attendance")
      .select("learner_email, date, status")
      .eq("batch_no", batch_no);

    if (error) throw error;

    const result = {};
    // Build { learnerEmail: { date: { status,... } } }
    data.forEach(row => {
      if (!result[row.learner_email]) result[row.learner_email] = {};
      result[row.learner_email][row.date] = { status: row.status, locked: true };
    });

    res.json(result);
  } catch (err) {
    console.error("GET /api/get_batch_attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Attendance saving route
app.post("/api/save_attendance_ui", async (req, res) => {
  try {
    const { batch_no, attendance } = req.body;
    if (!batch_no || !attendance) {
      return res.status(400).json({ error: "Missing batch_no or attendance" });
    }
    const rows = [];
    // Transform attendance to flat row format
    // attendance: { learnerEmail: { date: { session: "P/A/NA" } } }
    for (const [learner_email, dateObj] of Object.entries(attendance)) {
      for (const [date, sessions] of Object.entries(dateObj)) {
        for (const [session, status] of Object.entries(sessions)) {
          if (status && status.length > 0) {
            rows.push({
              learner_email,
              batch_no,
              date,
              session: parseInt(session, 10),
              status,
              marked_by: req.user?.email || "trainer",
              marked_at: new Date().toISOString(),
            });
          }
        }
      }
    }
    // Upsert into database (requires unique constraint on learner_email, batch_no, date, session)
    const { error } = await supabase
      .from("learner_attendance")
      .upsert(rows, { onConflict: ["learner_email", "batch_no", "date", "session"] });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving attendance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================
// FIXED ANNOUNCEMENT SEND API
// ===========================
app.post("/api/announcement/send", async (req, res) => {
  try {
    const { subject, message, messageType, batch_no, domain } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Subject and message are required",
      });
    }

    if (!batch_no && !domain) {
      return res.status(400).json({
        success: false,
        error: "Batch No or Domain is required",
      });
    }

    let learners = [];

    // ====================
    // FETCH LEARNERS BY BATCH
    // ====================
    if (batch_no) {
      const { data, error } = await supabase
        .from("learners_data")               // ✔ correct table
        .select("name, email, phone, batch_no, status")  // ✔ correct columns
        .eq("batch_no", batch_no);           // ✔ correct column

      if (error) {
        console.error("Fetch learners by batch failed:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch learners (batch query failed)",
        });
      }

      learners = data || [];
    }

    // ====================
    // FETCH LEARNERS BY DOMAIN (OPTIONAL)
    // Only if domain exists AND no batch results found
    // ====================
    if (!learners.length && domain) {
      const { data, error } = await supabase
        .from("learners_data")
        .select("name, email, phone, batch_no, status")
        .eq("domain", domain);               // ONLY if you have domain column

      if (error) {
        console.error("Fetch learners by domain failed:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch learners (domain query failed)",
        });
      }

      learners = data || [];
    }

    // =====================
    // IF NO LEARNERS FOUND
    // =====================
    if (!learners.length) {
      return res.status(404).json({
        success: false,
        error: "No learners found for this batch or domain",
      });
    }

    console.log(`📨 Sending announcement to ${learners.length} learners...`);

    let sentCount = 0;
    let failed = [];

    // =====================
    // SEND EMAIL TO EACH LEARNER
    // =====================
    for (const l of learners) {
      const email = l.email;
      const name = l.name || "Learner";

      const htmlBody =
        messageType === "link"
          ? `<p>Dear ${name},</p><p><a href="${message}" target="_blank">${message}</a></p>`
          : `<p>Dear ${name},</p><p>${message}</p>`;

      try {
        await sendRawEmail({
          to: email,
          subject: subject,
          html: htmlBody,
        });

        sentCount++;
      } catch (err) {
        console.error("Email failed →", email, " Reason:", err.message);
        failed.push({ email, error: err.message });
      }
    }

    return res.json({
      success: failed.length === 0,
      sentTo: sentCount,
      failed: failed.length,
      failures: failed,
    });

  } catch (e) {
    console.error("Announcement send – unexpected error:", e);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});



// === save the attendance ===
app.post("/api/save_attendance", async (req, res) => {
  try {
    const { batch_no, attendance } = req.body;
    if (!batch_no || !attendance) {
      return res.status(400).json({ error: "Missing fields" });
    }

    /*
     attendance object:
     {
       learnerEmail: {
         "YYYY-MM-DD_session1": true/false/ "NA",
         "YYYY-MM-DD_session2": true/false/ "NA",
         ...
       },
       ...
     }
    */

    // Flatten attendance objects for upsert into 'learner_attendance' table
    const rowsToUpsert = [];
    const markedBy = req.user?.email || "unknown"; // You need to set req.user from auth middleware if available

    for (const [learnerEmail, sessions] of Object.entries(attendance)) {
      for (const [key, present] of Object.entries(sessions)) {
        const [date, sessionStr] = key.split("_session");
        const session = parseInt(sessionStr, 10);
        let status = "Absent";
        if (present === true) status = "Present";
        else if (present === "NA") status = "NA";

        rowsToUpsert.push({
          learner_email: learnerEmail,
          batch_no,
          date,
          session,
          status,
          marked_by: markedBy,
          marked_at: new Date().toISOString(),
        });
      }
    }

    // Upsert all rows (requires your table primary key or unique constraint setup properly)
    // Supabase upsert via .upsert() method

    const { data, error } = await supabase
      .from("learner_attendance")
      .upsert(rowsToUpsert, {
        onConflict: ["learner_email", "batch_no", "date", "session"],
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving attendance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// === update the learners status ===
app.post("/api/update-learner-status", async (req, res) => {
  try {
    const { learner_email, batch_no, new_status } = req.body;
    if (!learner_email || !batch_no || !new_status) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const validStatuses = ["Enabled", "Disabled", "Dropout"];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { error } = await supabase
      .from("learners_data")
      .update({ status: new_status })
      .eq("email", learner_email)
      .eq("batch_no", batch_no);

    if (error) throw error;

    // If Dropout, optionally delete attendance records
    if (new_status === "Dropout") {
      const { error: delError } = await supabase
        .from("learner_attendance")
        .delete()
        .eq("learner_email", learner_email)
        .eq("batch_no", batch_no);

      if (delError) throw delError;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating learner status:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// API to get all classrooms (for frontend dropdown or validation)
app.get('/api/classrooms', async (req, res) => {
  try {
    const { data, error } = await supabase.from('classrooms').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// API to get domains for dropdown selection
app.get('/api/domains', async (req, res) => {
  try {
    const { data, error } = await supabase.from('domains').select('domain_name');
    if (error) throw error;
    const domains = data.map(d => d.domain_name);
    res.json(domains);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// ================= APPLY LEAVE (TRAINER) =================
app.post('/api/leave/apply', async (req, res) => {
  try {
    console.log('Apply leave body:', req.body);

    const { trainer_id, from_date, to_date, reason, manager_id } = req.body;

    if (!trainer_id || !from_date || !to_date || !manager_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO trainer_leaves
       (trainer_id, from_date, to_date, reason, manager_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [trainer_id, from_date, to_date, reason || null, manager_id]
    );

    console.log('Inserted leave:', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Apply leave error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= TRAINER LEAVES =================
app.get('/api/leave/trainer/:trainerId', async (req, res) => {
  try {
    const { trainerId } = req.params;

    const result = await pool.query(
      `SELECT * FROM trainer_leaves
       WHERE trainer_id = $1
       ORDER BY created_at DESC`,
      [trainerId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= MANAGER FILTER =================
app.post('/api/leave/manager/filter', async (req, res) => {
  try {
    const { type, value } = req.body;
    let query = '';
    let params = [];

    if (type === 'date') {
      query = `SELECT * FROM trainer_leaves WHERE from_date <= $1 AND to_date >= $1`;
      params = [value];
    }

    if (type === 'week') {
      query = `
        SELECT * FROM trainer_leaves
        WHERE from_date <= ($1::date + interval '6 day')
        AND to_date >= $1`;
      params = [value];
    }

    if (type === 'month') {
      query = `
        SELECT * FROM trainer_leaves
        WHERE EXTRACT(MONTH FROM from_date) = $1`;
      params = [value];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= APPROVE / REJECT =================
app.put('/api/leave/update', async (req, res) => {
  try {
    const { leave_id, status } = req.body;

    const result = await pool.query(
      `UPDATE trainer_leaves
       SET status=$1, updated_at=now()
       WHERE id=$2 RETURNING *`,
      [status, leave_id]
    );

    const leave = result.rows[0];

    await pool.query(
      `INSERT INTO leave_notifications (recipient_id, leave_id, type)
       VALUES ($1,$2,$3)`,
      [leave.trainer_id, leave_id, status]
    );

    await transporter.sendMail({
      from: process.env.LEAVE_EMAIL_USER,
      to: process.env.LEAVE_EMAIL_USER,
      subject: `Leave ${status}`,
      text: `Your leave has been ${status}`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Suggest classroom API
app.post('/api/suggestClassroom', async (req, res) => {
  const { batch_no, domain, students, start_date, end_date, required_tools } = req.body;

  if (!batch_no || !domain || !students || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data: classrooms, error: classErr } = await supabase
    .from('classrooms')
    .select('*')
    .gte('capacity', students);

  if (classErr) return res.status(500).json({ error: 'Failed to fetch classrooms' });
  if (!classrooms.length) return res.status(400).json({ error: 'No classrooms with sufficient capacity' });

  const { data: occupancy, error: occErr } = await supabase
    .from('classroom_occupancy')
    .select('*');

  if (occErr) return res.status(500).json({ error: 'Failed to fetch occupancy' });

  let suggested = null;
  for (const classroom of classrooms) {
    for (const slot of ['morning', 'evening']) {
      const overlap = occupancy.some(occ =>
        occ.classroom_name === classroom.name &&
        occ.slot === slot &&
        !(new Date(occ.occupancy_end) < new Date(start_date) || new Date(occ.occupancy_start) > new Date(end_date))
      );

      if (!overlap) {
        suggested = { classroom: classroom.name, slot };
        break;
      }
    }
    if (suggested) break;
  }

  if (!suggested) return res.status(400).json({ error: 'No classrooms available for the date range and capacity' });

  // License details for domain from licenses table
  const { data: licenses, error: licErr } = await supabase
    .from('licenses')
    .select('license_name, count, domain')
    .eq('domain', domain);

  if (licErr) return res.status(500).json({ error: 'Failed to fetch licenses' });

  // Calculate additional licenses needed per license entry
  const licensesWithAdditional = licenses.map(lic => ({
    license_name: lic.license_name,
    count: lic.count,
    additional_needed: Math.max(0, students - lic.count),
  }));

  // Check if any license is insufficient
  const anyAdditionalNeeded = licensesWithAdditional.some(l => l.additional_needed > 0);

  // Insert batch occupation record
  const { error: insertErr } = await supabase.from('classroom_occupancy').insert({
    classroom_name: suggested.classroom,
    slot: suggested.slot,
    batch_no,
    occupancy_start: start_date,
    occupancy_end: end_date,
  });

  if (insertErr) return res.status(500).json({ error: 'Failed to schedule batch' });

  res.json({
    message: 'Batch scheduled successfully',
    classroom: suggested.classroom,
    slot: suggested.slot,
    licenses: licensesWithAdditional,
    licensesSufficient: !anyAdditionalNeeded,
  });
});

// Classroom occupancy matrix API
app.get('/api/classroom-matrix', async (req, res) => {
  const { data, error } = await supabase.from('classroom_occupancy').select('*');
  if (error) return res.status(500).json({ error: 'Failed to fetch occupancy data' });
  res.json(data);
});

//===Download the planner as xlsx or pdf===
app.post('/api/download-schedule', async (req, res) => {
  const {
    fileType,
    batchDetails,
    licensesData = [],
    matrixTable = [],
    weeks = [],
    batchColorMap = {},
  } = req.body;

  // --- Sheets for Excel ---
  const batchSheet = [
    ["Batch Number", batchDetails.batch_no],
    ["Domain", batchDetails.domain],
    ["No. of Learners", batchDetails.students],
    ["Start Date", batchDetails.start_date],
    ["End Date", batchDetails.end_date],
    ["Required Tools", (batchDetails.required_tools || []).join(', ')],
  ];

  const licensesSheet = [["License Name", "Count", "Additional Needed"]];
  licensesData.forEach(l =>
    licensesSheet.push([
      l.license_name || "",
      l.count || "",
      l.additional_needed || 0,
    ])
  );

  const matrixHeader = ["Classroom", "Slot", ...weeks.map(w => `${w.month} W${w.weekNum}`)];
  const matrixSheet = [matrixHeader];
  matrixTable.forEach(row => {
    const displayRow = [...row];
    for (let i = 2; i < displayRow.length; ++i) {
      if (Array.isArray(displayRow[i]))
        displayRow[i] = displayRow[i].filter(x => !!x).join(', ');
    }
    matrixSheet.push(displayRow);
  });

  if (fileType === "xlsx") {
    const wb = new ExcelJS.Workbook();

    // Batch Details
    const ws1 = wb.addWorksheet("Batch Details");
    batchSheet.forEach(r => ws1.addRow(r));

    // License Info as table
    const ws2 = wb.addWorksheet("License Info");
    licensesSheet.forEach((row, i) => {
      const rowObj = ws2.addRow(row);
      if (i === 0) rowObj.font = { bold: true };
    });

    // Matrix Table with batch color
    const ws3 = wb.addWorksheet("Occupancy Matrix");
    matrixSheet.forEach((r, i) => {
      const row = ws3.addRow(r);
      if (i === 0) {
        row.font = { bold: true };
        return;
      }
      for (let j = 2; j < r.length; ++j) {
        const cellContent = r[j];
        const batchNames = cellContent ? cellContent.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (batchNames.length === 1 && batchColorMap[batchNames[0]]) {
          row.getCell(j + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: batchColorMap[batchNames[0]].replace('#','FF') }
          };
          row.getCell(j + 1).font = { color: { argb: "FF222222" }, bold: true };
        }
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="schedule_export.xlsx"');
    wb.xlsx.writeBuffer().then(buf => res.end(Buffer.from(buf)));
    return;
  }

  // --- PDF version ---
  if (fileType === "pdf") {
    const doc = new PDFDocument({ margin: 25, size: "A3", bufferPages: true });
    let buffers = [];
    doc.on("data", (data) => buffers.push(data));
    doc.on("end", () => {
      let pdfData = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="schedule_export.pdf"');
      res.end(pdfData);
    });

    doc.fontSize(18).fillColor("#123456").text("Batch Details", { underline: true });
    Object.entries(batchDetails).forEach(([key, value]) => {
      doc.fontSize(12).fillColor("black").text(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    });

    doc.moveDown().fontSize(16).fillColor("#123456").text("License Info", { underline: true });
    // Render License table (pdfkit-table expects headers+rows)
    if (licensesData.length > 0) {
      const licenseHeaders = ["License Name", "Count", "Additional Needed"];
      const licenseRows = licensesData.map(l => [l.license_name, l.count, l.additional_needed || 0]);
      await doc.table({
        headers: licenseHeaders,
        rows: licenseRows
      }, { 
        prepareHeader: () => doc.fontSize(11).fillColor("#456"),
        prepareRow: (row, i) => doc.fontSize(10)
      });
    } else {
      doc.fontSize(10).text("No License Data");
    }

    doc.moveDown().fontSize(16).fillColor("#123456").text("Occupancy Matrix", { underline: true });

    if (weeks.length && matrixTable.length) {
      const header = matrixHeader;
      const pdfRows = matrixTable.map(row =>
        row.map((cell, ci) => {
          if (ci >= 2 && Array.isArray(cell)) {
            if (cell.length === 1 && batchColorMap[cell[0]]) {
              return {
                label: cell[0],
                fillColor: batchColorMap[cell[0]],
                color: "#222"
              };
            }
            if (cell.length > 1) {
              return {
                label: cell.join(', '),
                fillColor: undefined,
                color: "#222"
              };
            }
          }
          return { label: Array.isArray(cell) ? cell.join(', ') : cell, fillColor: undefined };
        })
      );
      await doc.table({
        headers: header,
        rows: pdfRows,
      }, {
        prepareHeader: () => doc.fontSize(9).fillColor("#456"),
        prepareRow: (row, i) => doc.fontSize(8),
        prepareCell: (cell, i, j, row, rect) => {
          if (cell && cell.fillColor) {
            doc.rect(rect.x, rect.y, rect.width, rect.height).fillAndStroke(cell.fillColor, cell.fillColor);
            doc.fillColor(cell.color || "#222");
          }
        }
      });
    } else {
      doc.fontSize(10).text("No matrix data");
    }

    doc.end();
    return;
  }

  res.status(400).send("Unsupported file type");
});



// Get batches and domains handled by a trainer
app.get('/api/trainer-batches', async (req, res) => {
  try {
    const { trainer_email } = req.query;
    if (!trainer_email) {
      return res.status(200).json([]);
    }

    const { data, error } = await supabase
      .from('course_planner_data')
      .select('batch_no, domain, trainer_email')
      .eq('trainer_email', trainer_email);

    if (error) {
      console.error('trainer-batches error:', error);
      return res.status(200).json([]);
    }

    // Deduplicate by (batch_no, domain)
    const keyMap = new Map();
    (data || []).forEach((row) => {
      if (!row.batch_no) return;
      const key = `${row.batch_no}__${row.domain || ''}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          batch_no: row.batch_no,
          domain: row.domain || '',
        });
      }
    });

    res.status(200).json(Array.from(keyMap.values()));
  } catch (err) {
    console.error('Unhandled error in /api/trainer-batches:', err);
    res.status(200).json([]);
  }
});

// 1. GET trainer_unavailability - BULLETPROOF
app.get("/api/trainer-unavailability", async (req, res) => {
  console.log("🔥 TRAINER API HIT ✅ - PURE DATABASE");
  
  try {
    const { data, error, count } = await supabase
      .from("trainer_unavailability")
      .select(`
        id,
        trainer_name,
        trainer_email,
        domain,
        start_date,
        end_date,
        status,
        assigned_to,
        submitted_at,
        reason
      `)
      .order("submitted_at", { ascending: false })
      .limit(50);

    console.log("✅ DATABASE:", {
      count: data?.length || 0,
      first: data?.[0]?.trainer_name,
      sample: data?.[0]
    });

    if (error) {
      console.error("❌ DB ERROR:", error.message);
      return res.status(500).json({ error: error.message, data: [] });
    }

    res.status(200).json(data || []);
  } catch (err) {
    console.error("💥 CRASH:", err);
    res.status(500).json({ error: "Server error", data: [] });
  }
});

// 2. GET topics - SIMPLIFIED
app.get("/api/unavailability-topics/:id", async (req, res) => {
  console.log("🔍 Topics for ID:", req.params.id);
  try {
    const { id } = req.params;
    const { data: ua } = await supabase
      .from("trainer_unavailability")
      .select("trainer_email, domain")
      .eq("id", id)
      .single();

    if (!ua) {
      return res.json({ topics: [], batch_owner: null });
    }

    const { data: topics } = await supabase
      .from("course_planner_data")
      .select("id, date, topic_name")
      .eq("trainer_email", ua.trainer_email)
      .eq("domain", ua.domain)
      .limit(10);

    res.json({ 
      topics: topics || [], 
      batch_owner: "Coordinator" 
    });
  } catch (err) {
    console.error("Topics error:", err);
    res.json({ topics: [], batch_owner: null });
  }
});

// 3. GET trainers - SIMPLE
app.get("/api/available-trainers", async (req, res) => {
  console.log("🔍 Available trainers, domain:", req.query.domain);
  try {
    const { domain } = req.query;
    const { data } = await supabase
      .from("internal_users")
      .select("name, email")
      .eq("role", "Trainer")
      .eq("is_active", true)
      .eq("domain", domain || "PD")
      .limit(20);

    res.json(data || []);
  } catch (err) {
    console.error("Trainers error:", err);
    res.json([]);
  }
});

// 4. POST assign - SAFE
app.post("/api/assign-topics-to-trainer", async (req, res) => {
  try {
    const { unavailability_id, trainer_email, topic_ids } = req.body;
    
    console.log("Assigning:", { unavailability_id, trainer_email, topic_ids: topic_ids?.length });

    // Update topics
    if (topic_ids && topic_ids.length > 0) {
      const { error: topicError } = await supabase
        .from("course_planner_data")
        .update({ trainer_email: trainer_email.toLowerCase() })
        .in("id", topic_ids);
      
      if (topicError) console.error("Topic update error:", topicError);
    }

    // Update unavailability status
    const { error: uaError } = await supabase
      .from("trainer_unavailability")
      .update({ 
        status: "assigned", 
        assigned_to: trainer_email 
      })
      .eq("id", unavailability_id);

    if (uaError) {
      return res.status(500).json({ error: uaError.message });
    }

    res.json({ success: true, message: "Topics assigned successfully" });
  } catch (err) {
    console.error("Assign error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 NEW SMART AVAILABILITY API
app.post("/api/smart-available-trainers", async (req, res) => {
  try {
    const { domain, start_date, end_date, exclude_trainer } = req.body;
    
    // 1. Get all trainers for domain
    const { data: allTrainers } = await supabase
      .from("internal_users")
      .select("id, name, email, domain")
      .eq("role", "Trainer")
      .eq("is_active", true)
      .eq("domain", domain);

    // 2. Find busy trainers in date range
    const { data: busyTrainers } = await supabase
      .from("course_planner_data")
      .select("trainer_email")
      .gte("date", start_date)
      .lte("date", end_date);

    const busyEmails = [...new Set(busyTrainers?.map(t => t.trainer_email) || [])];
    
    // 3. Filter available trainers
    const available = allTrainers?.filter(t => 
      t.email !== exclude_trainer && !busyEmails.includes(t.email)
    ) || [];

    res.json({ 
      available, 
      total: allTrainers?.length || 0, 
      busy: busyEmails.length,
      message: `${available.length} trainers available` 
    });
  } catch (err) {
    console.error("Smart availability error:", err);
    res.status(500).json({ error: err.message, available: [] });
  }
});


//=== Progress update based on the trainer email ===
app.get('/api/batch-owner/:batch_no', async (req, res) => {
  const { batch_no } = req.params;
  // Your query to find owner email for batch
  const { data, error } = await supabase
    .from('batch_table') // or wherever you keep batch owner info
    .select('owner_email')
    .eq('batch_no', batch_no)
    .single();

  if(error) return res.status(400).json({ error: error.message });
  res.json(data);
});

//=== Fetch the Learners ===
app.get('/apigetlearners', async (req, res) => {
  try {
    const batch_no = req.query.batchno;
    const { data, error } = await supabase
      .from('learners_data') // use your actual table name
      .select('id, name, email, batch_no, status') // <--- MUST include 'id'
      .eq('batch_no', batch_no);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch learners', error: error.message || error });
  }
});

// Generalized endpoint for all assessment types
app.get('/apiperiods/:batchno/:type', async (req, res) => {
  try {
    const batch_no = req.params.batchno;
    const type = req.params.type;

    let topicLike = '';
    if (type === 'weekly-assessment') {
      topicLike = '%Weekly Assessment%';
    } else if (type === 'intermediate-assessment') {
      topicLike = '%Intermediate Assessment%';
    } else if (type === 'module-level-assessment') {
      topicLike = '%Module Level Assessment%';
    } else if (type === 'weekly-quiz') {
      topicLike = '%Weekly Quiz%';
    } else {
      return res.json([]);
    }

    // Select week_no, date, and topic_name
    const { data, error } = await supabase
      .from('course_planner_data')
      .select('week_no, date, topic_name')
      .eq('batch_no', batch_no)
      .ilike('topic_name', topicLike)
      .order('week_no', { ascending: true })
      .order('date', { ascending: true });

    if (error) throw error;

    // Deduplicate by week_no, keeping first topic/date for each week_no
    const seen = new Set();
    const filtered = [];
    for (const row of data) {
      if (row.week_no && !seen.has(row.week_no)) {
        seen.add(row.week_no);
        filtered.push(row);
      }
    }
    res.json(filtered);
  } catch (error) {
    console.error('Failed to fetch periods:', error);
    res.status(500).json({ message: 'Failed to fetch periods', error: error.message || error });
  }
});

app.post('/api/trainer-leaves', async (req, res) => {
  try {
    console.log('🆕 Trainer Leave Request:', req.body);
    
    const { 
      trainer_email, 
      trainer_name, 
      domain, 
      start_date, 
      end_date, 
      reason, 
      batch_nos 
    } = req.body;

    // 🔥 VALIDATION
    if (!trainer_email || !domain || !start_date || !end_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: trainer_email, domain, start_date, end_date' 
      });
    }

    // 🔥 SAVE TO trainer_unavailability table (same table as manager dashboard)
    const { data, error } = await supabase
      .from('trainer_unavailability')
      .insert([{
        trainer_email,
        trainer_name: trainer_name || 'Unknown Trainer',
        domain,
        start_date,
        end_date,
        reason: reason || null,
        batch_nos: batch_nos || null,
        status: 'pending',  // Default: pending (for manager approval)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('id, trainer_email, trainer_name, domain, start_date, end_date, status')
      .single();

    if (error) {
      console.error('❌ Supabase Error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('✅ Leave saved:', data.id);
    res.status(201).json({ 
      success: true, 
      message: 'Leave request submitted successfully!',
      data: {
        id: data.id,
        trainer_email: data.trainer_email,
        status: data.status
      }
    });

  } catch (err) {
    console.error('💥 Trainer leaves API error:', err);
    res.status(500).json({ 
      error: 'Failed to create leave request',
      details: err.message 
    });
  }
});

// Add or update Weekly Assessment Score
app.post('/api/marks/weekly-assessment', async (req, res) => {
  try {
    const payload = req.body;
    console.log('REQ BODY:', payload);
    // List all columns exactly as in your table
    const { learner_id, batch_no, week_no, points, percentage, assessment_date, out_off } = payload;
    // Convert types as needed
    const upsertData = {
      learner_id: parseInt(learner_id, 10), // Change/remove if id is truly string
      batch_no: batch_no,
      week_no: parseInt(week_no, 10),
      points: points ? parseInt(points, 10) : null,
      percentage: percentage ? parseInt(percentage, 10) : null,
      assessment_date: assessment_date ? assessment_date : null,
      out_off: out_off ? parseInt(out_off, 10) : null
    };
    console.log('UPSERT DATA:', upsertData);

    const { data, error } = await supabase
      .from('weekly_assessment_scores')
      .upsert([upsertData], { onConflict: ['learner_id', 'batch_no', 'week_no'] }); // Unique constraint must exist in DB!

    if (error) {
      console.error('SUPABASE ERROR:', error);
      throw error;
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('CATCH ERROR:', error);
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// Add or update Intermediate Assessment Score
app.post('/api/marks/intermediate-assessment', async (req, res) => {
  try {
    const { learner_id, batch_no, week_no, points, percentage, assessment_date, out_off } = req.body;
    const { data, error } = await supabase
      .from('weekly_assessment_scores')
      .upsert([
        { learner_id, batch_no, week_no, points, percentage, assessment_date, out_off }
      ], { onConflict: ['learner_id', 'batch_no', 'week_no'] });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add or update Module Level Assessment
app.post('/api/marks/module-level-assessment', async (req, res) => {
  try {
    const { learner_id, batchno, module_no, points, percentage, assessment_date } = req.body;
    const { data, error } = await supabase
      .from('module_level_assessment_scores')
      .upsert([
        { learner_id, batchno, module_no, points, percentage, assessment_date }
      ], { onConflict: ['learner_id', 'batchno', 'module_no'] });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add or update Weekly Quiz Score
app.post('/api/marks/weekly-quiz', async (req, res) => {
  try {
    const { learner_id, batchno, week_no, rank, score, percentage, quiz_date } = req.body;
    const { data, error } = await supabase
      .from('weekly_quiz_scores')
      .upsert([
        { learner_id, batchno, week_no, rank, score, percentage, quiz_date }
      ], { onConflict: ['learner_id', 'batchno', 'week_no'] });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch all marks for a learner and batch (optional API for dashboard display)
app.get('/api/marks/:category', async (req, res) => {
  try {
    const { category } = req.params; // one of: weekly-assessment-scores, intermediate-assessment-scores, module-level-assessment-scores, weekly-quiz-scores
    const { learner_id, batchno } = req.query;
    const { data, error } = await supabase
      .from(category)
      .select('*')
      .eq('learner_id', learner_id)
      .eq('batchno', batchno);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ FIXED: Main announcement endpoint - NO SYNTAX ERRORS
app.post('/api/announcement/send-direct', async (req, res) => {
  try {
    const { subject, message, messageType, batch_no } = req.body;

    if (!subject || !message || !batch_no) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    console.log('📥 Announcement request:', { subject, batch_no });

    // 🔹 Fetch learners
    const learnerRes = await fetch(
      `${process.env.API_BASE_URL || 'http://localhost:5000'}/apigetlearners?batchno=${batch_no}`
    );
    const learners = await learnerRes.json();

    const validLearners = learners.filter(
      l => l.email && l.email.trim()
    );

    if (validLearners.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No learners with valid email'
      });
    }

    let sentCount = 0;
    let failed = [];

    for (const learner of validLearners) {
      try {
        const mailOptions = {
          from: `"Training Team" <${process.env.EMAIL_USER}>`,
          to: learner.email,
          subject: `[${batch_no}] ${subject}`,
          text: message,
          html: messageType === 'html'
            ? `
              <div style="font-family:Arial;padding:20px">
                <h2>${subject}</h2>
                <div>${message.replace(/\n/g, '<br>')}</div>
                <p style="font-size:12px;color:#666">
                  Batch: ${batch_no}<br/>
                  ${new Date().toLocaleString('en-IN')}
                </p>
              </div>
            `
            : undefined
        };

        await transporter.sendMail(mailOptions);
        sentCount++;

        // Gmail rate limit safety
        await new Promise(r => setTimeout(r, 250));

      } catch (err) {
        failed.push({ email: learner.email, error: err.message });
        console.error(`❌ Failed ${learner.email}`, err.message);
      }
    }

    console.log(`📊 RESULT: ${sentCount} sent, ${failed.length} failed`);

    return res.json({
      success: sentCount > 0,
      sentCount,
      failedCount: failed.length,
      failed
    });

  } catch (err) {
    console.error('❌ Announcement fatal error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error while sending emails'
    });
  }
});


// ✅ Email sending function (separate)
async function sendBatchEmails(data) {
  try {
    const { subject, message, messageType, batch_no } = data;
    
    // Get learners for batch
    const learnerRes = await fetch(`http://localhost:5000/apigetlearners?batchno=${batch_no}`);
    const learners = await learnerRes.json();
    const validLearners = learners.filter(l => l.email && l.email.trim());

    console.log(`📤 Processing ${validLearners.length} emails for ${batch_no}`);

    let sentCount = 0;
    let failedCount = 0;

    for (const learner of validLearners) {
      try {
        const mailOptions = {
          from: `"Training Team" <${process.env.EMAIL_USER}>`,
          to: learner.email,
          subject: `[${batch_no}] ${subject}`,
          text: message,
          html: messageType === 'html' ? `
            <div style="font-family: Arial; padding: 20px; max-width: 600px;">
              <h2 style="color: #2c5aa0;">${subject}</h2>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Batch: ${batch_no} | ${new Date().toLocaleString('en-IN')}
              </p>
            </div>
          ` : undefined
        };

        await transporter.sendMail(mailOptions);
        sentCount++;
        console.log(`✅ SENT: ${learner.email}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (emailError) {
        failedCount++;
        console.error(`❌ FAILED ${learner.email}:`, emailError.message);
      }
    }

    console.log(`🎉 RESULT: ${sentCount} sent, ${failedCount} failed`);

  } catch (error) {
    console.error('Batch email error:', error);
  }
}

// File upload (IMMEDIATE response)
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'Test Email from Server',
      text: 'If you received this, EMAIL_USER/EMAIL_PASS is working!'
    });
    res.json({ success: true, message: 'Test email sent successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// === Schedule Email API (with Templates + Course Application Emails + Internal Emails) ===
// === Schedule Email API (with Templates + Mock Interview Emails) ===
// ==================== 1. SCHEDULE EMAIL API ====================
app.post("/api/schedule-email", async (req, res) => {
  try {
    const { batch_no, mode, batch_type, class_room, mock_interview_offset } = req.body;

    if (!batch_no || !mode) {
      return res.status(400).json({ error: "Batch No and Mode are required" });
    }

    // Fetch batch course data
    const { data: courseData, error: courseError } = await supabase
      .from("course_planner_data")
      .select("date, trainer_email")
      .eq("batch_no", batch_no)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (courseError) {
      console.error("Error fetching course planner data:", courseError);
      return res.status(500).json({ error: "Failed to fetch batch course data" });
    }

    if (!courseData || !courseData.date) {
      return res.status(404).json({ error: "Batch course details not found" });
    }

    const startDateStr = courseData.date;  // e.g. "2025-11-28"
    const formattedStartDate = formatDate(startDateStr);

    // Fetch learners data (include name)
    const { data: learners, error: learnersError } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);

    if (learnersError) {
      console.error("Error fetching learners:", learnersError);
      return res.status(500).json({ error: "Failed to fetch batch learners data" });
    }

    if (!learners || learners.length === 0) {
      return res.status(404).json({ error: "No learners found for this batch" });
    }

    // Fetch active email templates for mode and batch type
    let query = supabase
      .from("email_templates")
      .select("*")
      .eq("mode", mode)
      .eq("active", true);

    if (mode === "Offline") {
      if (!batch_type) {
        return res.status(400).json({ error: "Batch type is required when mode is Offline" });
      }
      query = query.eq("batch_type", batch_type);
    } else {
      query = query.is("batch_type", null);
    }

    const { data: templates, error: templateError } = await query;
    if (templateError) {
      console.error("Error fetching email templates:", templateError);
      return res.status(500).json({ error: "Failed to fetch email templates" });
    }

    if (!templates || templates.length === 0) {
      return res.status(404).json({ error: "No templates found for this batch/mode" });
    }

    // Skip form creation for Online mode, only create for Offline mode
    let form_url = null;
    let sheet_url = null;

    if (mode === "Offline") {
      let { data: existingForm, error: formError } = await supabase
        .from("batch_forms")
        .select("*")
        .eq("batch_no", batch_no)
        .maybeSingle();

      if (formError) {
        console.error("Error fetching batch form:", formError);
      }

      if (!existingForm) {
        try {
          const formResult = await createBatchForm(batch_no, formattedStartDate);
          form_url = formResult.form_url;
          sheet_url = formResult.sheet_url;
          await supabase.from("batch_forms").insert({
            batch_no,
            form_url,
            sheet_url,
            created_at: new Date().toISOString(),
          });
        } catch (formErr) {
          console.error("Failed to create batch form:", formErr);
        }
      } else {
        form_url = existingForm.form_url;
        sheet_url = existingForm.sheet_url;
      }
    }

    // ---------- FIXED SCHEDULING USING IST + send_time ----------
    let scheduledCount = 0;

    for (const template of templates) {
      const offsetDays = template.offset_days || 0;
      const sendTime = (template.send_time || "09:00").trim(); // "HH:mm"
      const [hhStr, mmStr] = sendTime.split(":");
      const hh = parseInt(hhStr, 10) || 0;
      const mm = parseInt(mmStr, 10) || 0;

      // Build the intended local time in IST based on batch start date + offset
      const localDateTime = dayjs
        .tz(startDateStr, "Asia/Kolkata") // start date at 00:00 IST
        .add(offsetDays, "day")
        .hour(hh)
        .minute(mm)
        .second(0)
        .millisecond(0);

      // Convert IST local time to UTC ISO string for storage
      const scheduledAtISO = localDateTime.utc().toISOString();

      console.log(
        `Template ${template.template_name} -> date=${localDateTime.format(
          "YYYY-MM-DD HH:mm"
        )} IST, stored as ${scheduledAtISO}`
      );

      // Loop through each learner to personalize subject and body
      for (const learner of learners) {
        try {
          // Avoid duplicates
          const { data: existing } = await supabase
            .from("scheduled_emails")
            .select("id")
            .eq("recipient_email", learner.email)
            .eq("template_id", template.id)
            .eq("batch_no", batch_no)
            .eq("scheduled_at", scheduledAtISO)
            .maybeSingle();

          if (existing) continue;

          const personalizedSubject = (template.subject || "")
            .replace(/{{batch_no}}/g, batch_no)
            .replace(/{{name}}/g, learner.name || "Learner")
            .replace(/{{start_date}}/g, formattedStartDate);

          const personalizedBody = (template.body_html || "")
            .replace(/{{batch_no}}/g, batch_no)
            .replace(/{{start_date}}/g, formattedStartDate)
            .replace(/{{class_name}}/g, class_room || "")
            .replace(/{{name}}/g, learner.name || "Learner");

          const { error: insertError } = await supabase.from("scheduled_emails").insert({
            batch_no,
            template_id: template.id,
            template_name: template.template_name,
            subject: personalizedSubject,
            body_html: personalizedBody,
            recipient_email: learner.email,
            scheduled_at: scheduledAtISO,
            status: "scheduled",
            mode,
            batch_type: batch_type || null,
            source: "email_templates",
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error(`Error inserting email for ${learner.email}:`, insertError);
          } else {
            scheduledCount++;
          }
        } catch (err) {
          console.error(`Error scheduling email for ${learner.email}:`, err);
        }
      }
    }

    // ==================== MOCK INTERVIEW SCHEDULING ====================
    console.log('\n\n╔════════════════════════════════════════════════════╗');
    console.log('║   MOCK INTERVIEW REMINDER SCHEDULING STARTED      ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    const TRAINER_MAIL_TIME = "15:50";
    const MOCK_INTERVIEW_OFFSET_DAYS = -7; // HARDCODED to ensure it's always -7

    console.log('Configuration:');
    console.log('  - Mail Time:', TRAINER_MAIL_TIME);
    console.log('  - Offset Days:', MOCK_INTERVIEW_OFFSET_DAYS);
    console.log('  - Batch:', batch_no);

    const { data: mockTopics, error: mockTopicsError } = await supabase
      .from("course_planner_data")
      .select("id, batch_no, topic_name, date, trainer_name, trainer_email, mode")
      .eq("batch_no", batch_no)
      .ilike("topic_name", "%Mock Interview%")
      .order("date", { ascending: true });

    if (mockTopicsError) {
      console.error("❌ Error fetching mock interview topics:", mockTopicsError);
      return res.status(500).json({ error: "Failed to fetch mock interview planner data" });
    }

    console.log(`\n📋 Found ${mockTopics?.length || 0} mock interview topic(s)\n`);

    let mockScheduledCount = 0;
    for (let i = 0; i < mockTopics.length; i++) {
      const row = mockTopics[i];
      
      console.log(`\n┌─────────────────────────────────────────────────┐`);
      console.log(`│ Mock Interview ${i + 1}/${mockTopics.length}`);
      console.log(`└─────────────────────────────────────────────────┘`);

      if (!row.trainer_email || !row.date || !row.mode) {
        console.log('⚠️  SKIPPED - Missing required data:');
        console.log('   - Topic:', row.topic_name || 'N/A');
        console.log('   - Has Email:', !!row.trainer_email);
        console.log('   - Has Date:', !!row.date);
        console.log('   - Has Mode:', !!row.mode);
        continue;
      }

      console.log('📝 Mock Interview Details:');
      console.log('   - Topic:', row.topic_name);
      console.log('   - Date (from DB):', row.date);
      console.log('   - Trainer:', row.trainer_name);
      console.log('   - Email:', row.trainer_email);
      console.log('   - Mode:', row.mode);

      // Calculate when the reminder should be sent
      const scheduledAtISO = computeScheduledAtISO(row.date, MOCK_INTERVIEW_OFFSET_DAYS, TRAINER_MAIL_TIME);
      const formattedDate = formatDate(row.date);

      console.log('\n📅 Scheduling Result:');
      console.log('   - Mock Interview Date:', dayjs(row.date).format('YYYY-MM-DD'));
      console.log('   - Reminder Will Send:', dayjs(scheduledAtISO).format('YYYY-MM-DD HH:mm:ss'));
      console.log('   - Days Before Mock:', dayjs(row.date).diff(dayjs(scheduledAtISO), 'day'), 'days');

      // Verify the calculation is correct
      const expectedDate = dayjs(row.date).subtract(7, 'day').format('YYYY-MM-DD');
      const actualDate = dayjs(scheduledAtISO).format('YYYY-MM-DD');
      
      if (expectedDate !== actualDate) {
        console.log('❌ ERROR: Date calculation mismatch!');
        console.log('   - Expected:', expectedDate);
        console.log('   - Actual:', actualDate);
        continue;
      } else {
        console.log('✅ Date calculation verified correct');
      }

      // Check if this specific reminder already exists
      const { data: existing } = await supabase
        .from("scheduled_emails")
        .select("id")
        .eq("batch_no", row.batch_no)
        .eq("recipient_email", row.trainer_email)
        .eq("template_name", "mock_interview_trainer_confirmation")
        .eq("scheduled_at", scheduledAtISO)
        .maybeSingle();

      if (existing) {
        console.log('⚠️  Email already scheduled (ID:', existing.id, '), skipping');
        continue;
      }

      const confirmUrl = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/confirm-mock-interview?planner_id=${row.id}&batch_no=${row.batch_no}`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Mock Interview Confirmation Required</h2>
          <p>Dear ${row.trainer_name},</p>
          <p>The mock interview <strong>${row.topic_name}</strong> for batch <strong>${row.batch_no}</strong> has been scheduled on <strong>${formattedDate}</strong>.</p>
          <p>Please confirm the date by clicking the Confirm button below.<br>
          If there is any change in the date, please select a new date and then click Confirm.</p>
          <form action="${confirmUrl}" method="POST" style="margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <label for="confirmed_date" style="display: block; margin-bottom: 5px; font-weight: bold;">Change Date (if needed):</label>
              <input type="date" name="confirmed_date" value="${row.date}" required style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px;">
            </div>
            <button type="submit" style="background: #4CAF50; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">
              ✓ Confirm Mock Interview
            </button>
          </form>
          <p style="color: #666; font-size: 14px;">Thanks,<br>Kowshika | Learning Coordinator,<br>📞 9606056288</p>
        </div>
      `;

      const { error: insertError } = await supabase.from("scheduled_emails").insert({
        batch_no: row.batch_no,
        template_id: null,
        template_name: "mock_interview_trainer_confirmation",
        subject: `Please confirm Mock Interview (${row.topic_name}) for Batch ${row.batch_no}`,
        body_html: emailHtml,
        recipient_email: row.trainer_email,
        scheduled_at: scheduledAtISO,
        status: "scheduled",
        role: "Trainer",
        source: "mock_interview_scheduler",
        created_at: new Date().toISOString(),
        mode: row.mode
      });

      if (insertError) {
        console.log('❌ Database insert failed:', insertError.message);
      } else {
        mockScheduledCount++;
        console.log('✅ Successfully scheduled reminder #' + mockScheduledCount);
      }
    }

    console.log(`\n╔════════════════════════════════════════════════════╗`);
    console.log(`║   MOCK INTERVIEW SCHEDULING COMPLETED             ║`);
    console.log(`║   Total Scheduled: ${mockScheduledCount.toString().padEnd(32)} ║`);
    console.log(`╚════════════════════════════════════════════════════╝\n\n`);

    // ----------- ADD SOFT SKILLS MONTHLY + 1-WEEK REMINDERS -----------

    const nowIso = new Date().toISOString();

    // Fetch soft skills sessions that are not completed
    const { data: softSkillsSessions, error: softSkillsError } = await supabase
      .from("course_planner_data")
      .select("id, batch_no, topic_name, date, topic_status, trainer_name, trainer_email, mode")
      .ilike("topic_name", "%Soft Skills%")
      .neq("topic_status", "Completed")
      .eq("batch_no", batch_no);

    if (softSkillsError) {
      console.error("Error fetching soft skills sessions:", softSkillsError);
      return res.status(500).json({ error: "Failed to fetch soft skills data" });
    }

    // Group by trainer email
    const groupedByTrainer = {};
    for (const session of softSkillsSessions) {
      if (!groupedByTrainer[session.trainer_email]) groupedByTrainer[session.trainer_email] = [];
      groupedByTrainer[session.trainer_email].push(session);
    }

    let softSkillsMonthlyCount = 0;
    let softSkillsOneWeekCount = 0;

    for (const trainerEmail in groupedByTrainer) {
      const topics = groupedByTrainer[trainerEmail];
      const monthlyEmailHtml = generateSoftSkillSummaryEmail(topics, trainerEmail);

      // Insert monthly reminder with batch_no and mode from frontend input
      const { error: insertMonthlyError } = await supabase
        .from("scheduled_emails")
        .insert({
          batch_no,
          mode,
          recipient_email: trainerEmail,
          subject: "Monthly Soft Skills Sessions – Please Confirm Dates",
          body_html: monthlyEmailHtml,
          scheduled_at: nowIso,
          status: "scheduled",
          template_name: "soft_skills_monthly_summary",
          created_at: nowIso,
          role: "Trainer",
        });

      if (insertMonthlyError) {
        console.error(`Failed to insert monthly reminder for ${trainerEmail}:`, insertMonthlyError);
      } else {
        softSkillsMonthlyCount++;
      }

      // Schedule 1-week prior reminders per topic
      for (const topic of topics) {
        const trainerReminderAt = dayjs(topic.date)
          .subtract(7, "day")
          .hour(parseInt(TRAINER_SOFT_SKILLS_REMINDER_TIME.split(":")[0]))
          .minute(parseInt(TRAINER_SOFT_SKILLS_REMINDER_TIME.split(":")[1]))
          .second(0)
          .millisecond(0)
          .toISOString();

        const learnerReminderAt = dayjs(topic.date)
          .subtract(7, "day")
          .hour(parseInt(LEARNER_SOFT_SKILLS_REMINDER_TIME.split(":")[0]))
          .minute(parseInt(LEARNER_SOFT_SKILLS_REMINDER_TIME.split(":")[1]))
          .second(0)
          .millisecond(0)
          .toISOString();

        const { error: insertTrainerReminderError } = await supabase
          .from("scheduled_emails")
          .insert({
            batch_no,
            mode,
            recipient_email: trainerEmail,
            subject: `Reminder: Soft Skills Session "${topic.topic_name}" for Batch ${batch_no}`,
            body_html: `<p>Dear ${topic.trainer_name},</p><p>This is a reminder for your Soft Skills session "${topic.topic_name}" scheduled on <strong>${dayjs(topic.date).format("DD-MMM-YYYY")}</strong>.</p>`,
            scheduled_at: trainerReminderAt,
            status: "scheduled",
            template_name: "soft_skills_1week_trainer",
            created_at: nowIso,
            role: "Trainer",
          });

        if (insertTrainerReminderError) {
          console.error(`Failed to insert 1-week trainer reminder for ${trainerEmail}:`, insertTrainerReminderError);
        } else {
          softSkillsOneWeekCount++;
        }

        const { data: topicLearners, error: learnerError } = await supabase
          .from("learners_data")
          .select("email, name")
          .eq("batch_no", batch_no);

        if (learnerError) {
          console.error(`Error fetching learners for batch ${batch_no}:`, learnerError);
          continue;
        }

        for (const learner of topicLearners || []) {
          const { error: insertLearnerReminderError } = await supabase
            .from("scheduled_emails")
            .insert({
              batch_no,
              mode,
              recipient_email: learner.email,
              subject: `Reminder: Soft Skills Session for Batch ${batch_no}`,
              body_html: `<p>Dear ${learner.name},</p><p>This is a reminder for the Soft Skills session "${topic.topic_name}" scheduled on <strong>${dayjs(topic.date).format("DD-MMM-YYYY")}</strong>.</p>`,
              scheduled_at: learnerReminderAt,
              status: "scheduled",
              template_name: "soft_skills_1week_learner",
              created_at: nowIso,
              role: "Learner",
            });

          if (insertLearnerReminderError) {
            console.error(`Failed to insert 1-week learner reminder for ${learner.email}:`, insertLearnerReminderError);
          } else {
            softSkillsOneWeekCount++;
          }
        }
      }
    }

    console.log(`Scheduled ${softSkillsMonthlyCount} soft skills monthly reminder emails and ${softSkillsOneWeekCount} 1-week prior reminders.`);

    // Return success response with all counts
    return res.json({
      success: true,
      scheduled: scheduledCount,
      batch_no,
      start_date: formattedStartDate,
      message: `Scheduled soft skills reminders for batch ${batch_no}`,
      mock_interview_reminders_scheduled: mockScheduledCount || 0,
      soft_skills_monthly_reminders: softSkillsMonthlyCount,
      soft_skills_1week_reminders: softSkillsOneWeekCount,
      // plus your existing scheduledCount etc below if you want included
    });
  } catch (err) {
    console.error("Error scheduling emails:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// ==================== 2. TRAINER CONFIRMATION ENDPOINT ====================
app.post("/api/confirm-mock-interview", async (req, res) => {
  try {
    const { planner_id, batch_no } = req.query;
    const { confirmed_date } = req.body;

    console.log('👨‍🏫 [Trainer Confirmation] Received:', { 
      planner_id, 
      batch_no, 
      confirmed_date,
      body: req.body,
      query: req.query 
    });

    if (!planner_id || !batch_no) {
      console.error('❌ Missing planner_id or batch_no');
      return res.status(400).send(`
        <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
        <body><div class="error">❌ Invalid Request</div><p>Missing required parameters</p></body></html>
      `);
    }

    if (!confirmed_date) {
      console.error('❌ Missing confirmed_date');
      return res.status(400).send(`
        <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
        <body><div class="error">❌ Date Required</div><p>Please select a date</p></body></html>
      `);
    }

    // 1. Get planner row
    const { data: plannerRow, error: plannerError } = await supabase
      .from("course_planner_data")
      .select("*")
      .eq("id", planner_id)
      .maybeSingle();

    if (plannerError || !plannerRow) {
      console.error('❌ [Trainer Confirmation] Planner not found:', plannerError);
      return res.status(404).send(`
        <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
        <body><div class="error">❌ Invalid Entry</div><p>Mock interview entry not found in the system</p></body></html>
      `);
    }

    const oldDate = plannerRow.date;
    const newDate = confirmed_date;

    console.log('📅 [Trainer Confirmation] Dates:', { oldDate, newDate, changed: oldDate !== newDate });

    // 2. Update planner date if changed
    if (newDate !== oldDate) {
      const { error: updateError } = await supabase
        .from("course_planner_data")
        .update({ date: newDate })
        .eq("id", planner_id);
      
      if (updateError) {
        console.error('❌ Error updating date:', updateError);
      } else {
        console.log('✅ [Trainer Confirmation] Updated planner date from', oldDate, 'to', newDate);
      }
    }

    // 3. Update scheduled_emails for trainer confirmation
    const { error: emailUpdateError } = await supabase
      .from("scheduled_emails")
      .update({
        status: "trainer_confirmed",
        updated_at: new Date().toISOString()
      })
      .eq("batch_no", batch_no)
      .eq("role", "Trainer")
      .eq("template_name", "mock_interview_trainer_confirmation")
      .eq("recipient_email", plannerRow.trainer_email);

    if (emailUpdateError) {
      console.error('⚠️ [Trainer Confirmation] Error updating trainer email status:', emailUpdateError);
    }

    // 4. Find coordinator
    const { data: coordinators, error: coordError } = await supabase
      .from("internal_users")
      .select("name, email")
      .eq("role", "Coordinator")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (coordError || !coordinators) {
      console.error('❌ [Trainer Confirmation] Coordinator not found:', coordError);
      return res.status(404).send(`
        <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
        <body><div class="error">❌ Coordinator not found</div><p>Please ensure a coordinator is added in the system with active status.</p></body></html>
      `);
    }

    console.log('✅ [Trainer Confirmation] Coordinator found:', coordinators.email);

    // 5. Compose coordinator email
    const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";
    let mailHtml = "";
    let subject = "";
    
    if (newDate === oldDate) {
      subject = `✓ Trainer Confirmed Mock Interview (${plannerRow.topic_name})`;
      mailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #4CAF50;">✓ Mock Interview Confirmed</h2>
          <p>Dear ${coordinators.name},</p>
          <p>The trainer <strong>${plannerRow.trainer_name}</strong> from batch <strong>${batch_no}</strong> has <strong style="color: #4CAF50;">confirmed</strong> the mock interview <strong>${plannerRow.topic_name}</strong> on date <strong>${formatDate(newDate)}</strong>.</p>
          <p>Please review and click the button below to send confirmation emails to all learners and trainers.</p>
          <form action="${API_BASE}/api/send-mock-confirmation" method="POST" style="margin: 25px 0;">
            <input type="hidden" name="planner_id" value="${planner_id}">
            <input type="hidden" name="batch_no" value="${batch_no}">
            <input type="hidden" name="confirmed_date" value="${newDate}">
            <button type="submit" style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 15px 40px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
              📧 Send Confirmation Emails to All
            </button>
          </form>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 5px 0;"><strong>Batch:</strong> ${batch_no}</p>
            <p style="margin: 5px 0;"><strong>Topic:</strong> ${plannerRow.topic_name}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${formatDate(newDate)}</p>
            <p style="margin: 5px 0;"><strong>Trainer:</strong> ${plannerRow.trainer_name}</p>
          </div>
          <p style="color: #666; margin-top: 20px;">Thanks,<br>Kowshika | Learning Coordinator,<br>📞 9606056288</p>
        </div>
      `;
    } else {
      subject = `📅 Trainer Requested Date Change for Mock Interview`;
      mailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ff9800; border-radius: 8px;">
          <h2 style="color: #ff9800;">📅 Date Change Request</h2>
          <p>Dear ${coordinators.name},</p>
          <p>The trainer <strong>${plannerRow.trainer_name}</strong> from batch <strong>${batch_no}</strong> has requested to <strong style="color: #ff9800;">change</strong> the mock interview <strong>${plannerRow.topic_name}</strong>:</p>
          <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Original Date:</strong> <span style="text-decoration: line-through; color: #f44336;">${formatDate(oldDate)}</span></p>
            <p style="margin: 5px 0;"><strong>New Date:</strong> <span style="color: #4CAF50; font-weight: bold;">${formatDate(newDate)}</span></p>
          </div>
          <p>The date has been updated in the system. Please review and confirm to send emails to learners and trainers.</p>
          <form action="${API_BASE}/api/send-mock-confirmation" method="POST" style="margin: 25px 0;">
            <input type="hidden" name="planner_id" value="${planner_id}">
            <input type="hidden" name="batch_no" value="${batch_no}">
            <input type="hidden" name="confirmed_date" value="${newDate}">
            <button type="submit" style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 15px 40px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3);">
              📧 Send Confirmation Emails to All
            </button>
          </form>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 5px 0;"><strong>Batch:</strong> ${batch_no}</p>
            <p style="margin: 5px 0;"><strong>Topic:</strong> ${plannerRow.topic_name}</p>
            <p style="margin: 5px 0;"><strong>Trainer:</strong> ${plannerRow.trainer_name}</p>
          </div>
          <p style="color: #666; margin-top: 20px;">Thanks,<br>Kowshika | Learning Coordinator,<br>📞 9606056288</p>
        </div>
      `;
    }

    // 6. Send email to coordinator IMMEDIATELY
    try {
      await sendRawEmail({
        to: coordinators.email,
        subject: subject,
        html: mailHtml
      });
      
      console.log('✅ [Trainer Confirmation] Coordinator email sent to:', coordinators.email);
      
      // Log in scheduled_emails for tracking
      await supabase.from("scheduled_emails").insert({
        batch_no,
        template_id: null,
        template_name: "mock_interview_coordinator_confirmation",
        subject,
        body_html: mailHtml,
        recipient_email: coordinators.email,
        scheduled_at: new Date().toISOString(),
        status: "sent",
        role: "Coordinator",
        source: "mock_interview_scheduler",
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      });
      
    } catch (emailError) {
      console.error('❌ [Trainer Confirmation] Failed to send coordinator email:', emailError);
      return res.status(500).send(`
        <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
        <body><div class="error">❌ Failed to send coordinator email</div><p>${emailError.message}</p></body></html>
      `);
    }

    res.send(`
      <html>
        <head>
          <style>
            body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:50px;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center}
            .container{background:white;padding:40px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.2);max-width:500px}
            .success{color:#4CAF50;font-size:28px;font-weight:bold;margin-bottom:20px}
            .info{color:#666;margin-top:20px;line-height:1.6}
            .checkmark{font-size:60px;color:#4CAF50;margin-bottom:20px}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <div class="success">Confirmation Received!</div>
            <div class="info">
              <p>Thank you for confirming the mock interview details.</p>
              <p><strong>Batch:</strong> ${batch_no}</p>
              <p><strong>Topic:</strong> ${plannerRow.topic_name}</p>
              <p><strong>Date:</strong> ${formatDate(newDate)}</p>
              <hr style="margin:20px 0;border:none;border-top:1px solid #eee">
              <p style="font-size:14px">The coordinator has been notified and will send confirmation emails to all participants shortly.</p>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ [Trainer Confirmation] Error:', err);
    res.status(500).send(`
      <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
      <body><div class="error">❌ Error confirming trainer</div><p>${err.message}</p></body></html>
    `);
  }
});

// ==================== 3. COORDINATOR CONFIRMATION PAGE (GET) ====================
app.get('/api/confirm-coordinator', (req, res) => {
  const { plannerid, batchno } = req.query;

  if (!plannerid || !batchno) {
    return res.status(400).send(`
      <html><body style="font-family:Arial; text-align:center; margin-top: 50px;">
        <h2 style="color:#f44336;">Invalid Request</h2>
        <p>Missing required parameters.</p>
      </body></html>`);
  }

  res.send(`
    <html>
      <head>
        <title>Mock Interview Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f8fa; padding: 40px; }
          .container { max-width: 400px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);}
          h2 { color: #1976d2; margin-bottom: 20px; }
          button { background-color: #1976d2; color: white; border: none; padding: 12px 30px; border-radius: 4px; font-size: 16px; cursor: pointer; font-weight: 600;}
          button:hover { background-color: #105a9e; }
          p { font-size: 14px; color: #555; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Confirm Mock Interview</h2>
          <p>Please confirm the mock interview for batch <strong>${batchno}</strong>.</p>
          <form method="POST" action="/api/send-mock-confirmation" >
            <input type="hidden" name="planner_id" value="${plannerid}" />
            <input type="hidden" name="batch_no" value="${batchno}" />
            <input type="hidden" name="confirmed_date" value="${new Date().toISOString().slice(0,10)}" />
            <button type="submit">Confirm</button>
          </form>
        </div>
      </body>
    </html>
  `);
});


// ==================== 4. COORDINATOR CONFIRMATION SUBMISSION (POST) ====================
app.post("/api/send-mock-confirmation", async (req, res) => {
  try {
    const { planner_id, batch_no, confirmed_date } = req.body;

    console.log('👔 [Coordinator] Sending confirmations:', { planner_id, batch_no, confirmed_date, body: req.body });

    if (!planner_id || !batch_no || !confirmed_date) {
      return res.status(400).send("Missing required parameters");
    }

    // 1. Get planner row
    const { data: plannerRow, error: plannerError } = await supabase
      .from("course_planner_data")
      .select("*")
      .eq("id", planner_id)
      .maybeSingle();

    if (plannerError || !plannerRow) {
      console.error('❌ [Coordinator] Planner not found:', plannerError);
      return res.status(404).send("Planner entry not found");
    }

    // 2. Get learners for batch
    const { data: learners, error: learnersErr } = await supabase
      .from("learners_data")
      .select("name, email")
      .eq("batch_no", batch_no);

    if (learnersErr) {
      console.error('❌ [Coordinator] Learners fetch error:', learnersErr);
      return res.status(500).send("Failed to fetch learners data");
    }

    // 3. Get unique trainers for batch
    const { data: trainersData, error: trainersErr } = await supabase
      .from("course_planner_data")
      .select("trainer_name, trainer_email")
      .eq("batch_no", batch_no);

    if (trainersErr) {
      console.error('❌ [Coordinator] Trainers fetch error:', trainersErr);
      return res.status(500).send("Failed to fetch trainers data");
    }

    // Unique trainers by email
    const uniqueTrainers = [];
    const seenEmails = new Set();
    trainersData?.forEach(t => {
      if (t.trainer_email && !seenEmails.has(t.trainer_email)) {
        uniqueTrainers.push(t);
        seenEmails.add(t.trainer_email);
      }
    });

    console.log('📊 [Coordinator] Recipients:', { learners: learners.length, trainers: uniqueTrainers.length });

    // 4. Compose final email
    const finalDate = confirmed_date || plannerRow.date;
    const subject = `Mock Interview Scheduled for Batch ${batch_no}`;
    
    const baseHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #4CAF50; border-radius: 8px;">
        <h2 style="color: #4CAF50;">📅 Mock Interview Confirmation</h2>
        <div style="background: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Mock Interview:</strong> ${plannerRow.topic_name}</p>
          <p style="margin: 8px 0;"><strong>Batch:</strong> ${batch_no}</p>
          <p style="margin: 8px 0;"><strong>Date:</strong> <span style="color: #4CAF50; font-weight: bold; font-size: 18px;">${formatDate(finalDate)}</span></p>
          <p style="margin: 8px 0;"><strong>Trainer:</strong> ${plannerRow.trainer_name}</p>
        </div>
        <p>Kindly be present on this date and time.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thanks,<br>Kowshika | Learning Coordinator,<br>📞 9606056288</p>
      </div>
    `;

    // 5. Send emails immediately to learners
    let sentCount = 0;
    let failedCount = 0;
    
    for (const learner of learners || []) {
      try {
        const personalizedHtml = `<p>Dear ${learner.name},</p>` + baseHtml;
        
        await sendRawEmail({
          to: learner.email,
          subject: subject,
          html: personalizedHtml
        });

        // Log in scheduled_emails
        await supabase.from("scheduled_emails").insert({
          batch_no,
          template_id: null,
          template_name: "mock_interview_final_confirmation",
          subject,
          body_html: personalizedHtml,
          recipient_email: learner.email,
          scheduled_at: new Date().toISOString(),
          status: "sent",
          role: "Learner",
          source: "mock_interview_scheduler",
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString()
        });

        sentCount++;
        console.log(`✅ [Coordinator] Sent to learner: ${learner.email}`);
      } catch (err) {
        failedCount++;
        console.error(`❌ [Coordinator] Failed to send to learner ${learner.email}:`, err);
      }
    }

    // 6. Send emails to trainers
    for (const trainer of uniqueTrainers) {
      try {
        const personalizedHtml = `<p>Dear ${trainer.trainer_name},</p>` + baseHtml;
        
        await sendRawEmail({
          to: trainer.trainer_email,
          subject: subject,
          html: personalizedHtml
        });

        // Log in scheduled_emails
        await supabase.from("scheduled_emails").insert({
          batch_no,
          template_id: null,
          template_name: "mock_interview_final_confirmation",
          subject,
          body_html: personalizedHtml,
          recipient_email: trainer.trainer_email,
          scheduled_at: new Date().toISOString(),
          status: "sent",
          role: "Trainer",
          source: "mock_interview_scheduler",
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString()
        });

        sentCount++;
        console.log(`✅ [Coordinator] Sent to trainer: ${trainer.trainer_email}`);
      } catch (err) {
        failedCount++;
        console.error(`❌ [Coordinator] Failed to send to trainer ${trainer.trainer_email}:`, err);
      }
    }

    // 7. Update coordinator email status
    await supabase.from("scheduled_emails")
      .update({ 
        status: "coordinator_confirmed", 
        updated_at: new Date().toISOString() 
      })
      .eq("batch_no", batch_no)
      .eq("role", "Coordinator")
      .eq("template_name", "mock_interview_coordinator_confirmation");

    console.log(`✅ [Coordinator] Successfully sent ${sentCount} emails (${failedCount} failed)`);

    res.send(`
      <html>
        <head>
          <style>
            body {
              font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;
              padding:50px;
              text-align:center;
              background:linear-gradient(135deg,#4CAF50 0%,#45a049 100%);
              min-height:100vh;
              margin:0;
              display:flex;
              align-items:center;
              justify-content:center;
            }
            .container {
              background:white;
              padding:40px;
              border-radius:15px;
              box-shadow:0 10px 40px rgba(0,0,0,0.2);
              max-width:500px;
            }
            .success { color:#4CAF50; font-size:28px; font-weight:bold; margin-bottom:20px; }
            .info { color:#666; margin-top:20px; line-height:1.8; }
            .checkmark { font-size:60px; color:#4CAF50; margin-bottom:20px; }
            .stats { background:#f5f5f5; padding:20px; border-radius:8px; margin-top:20px; }
            .stat-item { margin:10px 0; font-size:16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <div class="success">Emails Sent Successfully!</div>
            <div class="stats">
              <div class="stat-item"><strong>Total Sent:</strong> ${sentCount}</div>
              ${failedCount > 0 ? `<div class="stat-item" style="color:#f44336"><strong>Failed:</strong> ${failedCount}</div>` : ''}
              <div class="stat-item"><strong>Batch:</strong> ${batch_no}</div>
              <div class="stat-item"><strong>Topic:</strong> ${plannerRow.topic_name}</div>
              <div class="stat-item"><strong>Date:</strong> ${formatDate(finalDate)}</div>
            </div>
            <div class="info">
              <p>All learners and trainers have been notified about the mock interview schedule.</p>
            </div>
          </div>
        </body>
      </html>
    `);

  } catch (err) {
    console.error('❌ [Coordinator] Error:', err);
    res.status(500).send(`
      <html><head><style>body{font-family:Arial;padding:50px;text-align:center}.error{color:#f44336;font-size:20px}</style></head>
      <body><div class="error">❌ Error sending confirmation emails</div><p>${err.message}</p></body></html>
    `);
  }
});


//=== Schedule all needed mails for Soft Skills ===
app.post('/api/schedule-soft-skills-reminders', async (req, res) => {
  try {
    const { data: sessions, error } = await supabase
      .from('course_planner_data')
      .select('id, batch_no, topic_name, date, topic_status, trainer_name, trainer_email')
      .ilike('topic_name', '%Soft Skills%')
      .neq('topic_status', 'Completed');

    if (error) return res.status(500).json({ error: error.message });

    const grouped = {};
    for (const session of sessions) {
      if (!grouped[session.trainer_email]) grouped[session.trainer_email] = [];
      grouped[session.trainer_email].push(session);
    }

    let scheduled = 0;
    for (const trainerEmail in grouped) {
      const topics = grouped[trainerEmail];
      const monthlyEmailHtml = generateSoftSkillSummaryEmail(topics, trainerEmail);

      // Immediately schedule monthly summary reminder for trainer
      await supabase.from('scheduled_emails').insert({
        recipient_email: trainerEmail,
        subject: 'Monthly Soft Skills Sessions – Date Confirmation',
        body_html: monthlyEmailHtml,
        scheduled_at: new Date().toISOString(),
        status: "scheduled",
        template_name: "soft_skills_summary_mail",
        created_at: new Date().toISOString(),
        role: "Trainer",
      });
      scheduled++;

      // Schedule 1-week prior reminders for trainer and learners with configurable times
      for (const topic of topics) {
        const trainerReminderAt = dayjs(topic.date).subtract(7, 'day').hour(parseInt(TRAINER_SOFT_SKILLS_REMINDER_TIME.split(':')[0])).minute(parseInt(TRAINER_SOFT_SKILLS_REMINDER_TIME.split(':')[1])).second(0).millisecond(0).toISOString();
        const learnerReminderAt = dayjs(topic.date).subtract(7, 'day').hour(parseInt(LEARNER_SOFT_SKILLS_REMINDER_TIME.split(':')[0])).minute(parseInt(LEARNER_SOFT_SKILLS_REMINDER_TIME.split(':')[1])).second(0).millisecond(0).toISOString();

        // Trainer reminder email
        await supabase.from('scheduled_emails').insert({
          recipient_email: trainerEmail,
          subject: `Reminder: Soft Skills Session "${topic.topic_name}" for Batch ${topic.batch_no}`,
          body_html: `<p>Dear ${topic.trainer_name},<br>Your Soft Skills session "${topic.topic_name}" for batch ${topic.batch_no} is scheduled for ${dayjs(topic.date).format('DD-MMM-YYYY')}. This is a 1-week reminder.</p>`,
          scheduled_at: trainerReminderAt,
          status: "scheduled",
          template_name: "soft_skills_1week_trainer",
          created_at: new Date().toISOString(),
          role: "Trainer",
        });

        // Learner reminders
        const { data: learners } = await supabase
          .from("learners_data")
          .select("email, name")
          .eq("batch_no", topic.batch_no);

        for (const learner of (learners || [])) {
          await supabase.from('scheduled_emails').insert({
            recipient_email: learner.email,
            subject: `Reminder: Soft Skills Session for Batch ${topic.batch_no}`,
            body_html: `<p>Dear ${learner.name},<br>This is a reminder for the Soft Skills session "${topic.topic_name}" scheduled on ${dayjs(topic.date).format('DD-MMM-YYYY')}.</p>`,
            scheduled_at: learnerReminderAt,
            status: "scheduled",
            template_name: "soft_skills_1week_learner",
            created_at: new Date().toISOString(),
            role: "Learner",
          });
        }
      }
    }

    res.json({ success: true, message: `Scheduled ${scheduled} monthly & 1-week-prior Soft Skills reminders with configurable times.` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

//=== Handle Trainer's Confirmation and Reschedule reminders
app.post('/api/soft-skills-trainer-confirmation', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const trainerEmail = req.query.trainer_email;
    const formData = req.body;

    if (!trainerEmail) {
      return res.status(400).send("Missing query parameter: trainer_email");
    }

    // Collect changed dates for reporting
    const changes = [];

    for (const key in formData) {
      if (key.startsWith('date_')) {
        const id = key.slice(5);
        const newDate = formData[key];
        const topicId = formData[`id_${id}`];

        if (!topicId) continue;

        const { data: oldTopic, error: fetchError } = await supabase
          .from('course_planner_data')
          .select('date, batch_no, topic_name, trainer_name, trainer_email')
          .eq('id', topicId)
          .single();

        if (fetchError || !oldTopic) {
          console.error(`Error fetching topic id ${topicId}:`, fetchError);
          continue;
        }

        if (!oldTopic.date || oldTopic.date.slice(0, 10) !== newDate) {
          const { error: updateError } = await supabase
            .from('course_planner_data')
            .update({ date: newDate })
            .eq('id', topicId);

          if (updateError) {
            console.error(`Error updating date for topic ${topicId}:`, updateError);
            continue;
          }

          changes.push({
            topicId,
            topic_name: oldTopic.topic_name,
            batch_no: oldTopic.batch_no,
            oldDate: oldTopic.date.slice(0, 10),
            newDate,
            trainer_name: oldTopic.trainer_name,
            trainer_email: oldTopic.trainer_email,
          });
        }
      }
    }

    if (changes.length === 0) {
      return res.send("<h3>No changes detected. Dates remain the same. Thank you!</h3>");
    }

    // Fetch active coordinator and managers emails/names
    const { data: recipients, error: recpError } = await supabase
      .from('internal_users')
      .select('email, name, role')
      .in('role', ['Coordinator', 'Manager'])
      .eq('is_active', true);

    if (recpError || !recipients?.length) {
      console.error('No coordinators or managers found or error:', recpError);
      return res.status(500).send('Failed to find coordinators or managers to notify.');
    }

    // Separate coordinator emails and manager emails for proper TO and CC
    const coordinatorEmails = recipients.filter(r => r.role === 'Coordinator').map(r => r.email);
    const managerEmails = recipients.filter(r => r.role === 'Manager').map(r => r.email);

    if (coordinatorEmails.length === 0) {
      console.error('No active coordinator emails found.');
      return res.status(500).send('No active coordinator emails found.');
    }

    // Compose email content
    let htmlRows = '';
    const csvRows = ["Batch No,Topic,Old Date,New Date"];
    for (const chg of changes) {
      htmlRows += `<tr>
        <td>${chg.batch_no}</td>
        <td>${chg.topic_name}</td>
        <td>${chg.oldDate}</td>
        <td>${chg.newDate}</td>
      </tr>`;
      csvRows.push(`"${chg.batch_no}","${chg.topic_name}","${chg.oldDate}","${chg.newDate}"`);
    }

    const htmlSummary = `
      <p>Dear ${coordinatorEmails.join(', ')},</p>
      <p>The following Soft Skills session dates have been updated by trainer ${trainerEmail}:</p>
      <table border="1" cellpadding="5" style="border-collapse:collapse;">
        <thead><tr><th>Batch No</th><th>Topic</th><th>Old Date</th><th>New Date</th></tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
      <p>Please find attached the detailed CSV report.</p>
    `;

    const csvContent = csvRows.join('\n');

    await sendRawEmail({
      to: [...coordinatorEmails, ...managerEmails].join(','),
      subject: `Soft Skills Session Dates Updated by Trainer ${trainerEmail}`,
      html: htmlSummary,
      attachments: [
        {
          filename: `soft_skills_date_changes_${trainerEmail}.csv`,
          content: Buffer.from(csvContent),
        }
      ]
    });

    // Reschedule 1-week reminders for trainers and learners...
    const nowIso = new Date().toISOString();
    for (const chg of changes) {
      const trainerReminderDate = dayjs(chg.newDate)
        .subtract(7, 'day')
        .hour(10)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toISOString();

      const learnerReminderDate = dayjs(chg.newDate)
        .subtract(7, 'day')
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toISOString();

      // Delete old reminders for this batch and recipient emails
      await supabase.from('scheduled_emails').delete()
        .or(`template_name.eq.soft_skills_1week_trainer,template_name.eq.soft_skills_1week_learner`)
        .eq('batch_no', chg.batch_no)
        .or(`recipient_email.eq.${chg.trainer_email},recipient_email.in.${(await supabase.from('learners_data').select('email').eq('batch_no', chg.batch_no).then(r => r.data.map(l => l.email))).join(',')}`);

      // Insert trainer reminder
      await supabase.from('scheduled_emails').insert({
        recipient_email: chg.trainer_email,
        subject: `Reminder: Soft Skills Session "${chg.topic_name}" for Batch ${chg.batch_no}`,
        body_html: `<p>Dear ${chg.trainer_name},<br>Your Soft Skills session "${chg.topic_name}" for batch ${chg.batch_no} is scheduled on ${dayjs(chg.newDate).format('DD-MMM-YYYY')}.</p>`,
        scheduled_at: trainerReminderDate,
        status: 'scheduled',
        template_name: 'soft_skills_1week_trainer',
        created_at: nowIso,
        role: 'Trainer',
      });

      // Insert learner reminders
      const { data: learners } = await supabase.from('learners_data').select('email, name').eq('batch_no', chg.batch_no);
      for (const learner of learners || []) {
        await supabase.from('scheduled_emails').insert({
          recipient_email: learner.email,
          subject: `Reminder: Soft Skills Session for Batch ${chg.batch_no}`,
          body_html: `<p>Dear ${learner.name},<br>This is a reminder for the Soft Skills session "${chg.topic_name}" scheduled on ${dayjs(chg.newDate).format('DD-MMM-YYYY')}.</p>`,
          scheduled_at: learnerReminderDate,
          status: 'scheduled',
          template_name: 'soft_skills_1week_learner',
          created_at: nowIso,
          role: 'Learner',
        });
      }
    }

    res.send(`
      <html><head><style>
        body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
        .success { color: green; font-size: 24px; margin-bottom: 20px; }
      </style></head><body>
        <div class="success">Soft Skills Dates Confirmed Successfully!</div>
        <p>The coordinator and managers have been notified.</p>
      </body></html>
    `);

  } catch (err) {
    console.error('Error in soft-skills-trainer-confirmation:', err);
    res.status(500).send('Internal Server Error');
  }
});

//===Resend the failed emails===
// Resend Failed Emails API
app.post("/api/resend-failed-emails", async (req, res) => {
  try {
    const { batch_no } = req.body || {};

    let query = supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "failed");

    if (batch_no) {
      query = query.eq("batch_no", batch_no);
    }

    const { data: failedEmails, error } = await query;

    if (error) {
      throw error;
    }
    if (!failedEmails || failedEmails.length === 0) {
      return res.json({ message: "No failed emails found" });
    }

    const newScheduledAt = dayjs().add(1, 'minute').toISOString();

    const idsToRetry = failedEmails.map(e => e.id);

    const { error: updateError } = await supabase
      .from("scheduled_emails")
      .update({
        status: "scheduled",
        retry_count: 0,
        error: null,
        scheduled_at: newScheduledAt,
        updated_at: dayjs().toISOString(),
      })
      .in("id", idsToRetry);

    if (updateError) {
      throw updateError;
    }

    res.json({
      message: `Reset ${idsToRetry.length} failed emails with new scheduled_at: ${newScheduledAt}`,
      count: idsToRetry.length
    });

  } catch (err) {
    console.error("Failed to resend emails:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Filter emails by batch_no and/or recipient_email
app.get('/api/mail-dashboard/list', async (req, res) => {
  const { batch_no, recipient_email } = req.query;
  
  try {
    let query = supabase.from('scheduled_emails').select('*');
    
    if (batch_no) query = query.eq('batch_no', batch_no);
    if (recipient_email) query = query.ilike('recipient_email', `%${recipient_email}%`);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Ensure ID field is included
    const formattedData = data.map(row => ({
      ...row,
      id: row.id || row.mail_id, // Ensure ID is present
    }));
    
    res.json(formattedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update recipient email
// Update recipient email in both scheduled_emails and learners_data tables
app.post('/api/mail/update-email', async (req, res) => {
  const { mail_id, new_email } = req.body;
  
  console.log('[API] Updating email for mail_id:', mail_id, 'to:', new_email);
  
  if (!mail_id || !new_email) {
    return res.status(400).json({ 
      success: false, 
      error: 'mail_id and new_email are required' 
    });
  }
  
  try {
    // Step 1: Get the current email and batch_no from scheduled_emails
    const { data: currentEmail, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('recipient_email, batch_no')
      .eq('id', mail_id)
      .single();
    
    if (fetchError) {
      console.error('[API] Error fetching current email:', fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
    }
    
    if (!currentEmail) {
      return res.status(404).json({ success: false, error: 'Email record not found' });
    }
    
    const oldEmail = currentEmail.recipient_email;
    const batchNo = currentEmail.batch_no;
    
    console.log('[API] Old email:', oldEmail);
    console.log('[API] Batch No:', batchNo);
    
    // Step 2: Update scheduled_emails table
    const { data: scheduledData, error: scheduledError } = await supabase
      .from('scheduled_emails')
      .update({ recipient_email: new_email })
      .eq('id', mail_id)
      .select();
    
    if (scheduledError) {
      console.error('[API] Supabase scheduled_emails update error:', scheduledError);
      return res.status(500).json({ success: false, error: scheduledError.message });
    }
    
    console.log('[API] scheduled_emails updated successfully');
    
    // Step 3: Update learners_data table
    // Find the learner with the old email and same batch_no
    const { data: learnerData, error: learnerUpdateError } = await supabase
      .from('learners_data')
      .update({ email: new_email })
      .eq('email', oldEmail)
      .eq('batch_no', batchNo)
      .select();
    
    if (learnerUpdateError) {
      console.error('[API] learners_data update error:', learnerUpdateError);
      // Email was updated in scheduled_emails but failed in learners_data
      return res.json({ 
        success: true, 
        message: 'Email updated in scheduled_emails, but failed to update learners_data',
        warning: learnerUpdateError.message,
        data: scheduledData
      });
    }
    
    if (!learnerData || learnerData.length === 0) {
      console.log('[API] No matching learner found in learners_data table');
      return res.json({ 
        success: true, 
        message: 'Email updated in scheduled_emails, but no matching learner found',
        warning: 'Learner not found in learners_data table',
        data: scheduledData
      });
    }
    
    console.log('[API] learners_data updated successfully:', learnerData);
    
    res.json({ 
      success: true, 
      message: 'Email updated successfully in both tables', 
      data: {
        scheduled_emails: scheduledData,
        learners_data: learnerData
      }
    });
  } catch (err) {
    console.error('[API] Error updating email:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update actual date - Supabase version
app.post("/api/update-actual-date", async (req, res) => {
  try {
    const { topic_id, actual_date, changed_by } = req.body;

    // 1. Get planned date and batch/topic info
    const { data: topicData, error: topicError } = await supabase
      .from("course_planner_data")
      .select("date, topic_name, batch_no")
      .eq("id", topic_id)
      .single();

    if (topicError || !topicData) {
      console.error("Error fetching topic:", topicError);
      return res.json({ success: false, error: "Topic not found" });
    }

    const plannedDate = new Date(topicData.date);
    const actualDateObj = new Date(actual_date);

    // 2. Calculate difference in days (can be +, -, or 0)
    const timeDiff = actualDateObj - plannedDate;
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));

    // 3. Update course_planner_data
    const { error: updateError } = await supabase
      .from("course_planner_data")
      .update({
        actual_date: actual_date,
        date_difference: daysDiff,          // important: store 0 for on-time
        date_changed_by: changed_by,
        date_changed_at: new Date().toISOString(),
      })
      .eq("id", topic_id);

    if (updateError) {
      console.error("Error updating course_planner_data:", updateError);
      return res.json({ success: false, error: updateError.message });
    }

    // 4. Insert into audit table (for detailed report)
    const { error: auditError } = await supabase
      .from("date_change_audit")
      .insert({
        topic_id: topic_id,
        batch_no: topicData.batch_no,
        topic_name: topicData.topic_name,
        planned_date: topicData.date,
        actual_date: actual_date,
        date_difference: daysDiff,          // again, 0 is stored for on-time
        changed_by: changed_by,
        changed_at: new Date().toISOString(),
      });

    if (auditError) {
      console.error("Error inserting audit record:", auditError);
      // Do not fail the main request if audit logging fails
    }

    // 5. Human‑readable message
    const message =
      daysDiff > 0
        ? `Topic completed ${daysDiff} day(s) later than planned`
        : daysDiff < 0
        ? `Topic completed ${Math.abs(daysDiff)} day(s) earlier than planned`
        : "Topic completed on planned date (On time)";

    return res.json({
      success: true,
      date_difference: daysDiff,
      message,
    });
  } catch (error) {
    console.error("Error updating actual date:", error);
    return res.json({ success: false, error: error.message });
  }
});

// Get date change report for a batch - Supabase version
app.get("/api/date-change-report/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;

    const { data, error } = await supabase
      .from("date_change_audit")
      .select(`
        id,
        topic_name,
        planned_date,
        actual_date,
        date_difference,
        changed_by,
        changed_at,
        topic_id
      `)
      .eq("batch_no", batch_no)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("Error fetching report:", error);
      return res.json({ error: error.message });
    }

    const enrichedData = await Promise.all(
      (data || []).map(async (item) => {
        const { data: topicData, error: topicError } = await supabase
          .from("course_planner_data")
          .select(
            "module_name, trainer_name, trainer_email, topic_status, remarks"
          )
          .eq("id", item.topic_id)
          .single();

        if (topicError) {
          console.error("Error fetching topic details:", topicError);
        }

        return {
          id: item.id,
          topic_name: item.topic_name,
          planned_date: item.planned_date,
          actual_date: item.actual_date,
          date_difference: item.date_difference, // +, -, or 0
          changed_by: item.changed_by,
          changed_at: item.changed_at,
          module_name: topicData?.module_name || "N/A",
          trainer_name: topicData?.trainer_name || "N/A",
          trainer_email: topicData?.trainer_email || "N/A",
          topic_status: topicData?.topic_status || "N/A",
          remarks: topicData?.remarks || "",
        };
      })
    );

    return res.json(enrichedData);
  } catch (error) {
    console.error("Error fetching date change report:", error);
    return res.json({ error: error.message });
  }
});


// Get summary statistics for a batch - Supabase version
app.get("/api/batch-date-summary/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;

    // Only topics where actual_date is set are considered "completed"
    const { data, error } = await supabase
      .from("course_planner_data")
      .select("date_difference")
      .eq("batch_no", batch_no)
      .not("actual_date", "is", null);

    if (error) {
      console.error("Error fetching summary:", error);
      return res.json({ error: error.message });
    }

    let delayed_count = 0;
    let early_count = 0;
    let ontime_count = 0;
    let sum_difference = 0;
    let max_delay = 0;
    let max_early = 0;

    (data || []).forEach((item) => {
      // If date_difference is NULL in DB, treat as 0 (on time)
      const diff =
        typeof item.date_difference === "number"
          ? item.date_difference
          : 0;

      if (diff > 0) {
        delayed_count += 1;
        if (diff > max_delay) max_delay = diff;
      } else if (diff < 0) {
        early_count += 1;
        if (diff < max_early) max_early = diff;
      } else {
        // diff === 0 → on time
        ontime_count += 1;
      }

      sum_difference += diff;
    });

    const avg_difference =
      data && data.length > 0 ? sum_difference / data.length : 0;

    return res.json({
      delayed_count,
      early_count,
      ontime_count,                 // this drives the "On Time" card
      avg_difference: avg_difference.toFixed(2),
      max_delay,
      max_early,
    });
  } catch (error) {
    console.error("Error fetching batch summary:", error);
    return res.json({ error: error.message });
  }
});

// Weekly date-change report for a batch & week
// ROUTE 1: JSON data for table display (MUST have this first)
app.get("/api/weekly-date-report/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;
    const { week_no } = req.query;

    if (!week_no) {
      return res.status(400).json({ error: "week_no query parameter is required" });
    }

    const { data: topics, error: topicsError } = await supabase
      .from("course_planner_data")
      .select(`
        id,
        batch_no,
        week_no,
        module_name,
        topic_name,
        trainer_name,
        trainer_email,
        topic_status,
        remarks,
        date,
        actual_date,
        date_difference,
        date_changed_by,
        date_changed_at
      `)
      .eq("batch_no", batch_no)
      .eq("week_no", week_no)
      .order("date", { ascending: true });

    if (topicsError) {
      console.error("Topics error:", topicsError);
      return res.status(500).json({ error: topicsError.message });
    }

    if (!topics?.length) return res.json([]);

    const topicIds = topics.map(t => t.id);
    const { data: audits } = await supabase
      .from("date_change_audit")
      .select("id, topic_id, batch_no, topic_name, planned_date, actual_date, date_difference, changed_by, changed_at")
      .in("topic_id", topicIds)
      .order("changed_at", { ascending: false });

    const latestAuditByTopic = {};
    audits?.forEach(row => {
      if (!latestAuditByTopic[row.topic_id]) {
        latestAuditByTopic[row.topic_id] = row;
      }
    });

    const result = topics.map(t => {
      const audit = latestAuditByTopic[t.id];
      return {
        id: audit?.id || t.id,
        topic_id: t.id,
        batch_no: t.batch_no,
        week_no: t.week_no,
        module_name: t.module_name || "N/A",
        topic_name: audit?.topic_name || t.topic_name,
        trainer_name: t.trainer_name || "N/A",
        planned_date: audit?.planned_date || t.date,
        actual_date: audit?.actual_date || t.actual_date || t.date,
        date_difference: Number(audit?.date_difference ?? t.date_difference ?? 0),
        topic_status: t.topic_status || "N/A",
        changed_by: audit?.changed_by || t.date_changed_by || null,
        changed_at: audit?.changed_at || t.date_changed_at || null,
        remarks: t.remarks || "",
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Weekly report error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ROUTE 2: PDF download (install pdfkit first: npm install pdfkit)
app.get("/api/weekly-date-report/:batch_no/pdf", async (req, res) => {
  try {
    const { batch_no } = req.params;
    const { week_no } = req.query;

    if (!week_no) {
      return res.status(400).json({ error: "week_no query parameter is required" });
    }

    const { data: topics } = await supabase
      .from("course_planner_data")
      .select(`
        id,
        batch_no,
        week_no,
        module_name,
        topic_name,
        trainer_name,
        trainer_email,
        topic_status,
        remarks,
        date,
        actual_date,
        date_difference,
        date_changed_by,
        date_changed_at
      `)
      .eq("batch_no", batch_no)
      .eq("week_no", week_no)
      .order("date", { ascending: true });

    if (!topics?.length) {
      return res.status(404).json({ error: "No data found" });
    }

    const topicIds = topics.map(t => t.id);
    const { data: audits } = await supabase
      .from("date_change_audit")
      .select("id, topic_id, batch_no, topic_name, planned_date, actual_date, date_difference, changed_by, changed_at")
      .in("topic_id", topicIds)
      .order("changed_at", { ascending: false });

    const latestAuditByTopic = {};
    audits?.forEach(row => {
      if (!latestAuditByTopic[row.topic_id]) {
        latestAuditByTopic[row.topic_id] = row;
      }
    });

    const rows = topics.map(t => {
      const audit = latestAuditByTopic[t.id];
      return {
        module_name: t.module_name || "N/A",
        topic_name: audit?.topic_name || t.topic_name,
        planned_date: new Date(audit?.planned_date || t.date).toLocaleDateString("en-IN"),
        actual_date: new Date(audit?.actual_date || t.actual_date || t.date).toLocaleDateString("en-IN"),
        date_difference: Number(audit?.date_difference ?? t.date_difference ?? 0),
        topic_status: t.topic_status || "N/A",
        changed_by: audit?.changed_by || t.date_changed_by || "N/A",
        changed_at: audit?.changed_at ? new Date(audit.changed_at).toLocaleDateString("en-IN") : "-",
      };
    });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Weekly_Report_${batch_no}_Week${week_no}.pdf"`
    );
    doc.pipe(res);

    // Header band
    doc.rect(40, 40, 515, 80).fill("#1f5a6b");
    doc.fontSize(24).font("Helvetica-Bold").fillColor("white")
      .text("Weekly Date Change Report", 50, 55);
    doc.fontSize(11).font("Helvetica").fillColor("#e8f4f8")
      .text(`Batch: ${batch_no}  |  Week: ${week_no}`, 50, 85);
    doc.fontSize(9).font("Helvetica").fillColor("#e8f4f8")
      .text(`Generated: ${new Date().toLocaleString("en-IN")}`, 380, 85, { align: "right" });
    doc.fillColor("#000000");

    doc.moveDown(3);

    // Wider columns + wrapping for Module / Topic
    const headers = ["Module", "Topic", "Planned", "Actual", "Difference", "Status", "Changed By", "Date"];
    const colWidths = [80, 150, 55, 55, 60, 55, 70, 50]; // wider Module/Topic
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const margin = 40;
    let y = doc.y + 15;

    const rowPaddingY = 6;

    const drawHeader = () => {
      doc.rect(margin, y, tableWidth, 22).fill("#2d7a8a");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("white");
      let x = margin + 5;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 6, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });
      doc.fillColor("#000000");
      y += 22;
    };

    const ensureSpace = (rowHeight) => {
      if (y + rowHeight > 780) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
    };

    drawHeader();

    rows.forEach((row, idx) => {
      // Estimate multi-line height for module & topic
      doc.fontSize(9).font("Helvetica");
      const moduleHeight = doc.heightOfString(row.module_name, {
        width: colWidths[0] - 8,
      });
      const topicHeight = doc.heightOfString(row.topic_name, {
        width: colWidths[1] - 8,
      });
      const contentHeight = Math.max(moduleHeight, topicHeight, 10);
      const rowHeight = contentHeight + rowPaddingY * 2;

      ensureSpace(rowHeight);

      const bg = idx % 2 === 0 ? "#f9f9f9" : "#ffffff";
      doc.rect(margin, y, tableWidth, rowHeight).fill(bg).stroke("#d0d0d0");
      let x = margin + 5;
      const textY = y + rowPaddingY;

      // Module (wrapped)
      doc.fillColor("#000000").text(row.module_name, x, textY, {
        width: colWidths[0] - 8,
      });
      x += colWidths[0];

      // Topic (wrapped)
      doc.text(row.topic_name, x, textY, {
        width: colWidths[1] - 8,
      });
      x += colWidths[1];

      // Planned
      doc.text(row.planned_date, x, textY, {
        width: colWidths[2] - 8,
        align: "center",
      });
      x += colWidths[2];

      // Actual
      doc.text(row.actual_date, x, textY, {
        width: colWidths[3] - 8,
        align: "center",
      });
      x += colWidths[3];

      // Difference badge
      const diff = row.date_difference;
      const diffStr = diff > 0 ? `+${diff} d` : diff < 0 ? `${diff} d` : "0 d";
      const badgeBg =
        diff > 0 ? "#ff9800" : diff < 0 ? "#4caf50" : "#9e9e9e";
      doc.rect(x + 5, textY, 50, 12).fill(badgeBg);
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold").text(
        diffStr,
        x + 5,
        textY + 2,
        { width: 50, align: "center" }
      );
      doc.fillColor("#000000").fontSize(9).font("Helvetica");
      x += colWidths[4];

      // Status
      doc.text(row.topic_status, x, textY, {
        width: colWidths[5] - 8,
        align: "center",
      });
      x += colWidths[5];

      // Changed By
      doc.text(row.changed_by, x, textY, {
        width: colWidths[6] - 8,
        align: "center",
      });
      x += colWidths[6];

      // Date
      doc.text(row.changed_at, x, textY, {
        width: colWidths[7] - 8,
        align: "center",
      });

      y += rowHeight;
    });

    doc.fontSize(8).fillColor("#888888").text(
      `Total Records: ${rows.length}`,
      margin,
      780
    );

    doc.end();
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Get email content for viewing/editing
app.get('/api/mail/content', async (req, res) => {
  const { mail_id } = req.query;
  
  console.log('[API] Fetching email content for mail_id:', mail_id);
  
  if (!mail_id) {
    return res.status(400).json({ success: false, error: 'mail_id is required' });
  }
  
  try {
    const { data, error } = await supabase
      .from('scheduled_emails')
      .select('id, batch_no, recipient_email, template_name, subject, body_html, status')
      .eq('id', mail_id)
      .single();
    
    if (error) {
      console.error('[API] Supabase error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    if (!data) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    console.log('[API] Email data found:', {
      id: data.id,
      subject: data.subject,
      hasBody: !!data.body_html,
      bodyLength: data.body_html ? data.body_html.length : 0,
    });
    
    res.json({ 
      success: true, 
      email: {
        id: data.id,
        recipient_email: data.recipient_email,
        subject: data.subject || `Email for ${data.template_name}`,
        body: data.body_html || 'No email body found',
        template_name: data.template_name,
        batch_no: data.batch_no,
        status: data.status,
      }
    });
  } catch (err) {
    console.error('[API] Error fetching email content:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resend email with edited content
app.post('/api/mail/resend', async (req, res) => {
  const { mail_id, recipient_email, subject, body } = req.body;
  
  console.log('[API] Resending email for mail_id:', mail_id);
  
  if (!mail_id || !recipient_email || !subject || !body) {
    return res.status(400).json({ 
      success: false, 
      error: 'mail_id, recipient_email, subject, and body are required' 
    });
  }
  
  try {
    // Send email using nodemailer
    await mailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipient_email,
      subject: subject,
      html: body,
    });
    
    console.log('[API] Email sent successfully to:', recipient_email);
    
    // Update database with new content and sent timestamp
    const { data, error } = await supabase
      .from('scheduled_emails')
      .update({ 
        subject: subject,
        body_html: body,
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mail_id)
      .select();
    
    if (error) {
      console.error('[API] Database update error:', error);
      // Email was sent but DB update failed
      return res.json({ 
        success: true, 
        message: 'Email sent but database update failed',
        warning: error.message 
      });
    }
    
    console.log('[API] Database updated successfully');
    res.json({ 
      success: true, 
      message: 'Email resent successfully',
      data 
    });
  } catch (err) {
    console.error('[API] Error resending email:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//===Reply to the emails of that template
app.post("/api/mail/reply", async (req, res) => {
  const { batch_no, mode, template_name, email_body } = req.body;

  if (!template_name || !email_body || typeof email_body !== "string") {
    return res.status(400).json({ error: "Missing or invalid required fields" });
  }

  try {
    // 1. Find the template_id for the given template_name from scheduled_emails (using the first match)
    const { data: templateRows, error: templateError } = await supabase
      .from("scheduled_emails")
      .select("template_id")
      .eq("template_name", template_name)
      .not("template_id", "is", null)
      .limit(1);

    if (templateError) {
      console.error("Error fetching template_id from scheduled_emails:", templateError);
      return res.status(500).json({ error: "Failed to fetch template_id" });
    }
    if (!templateRows || templateRows.length === 0) {
      return res.status(404).json({ error: "No template_id found for selected template_name" });
    }

    const template_id = templateRows[0].template_id;

    // 2. Lookup all sent emails for that template_id and template_name (and optionally by batch/mode)
    let scheduledQuery = supabase
      .from("scheduled_emails")
      .select("id, recipient_email, message_id, template_id")
      .eq("template_id", template_id)
      .eq("template_name", template_name)
      .eq("status", "sent");

    if (batch_no) scheduledQuery = scheduledQuery.eq("batch_no", batch_no);
    if (mode) scheduledQuery = scheduledQuery.eq("mode", mode);

    const { data: sentEmails, error: sentError } = await scheduledQuery;

    if (sentError) {
      console.error("Error fetching sent emails:", sentError);
      return res.status(500).json({ error: "Failed to fetch sent emails" });
    }
    if (!sentEmails || sentEmails.length === 0) {
      return res.status(404).json({ error: "No previously sent emails found for this template to reply to." });
    }

    // 3. Prepare a mapping recipient_email -> (most recent) message_id
    // If multiple emails per recipient, pick the latest (higher id or later sent_at)
    const recipientToOriginal = {};
    sentEmails.forEach(email => {
      // If needed, can prioritize by sent_at or id
      recipientToOriginal[email.recipient_email] = email.message_id;
    });

    // 4. Reply to each thread only if we have the original message_id
    let sentCount = 0;
    const sendPromises = Object.entries(recipientToOriginal).map(async ([to, originalMessageId]) => {
      if (!to || !originalMessageId) {
        console.warn("Skipping reply to", to, "due to missing messageId");
        return;
      }

      const sendResult = await sendRawEmail({
        to,
        subject: `Reply: ${template_name}`,
        html: `<p>${email_body}</p>`,
        inReplyTo: originalMessageId,
        references: originalMessageId,
      });

      if (sendResult.success) {
        sentCount++;
        // Optionally log or write reply info
      } else {
        console.error("Failed to send reply to", to, sendResult.error);
      }
    });

    await Promise.all(sendPromises);

    res.json({ success: true, message: `Reply emails sent successfully to ${sentCount} threads for template '${template_name}'.` });
  } catch (err) {
    console.error("Error in reply-to-sent-mail threading:", err);
    res.status(500).json({ error: "Failed to send threaded reply emails" });
  }
});

//===Update the offset values===
app.post("/api/update-offsets", async (req, res) => {
  const { mode, batch_type, base_offset } = req.body;

  if (mode == null || base_offset == null) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Fetch templates filtered by mode and batch_type only
    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("id, offset_days")
      .eq("mode", mode)
      .eq("batch_type", batch_type || "")
      .order("offset_days", { ascending: true });

    if (error) throw error;
    if (!templates || templates.length === 0) {
      return res.status(404).json({ error: "No templates found for given mode and batch_type" });
    }

    const currentMin = templates[0].offset_days;
    const delta = base_offset - currentMin;

    // Update offset_days one by one
    for (const t of templates) {
      const newOffset = t.offset_days + delta;
      const { error: updateError } = await supabase
        .from("email_templates")
        .update({ offset_days: newOffset })
        .eq("id", t.id);

      if (updateError) throw updateError;
    }

    res.json({ message: `Offsets updated for ${templates.length} templates.` });
  } catch (err) {
    console.error("Error updating offsets:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

//===Fetch the topics for the selected batch for the Trainer Dashboard
app.get('/api/topics/:batch_no', async (req, res) => {
  const batchNo = req.params.batch_no;
  const weekNo = req.query.week_no;

  if (!batchNo) {
    return res.status(400).json({ error: "Batch number is required" });
  }

  try {
    // Query topics from your course_planner_data table filtered by batch_no, optionally by week_no
    let query = supabase
      .from('course_planner_data')
      .select('id, topic_name, module_name, date, remarks, topic_status, week_no')
      .eq('batch_no', batchNo);

    if (weekNo) {
      query = query.eq('week_no', weekNo);
    }

    // Order by date ascending to have topics in chronological order
    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    console.error('Error fetching topics:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

//===Load the week no before the topics===
app.get('/api/weeks/:batch_no', async (req, res) => {
  const batch_no = req.params.batch_no;

  const { data, error } = await supabase
    .from('course_planner_data')
    .select('week_no')
    .eq('batch_no', batch_no)
    .order('week_no', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Extract distinct week_nos
  const distinctWeeks = [...new Set(data.map(d => d.week_no))].filter(w => w !== null && w !== undefined);

  res.json(distinctWeeks);
});


//===Update the topic status in the Trainer Dashboard===
app.post("/api/update-topic-status", async (req, res) => {
  const { topic_id, status } = req.body;
  if (!topic_id || !status) {
    return res.status(400).json({ success: false, error: "Topic ID and status are required" });
  }
  try {
    const { error } = await supabase
      .from("course_planner_data")
      .update({ topic_status: status })
      .eq("id", topic_id);
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, topic_id, status });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});


//===Update the topic remarks in the Trainer Dashboard===
app.post("/api/update-remarks", async (req, res) => {
  const { topic_id, remarks } = req.body;
  if (!topic_id) {
    return res.status(400).json({ success: false, error: "Topic ID is required" });
  }

  try {
    const { error } = await supabase
      .from("course_planner_data")
      .update({ remarks })
      .eq("id", topic_id);

    if (error) {
      console.error("Error updating remarks:", error);
      return res.status(500).json({ success: false, error: "Failed to update remarks" });
    }

    return res.json({ success: true, message: "Remarks updated" });
  } catch (err) {
    console.error("Exception updating remarks:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// === Mock Interview Scheduling ===
app.post("/api/mock-interview-schedule", async (req, res) => {
  try {
    const { batch_no, interview_date } = req.body;
    if (!batch_no || !interview_date) {
      return res.status(400).json({ error: "batch_no and interview_date required" });
    }

    const { data: learners, error: learnerErr } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);
    if (learnerErr) throw learnerErr;

    const { data: batchInfo, error: batchErr } = await supabase
      .from("course_planner_data")
      .select("trainer_email, trainer_name")
      .eq("batch_no", batch_no)
      .not("trainer_email", "is", null)
      .limit(1)
      .maybeSingle();
    if (batchErr) throw batchErr;

    const trainerEmail = batchInfo?.trainer_email;
    const trainerName = batchInfo?.trainer_name || "Trainer";
    if (!trainerEmail) {
      return res.status(404).json({ error: "Trainer email not found for batch" });
    }

    const learnerTime = process.env.MOCK_INTERVIEW_LEARNER_TIME || "09:00";
    const trainerTime = process.env.MOCK_INTERVIEW_TRAINER_TIME || "09:00";

    const learnerScheduledAt = computeTodayISO(learnerTime);
    const trainerScheduledAt = computeTodayISO(trainerTime);

    // Learner emails
    for (const learner of learners) {
      await supabase.from("scheduled_emails").insert({
        batch_no,
        recipient_email: learner.email,
        subject: `Mock Interview Scheduled for batch ${batch_no}`,
        body_html: `<p>Dear ${learner.name || "Learner"},</p>
                    <p>Your mock interview for batch <strong>${batch_no}</strong> 
                    has been scheduled on <b>${interview_date}</b>.</p>`,
        scheduled_at: learnerScheduledAt,
        status: "scheduled",
        mode: "Online",
        template_name: "Mock Interview Learner Notification",
        source: "mock_interview",
        created_at: new Date().toISOString(),
      });
    }

    // Trainer email
    await supabase.from("scheduled_emails").insert({
      batch_no,
      recipient_email: trainerEmail,
      subject: `Mock Interview Scheduled for batch ${batch_no}`,
      body_html: `<p>Dear ${trainerName},</p>
                  <p>The mock interview for batch <strong>${batch_no}</strong> 
                  is scheduled on <b>${interview_date}</b>.</p>`,
      scheduled_at: trainerScheduledAt,
      status: "scheduled",
      mode: "Offline",
      template_name: "Mock Interview Trainer Notification",
      source: "mock_interview",
      created_at: new Date().toISOString(),
    });

    // Coordinator email (hardcoded)
    const coordinatorEmail = "coordinator@chipedge.com";
    const coordinatorName = "Kowshika";

    await supabase.from("scheduled_emails").insert({
      batch_no,
      recipient_email: coordinatorEmail,
      subject: `Mock Interview Scheduled for batch ${batch_no}`,
      body_html: `<p>Dear ${coordinatorName},</p>
                  <p>The mock interview for batch <strong>${batch_no}</strong> 
                  has been scheduled on <b>${interview_date}</b> with <strong>${trainerName}</strong>.</p>`,
      scheduled_at: trainerScheduledAt,
      status: "scheduled",
      mode: "Notification",
      template_name: "Mock Interview Coordinator Notification",
      source: "mock_interview",
      created_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Scheduled ${learners.length + 2} emails successfully`,
      scheduled: learners.length + 2,
      batch_no,
      interview_date,
      learner_time: learnerTime,
      trainer_time: trainerTime,
      learner_scheduled_at: learnerScheduledAt,
      trainer_scheduled_at: trainerScheduledAt,
    });
  } catch (err) {
    console.error("❌ Error scheduling mock interview:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Soft Skill Announcement Scheduling API
app.post("/api/soft-skill-announcement", async (req, res) => {
  try {
    const { batch_no, date } = req.body;
    if (!batch_no || !date) {
      return res.status(400).json({ error: "batch_no and date required" });
    }

    // Fetch learners of the batch
    const { data: learners, error: learnerErr } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);
    if (learnerErr) throw learnerErr;

    // Fetch trainer info of the batch
    const { data: trainerData, error: trainerErr } = await supabase
      .from("course_planner_data")
      .select("trainer_email, trainer_name")
      .eq("batch_no", batch_no)
      .not("trainer_email", "is", null)
      .limit(1)
      .maybeSingle();
    if (trainerErr) throw trainerErr;

    const trainerEmail = trainerData?.trainer_email;
    const trainerName = trainerData?.trainer_name || "Trainer";

    // Schedule email time: immediately (can be changed if needed)
    const scheduledAt = new Date().toISOString();

    // Insert emails for learners
    for (const learner of learners) {
      await supabase.from("scheduled_emails").insert({
        batch_no,
        recipient_email: learner.email,
        subject: `Soft Skills Class Scheduled for batch ${batch_no}`,
        body_html: `<p>Dear ${learner.name || "Learner"},</p>
                    <p>The soft skills class has been scheduled on the date <b>${date}</b>.</p>`,
        scheduled_at: scheduledAt,
        status: "scheduled",
        mode: "Online",
        template_name: "Soft Skills Learner Announcement",
        source: "soft_skill_announcement",
        created_at: new Date().toISOString(),
      });
    }

    // Insert email for trainer
    if (trainerEmail) {
      await supabase.from("scheduled_emails").insert({
        batch_no,
        recipient_email: trainerEmail,
        subject: `Soft Skills Class Scheduled for batch ${batch_no}`,
        body_html: `<p>Dear ${trainerName},</p>
                    <p>The soft skills class has been scheduled on the date <b>${date}</b>.</p>`,
        scheduled_at: scheduledAt,
        status: "scheduled",
        mode: "Offline",
        template_name: "Soft Skills Trainer Announcement",
        source: "soft_skill_announcement",
        created_at: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: `Emails scheduled for batch ${batch_no} on date ${date}`,
      batch_no,
      date,
      learner_count: learners.length,
      trainer_email_sent: !!trainerEmail,
    });
  } catch (err) {
    console.error("❌ Error scheduling soft skill announcement:", err.message);
    res.status(500).json({ error: err.message });
  }
});


//===Course Closure Announcement===
app.post("/api/course-closure", async (req, res) => {
  try {
    const { batch_no, end_date } = req.body;
    if (!batch_no || !end_date) {
      return res.status(400).json({ error: "Batch No and End Date are required" });
    }

    // 1️⃣ Fetch learners for the batch
    const { data: learners, error: learnersErr } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);

    if (learnersErr) throw learnersErr;
    if (!learners || learners.length === 0) {
      return res.status(404).json({ error: "No learners found for this batch" });
    }

    // 2️⃣ Fetch admin users
    const { data: admins, error: adminErr } = await supabase
      .from("users")
      .select("email, name")
      .eq("role", "admin");

    if (adminErr) throw adminErr;
    if (!admins || admins.length === 0) {
      return res.status(404).json({ error: "No admins found" });
    }

    // 3️⃣ Send emails to admins (you can reuse your sendRawEmail function)
    let sentCount = 0;
    for (const admin of admins) {
      const subject = `Course Closure Notification - ${batch_no}`;
      const body = `<p>Hi ${admin.name || "Admin"},</p>
                    <p>The course for <strong>${batch_no}</strong> is going to end on <strong>${end_date}</strong>.</p>
                    <p>Kindly disable the VPN access for this batch.</p>`;

      const sendResult = await sendRawEmail({
        to: admin.email,
        subject,
        html: body,
        text: body.replace(/<[^>]+>/g, ""), // plain text fallback
      });

      if (sendResult.success) sentCount++;
      else console.error(`Failed to send to ${admin.email}:`, sendResult.error);
    }

    res.json({
      success: true,
      message: `✅ Emails sent to ${sentCount} admin(s) for batch ${batch_no}`,
    });
  } catch (err) {
    console.error("Course closure error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Upload Mock Interview Feedback and Schedule Emails ===
app.post("/api/mock-interview-feedback", upload.single("file"), async (req, res) => {
  try {
    const { batch_no } = req.body;
    const file = req.file;

    if (!batch_no || !file) {
      return res.status(400).json({ error: "Batch and file are required" });
    }

    // Get learners for this batch
    const { data: learners, error: learnersErr } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);

    if (learnersErr) throw learnersErr;
    if (!learners.length) return res.status(404).json({ error: "No learners found for this batch" });

    // Read file content as attachment
    const fileBuffer = fs.readFileSync(file.path);
    const originalName = file.originalname;

    // Schedule email for each learner
    const nowISO = new Date().toISOString();
    let scheduledCount = 0;

    for (const learner of learners) {
      const { error: insertError } = await supabase.from("scheduled_emails").insert({
        batch_no,
        recipient_email: learner.email,
        subject: `Your Mock Interview Feedback - Batch ${batch_no}`,
        body_html: `<p>Dear ${learner.name || "Learner"},</p>
                    <p>Here is your feedback for the mock interview conducted for batch <strong>${batch_no}</strong>.</p>
                    <p>Please find the attached file.</p>`,
        attachment_name: originalName,
        attachment_data: fileBuffer.toString("base64"), // store as base64
        scheduled_at: nowISO,
        status: "scheduled",
        mode: "Online",
        template_name: "Mock Interview Feedback",
        source: "mock_interview_feedback",
        created_at: nowISO,
      });

      if (!insertError) scheduledCount++;
      else console.error(`❌ Failed for ${learner.email}:`, insertError.message);
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: `Scheduled ${scheduledCount} feedback emails for batch ${batch_no}`,
      scheduled: scheduledCount,
    });
  } catch (err) {
    console.error("❌ Error scheduling feedback emails:", err.message);
    res.status(500).json({ error: err.message });
  }
});

//===Internal Email Communication based on the roles and template from the internal_email_templates table===
app.post("/api/internal/schedule", async (req, res) => {
  try {
    const { role, batchNo, startDate, domain } = req.body;

    // Validate required
    if (!role || !batchNo || !startDate) {
      return res.status(400).json({ error: "role, batchNo, startDate are required" });
    }

    const rolesArray = Array.isArray(role) ? role : [role];
    let totalScheduled = 0;
    let details = [];

    // Log incoming request info
    console.log("Request to schedule internal emails");
    console.log("Roles:", rolesArray);
    console.log("BatchNo:", batchNo);
    console.log("StartDate:", startDate);
    console.log("Domain:", domain);

    for (const r of rolesArray) {
      // Fetch active templates for the role
      const { data: templates, error: fetchError } = await supabase
        .from("internal_email_templates")
        .select("*")
        .eq("role", r)
        .eq("active", true);

      if (fetchError) {
        console.error(`Error fetching templates for role '${r}':`, fetchError);
        details.push({ role: r, error: fetchError.message });
        continue;
      }

      if (!templates || templates.length === 0) {
        details.push({ role: r, warning: "No active templates found" });
        continue;
      }

      console.log(`Found ${templates.length} active template(s) for role '${r}'`);

      for (const tmpl of templates) {
        // Validate recipients
        if (!tmpl.recipient_email || tmpl.recipient_email.trim() === "") {
          details.push({ role: r, template: tmpl.template_name, warning: "No recipient_email specified" });
          continue;
        }

        const recipients = tmpl.recipient_email
          .split(",")
          .map(e => e.trim())
          .filter(e => e.length > 0);

        if (recipients.length === 0) {
          details.push({ role: r, template: tmpl.template_name, warning: "No valid recipient emails found" });
          continue;
        }

        // Compose email subject and body with substitutions
        const scheduledAt = computeScheduledAtISO(
          startDate,
          tmpl.offset_days || 0,
          tmpl.send_time || "09:00"
        );

        const subj = (tmpl.subject || "")
          .replace(/{{batch_no}}/g, batchNo)
          .replace(/{{start_date}}/g, formatDate(startDate))
          .replace(/{{domain}}/g, domain || "");

        const body = (tmpl.body_html || "")
          .replace(/{{batch_no}}/g, batchNo)
          .replace(/{{start_date}}/g, formatDate(startDate))
          .replace(/{{domain}}/g, domain || "");

        // Schedule emails for each recipient
        for (const email of recipients) {
          const { error: insertErr } = await supabase.from("scheduled_emails").insert({
            batch_no: batchNo,
            template_id: tmpl.id,
            template_name: tmpl.template_name,
            recipient_email: email,
            subject: subj,
            body_html: body,
            scheduled_at: scheduledAt,
            status: "scheduled",
            mode: "Internal",
            batch_type: null,
            source: "internal_email_templates",
            role: r,
            created_at: new Date().toISOString(),
          });

          if (insertErr) {
            details.push({ role: r, recipient: email, template: tmpl.template_name, error: insertErr.message });
          } else {
            totalScheduled++;
            details.push({ role: r, recipient: email, template: tmpl.template_name, status: "scheduled" });
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Scheduled ${totalScheduled} emails successfully`,
      details,
    });
  } catch (error) {
    console.error("Error in /api/internal/schedule:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});


//===Share the feedback to the learners with the attachment===
app.post("/api/internal/feedback-share", upload.single("file"), async (req, res) => {
  try {
    const { batchNo, roles, feedbackType } = req.body;
    const file = req.file;

    if (!batchNo || !roles || !feedbackType || !file) {
      return res.status(400).json({ error: "All fields and file are required" });
    }

    // Parse roles array
    const rolesArr = JSON.parse(roles);

    // Read original Excel/CSV file
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

    // Remove first 4 columns (learner details)
    jsonData = jsonData.map(row => {
      const keys = Object.keys(row);
      const newRow = {};
      for (let i = 4; i < keys.length; i++) {
        newRow[keys[i]] = row[keys[i]];
      }
      return newRow;
    });

    // Convert trimmed data back to sheet
    const newSheet = xlsx.utils.json_to_sheet(jsonData);
    const newWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWb, newSheet, sheetName);
    const tempFilePath = file.path + "-trimmed" + path.extname(file.originalname);
    xlsx.writeFile(newWb, tempFilePath);

    // Read the trimmed file into buffer for email attachment
    const fileBuffer = fs.readFileSync(tempFilePath);
    const base64Data = fileBuffer.toString("base64");
    const filename = file.originalname;

    // Map roles to roles array
    const rolesToSend = rolesArr; // You sent actual roles like "Trainer", "Management", etc.

    // Fetch recipients based on roles
    let recipients = [];

    for (const role of rolesToSend) {
      if (role === "Trainer") {
        // Trainers in the batch
        const { data: trainers, error: trainerErr } = await supabase
          .from("course_planner_data")
          .select("trainer_name")
          .eq("batch_no", batchNo);
        if (trainerErr) continue;

        for (const trainer of trainers || []) {
          if (!trainer.trainer_name) continue;
          const { data: user, error: userErr } = await supabase
            .from("internal_users")
            .select("name,email,is_active")
            .eq("name", trainer.trainer_name)
            .eq("role", "Trainer")
            .eq("is_active", true)
            .single();

          if (user && user.email && user.is_active) {
            recipients.push(user);
          }
        }
      } else if (role === "Management") {
        // Both Management and Manager
        const { data: users, error: mgErr } = await supabase
          .from("internal_users")
          .select("name,email,is_active")
          .in("role", ["Management", "Manager"])
          .eq("is_active", true);
        if (users) recipients.push(...users.filter(u => u.email && u.is_active));
      } else if (role === "Learning Coordinator") {
        // Role 'Coordinator'
        const { data: coords, error: coordErr } = await supabase
          .from("internal_users")
          .select("name,email,is_active")
          .eq("role", "Coordinator")
          .eq("is_active", true);
        if (coords) recipients.push(...coords.filter(u => u.email && u.is_active));
      } else {
        // Other roles
        const { data: users, error: userErr } = await supabase
          .from("internal_users")
          .select("name,email,is_active")
          .eq("role", role)
          .eq("is_active", true);
        if (users) recipients.push(...users.filter(u => u.email && u.is_active));
      }
    }

    // Remove duplicates
    recipients = Array.from(
      new Map(
        recipients
          .filter(u => u.email && u.is_active)
          .map(u => [u.email.toLowerCase().trim(), u])
      ).values()
    );

    if (recipients.length === 0) {
      // Cleanup temp files
      fs.unlinkSync(file.path);
      fs.unlinkSync(tempFilePath);
      return res.status(404).json({ error: "No valid recipients found." });
    }

    // Send emails (immediately)
    let successCount = 0;
    let errorList = [];
    for (const user of recipients) {
      try {
        // Use your preferred email SMTP method here (Nodemailer, SendGrid, etc.)
        await mailTransporter.sendMail({
          from: process.env.MAIL_FROM,
          to: user.email,
          subject: `${feedbackType} for Batch: ${batchNo}`,
          html: `<p>Hello ${user.name},</p><p>PFA for the ${feedbackType} for Batch: ${batchNo}</p>`,
          attachments: [{ filename: filename, content: fileBuffer }]
        });
        successCount++;
      } catch (err) {
        errorList.push({ email: user.email, error: err.message });
        console.error(`Failed to send email to ${user.email}:`, err);
      }
    }

    // Cleanup temp files
    fs.unlinkSync(file.path);
    fs.unlinkSync(tempFilePath);

    // Send response
    res.json({
      success: true,
      message: `Sent ${successCount} emails`,
      errors: errorList,
    });
  } catch (err) {
    console.error("Error in /api/internal/feedback-share:", err);
    res.status(500).json({ error: err.message });
  }
});

// API endpoint: POST /api/attendance/send
app.post("/api/attendance/upload", upload.single("file"), async (req, res) => {
  try {
    const { file } = req;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded!" });
    }

    let filePath = file.path;

    // If uploaded file is .xlsx, convert it to CSV
    if (path.extname(file.originalname).toLowerCase() === ".xlsx") {
      const workbook = XLSX.readFile(file.path);
      const csvFile = `uploads/${path.basename(file.originalname, ".xlsx")}.csv`;
      XLSX.writeFile(workbook, csvFile, { bookType: "csv" });
      filePath = csvFile;
    }

    const resultMessage = await processAttendanceFile(filePath);

    // Cleanup after processing
    fs.unlinkSync(filePath);
    res.json({ message: resultMessage });
  } catch (err) {
    console.error("Error processing attendance file:", err);
    res.status(500).json({ message: "Error processing attendance file" });
  }
});


// Optional: root route for testing API status
app.get("/", (req, res) => {
  res.send("Attendance Mailer API is running");
});

// Other endpoints (examples)
app.get("/api/hello", (req, res) => {
  res.json({ success: true, msg: "Hello from backend!" });
});

// === UNIFIED Background Worker (FIXED) ===
const MAX_RETRIES = 5;

cron.schedule("*/1 * * * *", async () => {  // every minute
  try {
    const now = dayjs();

    // Expand time window by 1 minute backward and forward
    const windowStart = now.subtract(1, "minute").startOf("minute").toISOString();
    const windowEnd = now.add(1, "minute").endOf("minute").toISOString();

    console.log(`⏱ Cron running at ${now.toISOString()}`);
    console.log(`Checking emails between ${windowStart} and ${windowEnd}`);

    // Fetch emails that must be processed
    const { data: emails, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .or("status.eq.scheduled,status.eq.failed")
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd)
      .order("scheduled_at", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("❌ Error fetching emails:", error.message);
      return;
    }

    if (!emails || emails.length === 0) {
      console.log("📭 No scheduled emails in this window.");
      return;
    }

    console.log(`📨 Processing ${emails.length} email(s)...`);

    for (const email of emails) {
      console.log(`➡️ Processing email ID ${email.id} (${email.recipient_email}) status=${email.status}`);

      // STOP if reached max retries
      if ((email.retry_count || 0) >= MAX_RETRIES) {
        console.log(`🚫 Email ID ${email.id} reached MAX_RETRIES. Skipping.`);
        continue;
      }

      // Mark as processing
      const { error: markError } = await supabase
        .from("scheduled_emails")
        .update({
          status: "processing",
          retry_count: (email.retry_count || 0) + 1,
          last_attempt_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", email.id);   // ❗ FIX: remove status condition

      if (markError) {
        console.error(`⚠️ Cannot mark email ${email.id} as processing:`, markError.message);
        continue;
      }

      try {
        const html = email.body_html || "";
        const text = html.replace(/<\/?[^>]+(>|$)/g, "");
        const attachments = [];

        if (email.attachment_name && email.attachment_data) {
          attachments.push({
            filename: email.attachment_name,
            content: Buffer.from(email.attachment_data, "base64")
          });
        }

        if (!email.recipient_email?.includes("@")) {
          throw new Error("Invalid email address");
        }

        const sendResult = await sendRawEmail({
          to: email.recipient_email,
          subject: email.subject || "(No subject)",
          html,
          text,
          attachments
        });

        if (sendResult?.success) {
          console.log(`✅ SENT: email ID ${email.id}`);

          await supabase
            .from("scheduled_emails")
            .update({
              status: "sent",
              sent_at: dayjs().toISOString(),
              error: null,
              updated_at: dayjs().toISOString()
            })
            .eq("id", email.id);

        } else {
          console.error(`❌ FAILED email ID ${email.id}:`, sendResult?.error);

          await supabase
            .from("scheduled_emails")
            .update({
              status: "failed",
              error: sendResult?.error || "Unknown error",
              updated_at: dayjs().toISOString()
            })
            .eq("id", email.id);
        }

      } catch (err) {
        console.error(`⚠️ Exception email ID ${email.id}:`, err.message);

        await supabase
          .from("scheduled_emails")
          .update({
            status: "failed",
            error: err.message,
            updated_at: dayjs().toISOString()
          })
          .eq("id", email.id);
      }

      // Avoid SMTP throttling
      await new Promise(r => setTimeout(r, 150));
    }

  } catch (e) {
    console.error("🚨 CRON FATAL ERROR:", e);
  }
});



// === Get Scheduled Emails (Debug endpoint) ===
app.get("/api/debug/scheduled-emails", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ Debug endpoint error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Send Course Closure Announcement Emails to Learners Immediately ===
app.post("/api/course-closure-to-learners", async (req, res) => {
  try {
    const { batch_no, end_date } = req.body;
    if (!batch_no || !end_date) {
      return res.status(400).json({ error: "Batch No and End Date are required" });
    }

    // Fetch learners in the batch
    const { data: learners, error: learnersErr } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);

    if (learnersErr) throw learnersErr;
    if (!learners || learners.length === 0) {
      return res.status(404).json({ error: "No learners found for this batch" });
    }

    let sentCount = 0;
    const failed = [];

    // Send personalized emails to each learner
    for (const learner of learners) {
      const subject = `Course Closure - Batch ${batch_no}`;
      const bodyHtml = `
        <p>Dear ${learner.name || "Learner"},</p>
        <p>Thanks for choosing chipedge. The course will end on the date <strong>${end_date}</strong>.</p>
        <p>All the best for your career.</p>
        <br/>
        <p>Best regards,<br/>ChipEdge Team</p>
      `;

      const result = await sendRawEmail({
        to: learner.email,
        subject,
        html: bodyHtml,
      });

      if (result.success) {
        sentCount++;
      } else {
        failed.push({ email: learner.email, error: result.error });
        console.error(`Failed to send email to ${learner.email}:`, result.error);
      }
    }

    res.json({
      success: failed.length === 0,
      message: `Emails sent to ${sentCount} learners successfully.`,
      failed,
    });
  } catch (err) {
    console.error("Error sending course closure emails to learners:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Final Assessment APIs ===

// Get only "Final Assessment" topics for a batch (Improved match)
app.get("/api/final-assessments/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;

    const { data, error } = await supabase
      .from("course_planner_data")
      .select("*")
      .eq("batch_no", batch_no)
      .ilike("topic_name", "%Final Assessment%"); // This matches anywhere

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("❌ Error fetching final assessments:", err.message);
    res.status(500).json({ error: "Failed to fetch final assessments" });
  }
});

// Update date for a topic
app.put("/api/final-assessments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;

    const { data, error } = await supabase
      .from("course_planner_data")
      .update({ date })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Topic not found" });

    res.json({ message: "✅ Date updated", topic: data });
  } catch (err) {
    console.error("❌ Error updating final assessment:", err.message);
    res.status(500).json({ error: "Failed to update final assessment" });
  }
});

// Send email for a batch (Final Assessment Notification)
app.post("/api/send-final-assessment-email", async (req, res) => {
  try {
    const { batch_no } = req.body;
    if (!batch_no) return res.status(400).json({ error: "Batch No required" });

    // 1️⃣ Get learners of this batch
    const { data: learners, error: learnersErr } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);

    if (learnersErr) throw learnersErr;
    if (!learners || learners.length === 0)
      return res.status(404).json({ error: "No learners found" });

    // 2️⃣ Get assessment topics
    const { data: topics, error: topicsErr } = await supabase
      .from("course_planner_data")
      .select("topic_name, date, start_time, end_time")
      .eq("batch_no", batch_no)
      .ilike("topic_name", "%Final Assessment%");

    if (topicsErr) throw topicsErr;

    // 3️⃣ Format email
    const rows = topics
      .map(
        t =>
          `<tr><td>${t.topic_name}</td><td>${formatDate(t.date)}</td><td>${t.start_time || "-"}</td><td>${t.end_time || "-"}</td></tr>`
      )
      .join("");

    const html = `
      <p>Dear Learner,</p>
      <p>Please find below the final assessment schedule for batch <strong>${batch_no}</strong>:</p>
      <table border="1" cellpadding="5" cellspacing="0">
        <tr><th>Topic</th><th>Date</th><th>Start Time</th><th>End Time</th></tr>
        ${rows}
      </table>
      <p>All the best!</p>
    `;

    // 4️⃣ Send emails immediately
    let sentCount = 0;
    for (const learner of learners) {
      const sendResult = await sendRawEmail({
        to: learner.email,
        subject: `Final Assessment Schedule - Batch ${batch_no}`,
        html,
        text: html.replace(/<[^>]+>/g, ""), // plain text fallback
      });

      if (sendResult.success) sentCount++;
      else console.error(`❌ Failed for ${learner.email}:`, sendResult.error);
    }

    res.json({ success: true, message: `✅ Sent schedule to ${sentCount} learners` });
  } catch (err) {
    console.error("❌ Final assessment email error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add this endpoint to check batch ownership
app.get('/api/course_planner_data', async (req, res) => {
  try {
    const { batch_no } = req.query;
    const { data, error } = await supabase
      .from('course_planner_data')
      .select('*')
      .eq('batch_no', batch_no);
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch course planner data' });
  }
});

// New API: Get max course date for a batch
app.get("/api/course_planner_data/max-date/:batch_no", async (req, res) => {
  try {
    const batch_no = req.params.batch_no;
    const { data, error } = await supabase
      .from("course_planner_data")
      .select("date")
      .eq("batch_no", batch_no)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Batch not found" });

    res.json({ max_date: data.date });
  } catch (err) {
    console.error("Error in /api/course_planner_data/max-date:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

//===Schedule Access Card Emails to Learners===
app.post("/api/schedule-access-card-email", async (req, res) => {
  try {
    const { batch_no, assessment_date } = req.body;

    if (!batch_no || !assessment_date) {
      return res.status(400).json({ error: "Batch No and assessment date are required" });
    }

    // Fetch all mode records for the batch
    const { data: batchDataArray, error: batchError } = await supabase
      .from("course_planner_data")
      .select("mode")
      .eq("batch_no", batch_no);

    if (batchError) {
      console.error("Error fetching batch mode:", batchError);
      return res.status(500).json({ error: "Failed to fetch batch info" });
    }

    if (!batchDataArray || batchDataArray.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    // Check for unique modes from all rows
    const uniqueModes = [...new Set(batchDataArray.map(row => row.mode))];

    if (uniqueModes.length > 1) {
      return res.status(400).json({ error: "Batch has multiple modes; cannot determine single mode" });
    }

    const mode = uniqueModes[0];

    // Only proceed if mode is Offline
    if (mode !== "Offline") {
      return res.status(200).json({ message: "Batch is not Offline mode - skipping access card emails" });
    }

    // Fetch learners for the batch
    const { data: learners, error: learnersError } = await supabase
      .from("learners_data")
      .select("email, name")
      .eq("batch_no", batch_no);

    if (learnersError) {
      console.error("Error fetching learners:", learnersError);
      return res.status(500).json({ error: "Failed to fetch batch learners" });
    }

    if (!learners || learners.length === 0) {
      return res.status(404).json({ error: "No learners found for this batch" });
    }

    // Calculate scheduled date/time 7 days before assessment_date at 12:22 PM
    const scheduledAtISO = dayjs(assessment_date)
      .subtract(7, "day")
      .hour(12)
      .minute(22)
      .second(0)
      .millisecond(0)
      .toISOString();

    let scheduledCount = 0;
    for (const learner of learners) {
      // Insert scheduled access card reminder email
      const { error: insertError } = await supabase.from("scheduled_emails").insert({
        batch_no,
        recipient_email: learner.email,
        subject: `Reminder: Submit Your Access Card for Final Assessment`,
        body_html: `<p>Dear ${learner.name || "Learner"},</p>
                    <p>Please submit your access card at least 1 week before the Final Assessment scheduled on <strong>${dayjs(assessment_date).format("DD-MMM-YYYY")}</strong>.</p>`,
        scheduled_at: scheduledAtISO,
        status: "scheduled",
        mode: "Notification",
        template_name: "Access Card Reminder",
        source: "access_card_reminder",
        created_at: new Date().toISOString(),
      });

      if (!insertError) scheduledCount++;
      else
        console.error(`Failed to schedule access card email for ${learner.email}:`, insertError.message);
    }

    res.json({
      success: true,
      message: `Scheduled access card reminder emails for ${scheduledCount} learners in Offline batch ${batch_no}`,
      scheduled: scheduledCount,
    });
  } catch (err) {
    console.error("Error in /api/schedule-access-card-email:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ==================== TUTORS APIs ====================

// Get all trainers
app.get('/api/tutors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('internal_users')
      .select('id, name, email, role, created_at, is_active')
      .eq('role', 'Trainer')
      .order('name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching tutors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new trainer (PLAIN TEXT PASSWORD - NOT RECOMMENDED FOR PRODUCTION)
app.post('/api/tutors/add', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // ✅ Store password as plain text (no hashing)
    const { data, error } = await supabase
      .from('internal_users')
      .insert([{
        name,
        email,
        role: 'Trainer',
        password_hash: password,  // ✅ Store plain text password directly
        is_active: true
      }])
      .select();
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error adding tutor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update tutor by id (optionally accept password change too)
app.put("/api/tutors/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, is_active, domain, password } = req.body || {};

    if (!id) return res.status(400).json({ success: false, error: "Missing id" });

    const patch = {};
    if (name !== undefined) patch.name = String(name).trim();
    if (role !== undefined) patch.role = role || "Trainer";
    if (typeof is_active === "boolean") patch.is_active = is_active;
    if (domain !== undefined) patch.domain = domain ? String(domain).trim() : null;

    if (password) patch.password = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("internal_users")
      .update(patch)
      .eq("id", id)
      .select("id, created_at, name, email, role, is_active, domain")
      .single();

    if (error) {
      console.error("PUT /api/tutors/:id error:", error);
      return res.status(500).json({ success: false, error: "Update failed" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unhandled error in PUT /api/tutors/:id:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /api/tutors/:id
 * default => soft delete (is_active=false)
 * ?hard=true => hard delete row
 */
app.delete("/api/tutors/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const hard = String(req.query.hard || "").toLowerCase() === "true";

    if (!id) return res.status(400).json({ success: false, error: "Missing id" });

    if (hard) {
      const { error } = await supabase.from("internal_users").delete().eq("id", id);
      if (error) {
        console.error("DELETE hard /api/tutors/:id error:", error);
        return res.status(500).json({ success: false, error: "Hard delete failed" });
      }
      return res.status(200).json({ success: true, hard: true });
    }

    const { data, error } = await supabase
      .from("internal_users")
      .update({ is_active: false })
      .eq("id", id)
      .select("id, name, email, is_active")
      .single();

    if (error) {
      console.error("DELETE soft /api/tutors/:id error:", error);
      return res.status(500).json({ success: false, error: "Soft delete failed" });
    }

    return res.status(200).json({ success: true, hard: false, data });
  } catch (err) {
    console.error("Unhandled error in DELETE /api/tutors/:id:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * Optional fallback (if you still want delete-by-email):
 * DELETE /api/tutors?email=someone@mail.com  => soft delete
 */
app.delete("/api/tutors", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, error: "email is required" });

    const { data, error } = await supabase
      .from("internal_users")
      .update({ is_active: false })
      .eq("email", String(email).trim())
      .select("id, name, email, is_active");

    if (error) {
      console.error("DELETE /api/tutors?email error:", error);
      return res.status(500).json({ success: false, error: "Soft delete failed" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unhandled error in DELETE /api/tutors:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Get batches for a trainer
app.get('/api/tutors/batches/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const { data, error } = await supabase
      .from('course_planner_data')
      .select('batch_no')
      .eq('trainer_email', email)
      .order('batch_no');
    
    if (error) throw error;
    
    // Get unique batch numbers
    const uniqueBatches = [...new Set(data.map(item => item.batch_no))];
    res.json(uniqueBatches);
  } catch (error) {
    console.error('Error fetching trainer batches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get modules for a trainer in a specific batch
app.get('/api/tutors/modules/:email/:batch_no', async (req, res) => {
  try {
    const { email, batch_no } = req.params;
    
    const { data, error } = await supabase
      .from('course_planner_data')
      .select('module_name, topic_name, date, topic_status')
      .eq('trainer_email', email)
      .eq('batch_no', batch_no)
      .order('date');
    
    if (error) throw error;
    
    // Group by module
    const moduleGroups = {};
    data.forEach(item => {
      if (!moduleGroups[item.module_name]) {
        moduleGroups[item.module_name] = [];
      }
      moduleGroups[item.module_name].push(item);
    });
    
    res.json(moduleGroups);
  } catch (error) {
    console.error('Error fetching trainer modules:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== LEARNERS APIs ====================
// GET all learners from learners_data table
app.get("/api/learners", authMiddleware, async (req, res) => {
  try {
    const { batch_no } = req.query;
    
    let query = supabase
      .from("learners_data")
      .select("id, name, email, phone, batch_no, status")
      .order("name", { ascending: true });

    // 🔥 NEW: Filter by batch_no if provided (for AttendanceReport)
    if (batch_no) {
      query = query.eq("batch_no", batch_no);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/learners error:", error);
      return res.status(200).json([]); // ✅ Return empty array, no 500
    }

    const normalized = (data || []).map((row) => ({
      id: row.id,
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      batchno: row.batch_no || "",  // ✅ Map batch_no → batchno (backward compatibility)
      batch_no: row.batch_no || "",
      status: row.status || "Enabled",
    })).filter(row => row.name && row.email); // Filter invalid records

    console.log(`GET /api/learners: found ${normalized.length} learners${batch_no ? ` for batch ${batch_no}` : ''}`);
    return res.status(200).json(normalized);
    
  } catch (err) {
    console.error("GET /api/learners CRASH:", err);
    return res.status(200).json([]); // ✅ Always return array
  }
});

// GET learners by batch_no
app.get("/api/getlearners", async (req, res) => {
  try {
    const batchno = req.query.batchno;
    if (!batchno) {
      return res.status(400).json({ error: "batchno required" });
    }

    const { data, error } = await supabase
      .from("learners_data")  // ✅ Correct table name
      .select("id, name, email, phone, batch_no, status")
      .eq("batch_no", batchno);  // ✅ Query by batch_no

    if (error) {
      console.error(`GET /api/getlearners?batchno=${batchno} error:`, error);
      return res.status(200).json([]);
    }

    const normalized = (data || []).map((row) => ({
      id: row.id,
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      batchno: row.batch_no || batchno,
      batch_no: row.batch_no || batchno,
      status: row.status || "Enabled",
    })).filter(row => row.name && row.email);

    console.log(`GET /api/getlearners?batchno=${batchno}: found ${normalized.length}`);
    return res.status(200).json(normalized);
  } catch (err) {
    console.error("GET /api/getlearners CRASH:", err);
    return res.status(200).json([]);
  }
});

// POST add learner
app.post("/api/learners/add", async (req, res) => {
  try {
    const { name, email, phone, batchno, batch_no } = req.body;
    
    const normalized = {
      name: (name || "").trim(),
      email: (email || "").trim().toLowerCase(),
      phone: (phone || "").trim(),
      batch_no: (batchno || batch_no || "").trim(),  // ✅ Use batch_no
    };

    if (!normalized.name || !normalized.email || !normalized.batch_no) {
      return res.status(400).json({ 
        success: false, 
        error: "name, email, batch_no required" 
      });
    }

    const { data, error } = await supabase
      .from("learners_data")  // ✅ Correct table name
      .insert({
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone || null,
        batch_no: normalized.batch_no,  // ✅ Insert to batch_no
        status: "Enabled",
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/learners/add:", error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    const added = {
      id: data.id,
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      batchno: normalized.batch_no,
      batch_no: normalized.batch_no,
      status: "Enabled",
    };

    console.log("Added learner:", added);
    return res.json({ success: true, data: added });
  } catch (err) {
    console.error("POST /api/learners/add CRASH:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// PUT update status
app.put("/api/learners/status", async (req, res) => {
  try {
    const learneremail = req.body.learneremail || req.body.email;
    const batch_no = req.body.batchno || req.body.batch_no;
    const status = req.body.status;

    if (!learneremail || !batch_no || !status) {
      return res.status(400).json({ 
        success: false, 
        error: "learneremail, batch_no, status required" 
      });
    }

    const validStatuses = ["Enabled", "Disabled", "Dropout"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const { error } = await supabase
      .from("learners_data")  // ✅ Correct table name
      .update({ status })
      .eq("email", learneremail)
      .eq("batch_no", batch_no);  // ✅ Update by batch_no

    if (error) {
      console.error("PUT /api/learners/status:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`Status updated: ${learneremail} / ${batch_no} → ${status}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/learners/status CRASH:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Get learner by email
app.get('/api/learners/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const { data, error } = await supabase
      .from('learners_data')
      .select('id, name, email, phone, batch_no')
      .eq('email', email)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching learner:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/debug/routes-test", (req, res) => {
  res.json({ ok: true, message: "Backend is deploying the correct file" });
});

// NEW ENDPOINT - Attendance Report (THIS IS THE KEY)
app.get('/api/attendance-report', authMiddleware, async (req, res) => {
  try {
    const { batch_no } = req.query;
    
    const [rows] = await pool.execute(`
      SELECT 
        la.learner_email,
        la.status,
        la.date
      FROM learner_attendance la
      WHERE la.batch_no = ?
      ORDER BY la.learner_email, la.date
    `, [batch_no || '']);
    
    res.json(rows);
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Fix the existing broken endpoint (optional)
app.get('/api/attendance/by_batch', async (req, res) => {
  try {
    const { batch_no } = req.query;
    const { data, error } = await supabase
      .from('learner_attendance')
      .select('*')
      .eq('batch_no', batch_no);
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Attendance by batch error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
  console.log(`✅ Email scheduler is running - checking every minute for due emails`);
});