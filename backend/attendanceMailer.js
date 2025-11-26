import fs from "fs";
import csvParser from "csv-parser";
import nodemailer from "nodemailer";
import dayjs from "dayjs";

// Setup your transporter with credentials from environment
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.ATTENDANCE_EMAIL_USER,
    pass: process.env.ATTENDANCE_EMAIL_PASS,
  },
});

function isValidLearner(row) {
  // Checks for valid email and learner name, ignores NA or blank
  return (
    !!row["Email"] &&
    !!row["Learners"] &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row["Email"]) &&
    row["Learners"].trim().toUpperCase() !== "NA"
  );
}

async function sendEmail(toEmail, studentName, absentDates, sessionName) {
  const datesStr = absentDates.join(", ");
  await transporter.sendMail({
    from: `"ChipEdge" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Absence Notification",
    html: `
      <p>Dear ${studentName},</p>
      <p>You were absent for your enrolled course <b>${sessionName}</b> on: ${datesStr}</p>
      <p>Please maintain attendance for certification and placement eligibility.</p>
      <p>Regards,<br/>ChipEdge Team</p>
    `,
  });
}

/**
 * Parses the attendance CSV and sends mails to all absent learners.
 * @param {string} filePath path to the uploaded CSV
 * @returns {Promise<string>} Message such as "Emails sent to X learners"
 */
async function processAttendanceFile(filePath) {
  return new Promise((resolve, reject) => {
    const absentees = {};
    const rows = [];
    let dateCols = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("headers", (headers) => {
        // Pick columns that match date ("dd-Jul") and exclude Notes columns
        dateCols = headers.filter(
          (col) =>
            col &&
            /^\d{2}-Jul$/.test(col.trim()) && // columns like "21-Jul", "22-Jul"
            !/Notes/i.test(col)
        );
      })
      .on("data", (row) => {
        // Only consideration: valid learners and emails
        if (isValidLearner(row)) {
          rows.push(row);
        }
      })
      .on("end", async () => {
        try {
          for (const row of rows) {
            const absentDates = [];
            for (const dateCol of dateCols) {
              const val = String(row[dateCol] || "").trim().toUpperCase();
              // Mark as absent for A or OL
              if (val === "A" || val === "OL") {
                absentDates.push(dateCol);
              }
            }
            if (absentDates.length > 0) {
              absentees[row["Email"]] = {
                name: row["Learners"],
                absentDates,
              };
            }
          }
          let sentCount = 0;
          for (const [email, { name, absentDates }] of Object.entries(absentees)) {
            await sendEmail(email, name, absentDates, "Attendance Session");
            sentCount++;
          }
          resolve(`Emails sent to ${sentCount} learners`);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

export { processAttendanceFile };
