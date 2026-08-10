import "server-only";
import { sendSms } from "../client";

type ApprovalTextParams = {
    phoneNumber: string;
    firstName: string;
    preferredName: string | null;
    inviteLink: string;
};

export async function sendApprovalText({
    phoneNumber,
    firstName,
    preferredName,
    inviteLink,
}: ApprovalTextParams) {
    const displayName = preferredName?.trim() || firstName.trim() || "there";

    await sendSms(
        phoneNumber,
        `Hey ${displayName}, you're approved for Trinket Troop! Set up your account: ${inviteLink}`,
    );
}