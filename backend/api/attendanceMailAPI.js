import fs from "fs";
import path from "path";
import formidable from "formidable";
import * as XLSX from "xlsx";
import { processAttendanceFile } from "../attendanceMailer.js";

// Disable Next.js body parser if using Next.js
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function attendanceMailAPI(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Step 1: Parse uploaded file
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);
    const file = files?.file?.[0] || files?.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Step 2: Ensure it's CSV, or convert XLSX → CSV
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const filePath = path.join(uploadDir, file.originalFilename);
    fs.renameSync(file.filepath, filePath);

    let csvPath = filePath;

    if (file.originalFilename.endsWith(".xlsx")) {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvData = XLSX.utils.sheet_to_csv(sheet);
      csvPath = filePath.replace(".xlsx", ".csv");
      fs.writeFileSync(csvPath, csvData);
    }

    // Step 3: Process attendance file and send mails
    const message = await processAttendanceFile(csvPath);

    // Step 4: Clean up files
    fs.unlinkSync(csvPath);
    if (filePath !== csvPath) fs.unlinkSync(filePath);

    // Step 5: Send response
    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
