// pages/api/save-classroom-matrix.js

// This API now expects:
// {
//   occupancyRows: [{ classroom_name, slot, batch_no, occupancy_start, occupancy_end }, ...],
//   weeks: [{ year, month, monthNum, weekNum, weekStart, key }, ...]
// }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { occupancyRows, weeks } = body;

    if (!Array.isArray(occupancyRows) || !Array.isArray(weeks)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    // TODO: Replace this with actual DB persistence (e.g. Supabase)
    // Example pseudo‑code:
    // const { data, error } = await supabase
    //   .from("classroom_occupancy")
    //   .insert(occupancyRows, { upsert: true });

    console.log("Saving classroom_occupancy rows:", occupancyRows.length);
    console.log("Weeks meta rows:", weeks.length);

    return res.status(200).json({ ok: true, message: "Matrix saved" });
  } catch (err) {
    console.error("save-classroom-matrix error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
