import fetch from "node-fetch";

export async function sendEmail({ to, subject, text, html }) {
  const response = await fetch(
    `${process.env.EMAIL_RELAY_URL}/send-mail`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-secret": process.env.RELAY_SECRET,
      },
      body: JSON.stringify({ to, subject, text, html }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }

  return true;
}
