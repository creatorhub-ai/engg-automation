// backend/migratePasswords.js
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

dotenv.config();

async function migratePasswords() {
  try {
    console.log("🔄 Starting password migration...");

    // 1. Fetch all users
    const { data: users, error } = await supabase.from("users").select("*");
    if (error) throw error;

    if (!users || users.length === 0) {
      console.log("⚠️ No users found in the database.");
      return;
    }

    let updatedCount = 0;

    // 2. Hash only plain-text passwords
    for (const user of users) {
      if (!user.password) continue;

      // Skip if already hashed (bcrypt hashes always start with $2b$ or $2a$)
      if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
        continue;
      }

      const hashed = await bcrypt.hash(user.password, 10);

      const { error: updateError } = await supabase
        .from("users")
        .update({ password: hashed })
        .eq("id", user.id);

      if (updateError) {
        console.error(`❌ Failed to update user ${user.email}:`, updateError.message);
      } else {
        updatedCount++;
        console.log(`✅ Password hashed for user: ${user.email}`);
      }
    }

    console.log(`🎉 Migration complete! ${updatedCount} users updated.`);
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  }
}

// Run the migration
migratePasswords();
