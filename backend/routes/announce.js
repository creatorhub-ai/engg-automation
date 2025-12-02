import express from "express";
import { pool } from "../db.js"; // or your Postgres client
import { sendRawEmail } from "../emailSender.js";

const announceRouter = express.Router();

// Get unique domains
announceRouter.get("/domains", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT domain FROM course_planner_data ORDER BY domain ASC`);
    res.json(rows.map(r => r.domain).filter(Boolean));
  } catch (err) {
    console.error("Error fetching domains:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get unique batch numbers
announceRouter.get("/batches", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT batch_no FROM course_planner_data ORDER BY batch_no ASC`);
    res.json(rows.map(r => r.batch_no));
  } catch (err) {
    console.error("Error fetching batches:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get learners by domain or batch_no
announceRouter.get("/learners", async (req, res) => {
  try {
    const { domain, batch_no } = req.query;

    if (!domain && !batch_no) {
      return res.status(400).json({ error: "domain or batch_no required" });
    }

    let batchNosForDomain = [];
    if(domain) {
      const { rows } = await pool.query(
        `SELECT DISTINCT batch_no FROM course_planner_data WHERE domain = $1`, [domain]
      );
      batchNosForDomain = rows.map(r => r.batch_no);
      if(batchNosForDomain.length === 0) {
        return res.json([]);
      }
    }

    let queryText = `SELECT DISTINCT id, name, email FROM learners_data WHERE batch_no = ANY($1::text[])`;
    let values = [];

    if(domain) {
      values = [batchNosForDomain];
    } else {
      values = [[batch_no]];
    }

    const { rows } = await pool.query(queryText, values);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching learners:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send announcement emails
announceRouter.post("/send", async (req, res) => {
  try {
    const { domain, batch_no, subject, message, messageType } = req.body;

    if ((!domain && !batch_no) || !subject || !message) {
      return res.status(400).json({ error: "domain or batch_no, subject and message are required" });
    }

    // determine batch numbers to target
    let batchNos = [];
    if(domain) {
      const { rows } = await pool.query(
        `SELECT DISTINCT batch_no FROM course_planner_data WHERE domain = $1`, [domain]
      );
      batchNos = rows.map(r => r.batch_no);
      if(batchNos.length === 0) {
        return res.status(400).json({ error: "No batches found for the selected domain" });
      }
    } else if(batch_no) {
      batchNos = [batch_no];
    }

    // get learners emails
    const values = [batchNos];
    const { rows: learners } = await pool.query(
      `SELECT DISTINCT name, email FROM learners_data WHERE batch_no = ANY($1::text[]) AND email IS NOT NULL`,
      values
    );

    if(learners.length === 0) {
      return res.status(400).json({ error: "No learners found for selected batch/domain" });
    }

    // format email content based on messageType if needed, e.g. plain text vs html
    let htmlContent;
    if(messageType === "link") {
      htmlContent = `<p><a href="${message}" target="_blank" rel="noopener noreferrer">${message}</a></p>`;
    } else if(messageType === "image") {
      htmlContent = `<img src="${message}" alt="Announcement Image" style="max-width:100%"/>`;
    } else if(messageType === "file") {
      // For file - you need to have file hosting or attachment mechanism; for now treat as link
      htmlContent = `<p>Download file: <a href="${message}" target="_blank" rel="noopener noreferrer">${message}</a></p>`;
    } else {
      // For text inputs - render message as is with paragraph breaks
      htmlContent = `<p>${message.replace(/\n/g, "<br/>")}</p>`;
    }

    const subjectLine = subject;

    // Send emails sequentially or in batches; here simple sequential with await
    for(const learner of learners) {
      await sendRawEmail({
        to: learner.email,
        subject: subjectLine,
        html: `<p>Dear ${learner.name || "Learner"},</p>` + htmlContent,
      });
    }

    res.json({ success: true, sentTo: learners.length });
  } catch (err) {
    console.error("Failed sending announcement emails:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default announceRouter;
