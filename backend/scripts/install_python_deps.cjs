// Installs the Python packages (openpyxl) that the Course Planner scripts need.
// Runs automatically on `npm install` via the "postinstall" hook so the Render
// deploy environment gets openpyxl without any dashboard/build-command changes.
//
// Best-effort by design: it tries the available Python interpreters and never
// fails `npm install` (so local dev without Python still installs Node deps).
const { spawnSync } = require("child_process");
const path = require("path");

const requirements = path.join(__dirname, "..", "requirements.txt");
// Prefer python3 on Linux (Render); python/py on Windows dev machines.
const candidates =
  process.platform === "win32" ? ["python", "py"] : ["python3", "python"];

let installed = false;
for (const py of candidates) {
  const res = spawnSync(
    py,
    ["-m", "pip", "install", "--user", "-r", requirements],
    { stdio: "inherit" }
  );
  if (!res.error && res.status === 0) {
    installed = true;
    break;
  }
}

if (installed) {
  console.log("[postinstall] Python deps (openpyxl) installed for Course Planner.");
} else {
  console.warn(
    "[postinstall] Could not install Python deps (openpyxl). " +
      "The Course Planner Generator will not work until they are installed " +
      "manually: pip install -r backend/requirements.txt"
  );
}
