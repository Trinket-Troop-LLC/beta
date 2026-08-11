import "server-only";
import twilio from "twilio";

export async function sendSms(to: string, body: string) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        throw new Error(
            "Text delivery is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
        );
    }

    const client = twilio(accountSid, authToken);

    await client.messages.create({
        body,
        from: fromNumber,
        to,
    });
}