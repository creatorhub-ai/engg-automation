import fetch from "node-fetch";
import { supabase } from "./supabaseClient.js";

export async function getOrCreateForm(batchNo, startDate) {
  // 1. Check Supabase first
  const { data: existing, error: selectError } = await supabase
    .from("forms")
    .select("form_url, sheet_url")
    .eq("batch_no", batchNo)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    throw selectError;
  }

  if (existing && existing.form_url) {
    console.log(`🔄 Reusing existing form for batch ${batchNo}`);
    return existing.form_url;
  }

  // 2. Call Apps Script only if no record exists
  const response = await fetch("YOUR_APPS_SCRIPT_WEBAPP_URL", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_no: batchNo, start_date: startDate }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Failed to create form via Apps Script");
  }

  // 3. Save new form into Supabase
  const { error: insertError } = await supabase.from("forms").insert({
    batch_no: batchNo,
    form_url: data.form_url,
    sheet_url: data.sheet_url,
  });

  if (insertError) throw insertError;

  console.log(`✅ Created new form for batch ${batchNo}: ${data.form_url}`);
  return data.form_url;
}
