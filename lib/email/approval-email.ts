import "server-only";

type ApprovalEmailParams = {
  applicantId: string;
  email: string;
  firstName: string;
  preferredName: string | null;
  inviteLink: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function getResendErrorMessage(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return null;
}

export async function sendApprovalEmail({
  applicantId,
  email,
  firstName,
  preferredName,
  inviteLink,
}: ApprovalEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error(
      "Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.",
    );
  }

  const displayName = preferredName?.trim() || firstName.trim() || "there";
  const safeDisplayName = escapeHtml(displayName);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `applicant-approval/${applicantId}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject: "You’re approved to join Trinket Troop!",
      text: [
        `Hi ${displayName},`,
        "",
        "Your application to join the Trinket Troop beta has been approved!",
        "",
        "We’re excited to welcome you into the community. Set up your account here:",
        inviteLink,
        "",
        "This link is just for you — don't share it.",
        "",
        "Sincerely,",
        "The Trinket Troop team",
      ].join("\n"),
      html: `
        <div style="background:#fbe9d1;padding:32px 16px;font-family:Arial,sans-serif;color:#877c27">
          <div style="margin:0 auto;max-width:560px;border:1px solid #e2d8cb;border-radius:20px;background:#fbf7f1;padding:40px;box-shadow:0 8px 24px rgba(135,124,39,0.08)">
            <div style="margin-bottom:24px;display:inline-block;border-radius:999px;background:#f9c566;padding:8px 14px;color:#877c27;font-size:14px;font-weight:600">
              Beta approved
            </div>
            <h1 style="margin:0 0 20px;font-size:32px;line-height:1.2;color:#877c27">
              Welcome to the troop!
            </h1>
            <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Hi ${safeDisplayName},</p>
            <p style="margin:0 0 16px;font-size:17px;line-height:1.7">
              Great news—your application to join the Trinket Troop beta has been approved!
            </p>
            <p style="margin:0 0 16px;font-size:17px;line-height:1.7">
              We’re excited to welcome you into a friendlier way to buy, sell, and trade secondhand treasures with people in your neighborhood.
            </p>
            <p style="margin:0 0 28px;font-size:17px;line-height:1.7">
              Set up your account to get started:
            </p>
            <p style="margin:0 0 28px;text-align:center">
              <a href="${inviteLink}" style="display:inline-block;background:#cc5c53;color:#fdfaf7;padding:14px 28px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none">
                Set up your account
              </a>
            </p>
            <p style="margin:0 0 28px;font-size:14px;color:#87835e">
              This link is just for you — don't share it.
            </p>
            <p style="margin:0;color:#87835e;font-size:16px;line-height:1.6">
              Warmly,<br />
              The Trinket Troop team
            </p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const providerMessage = getResendErrorMessage(payload);

    throw new Error(
      providerMessage
        ? `Resend could not send the email: ${providerMessage}`
        : `Resend could not send the email (HTTP ${response.status}).`,
    );
  }
}
