import fetch from "node-fetch";

export async function sendEmail({ to, subject, text, html }) {
  const RELAY_URL = process.env.EMAIL_RELAY_URL;
  const RELAY_SECRET = process.env.RELAY_SECRET;

  if (!RELAY_URL || !RELAY_SECRET) {
    throw new Error("Email relay configuration missing");
  }

  const response = await fetch(`${RELAY_URL}/send-mail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-relay-secret": RELAY_SECRET,
    },
    body: JSON.stringify({ to, subject, text, html }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Relay email failed");
  }

  return true;
}
