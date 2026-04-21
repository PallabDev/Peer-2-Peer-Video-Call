import { env } from "../config/env";

type SendMailInput = {
    to: string;
    subject: string;
    html: string;
};

const canSendMail = () => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

const sendMail = async ({ to, subject, html }: SendMailInput) => {
    if (!canSendMail()) {
        console.warn(`Skipping email to ${to} because Resend env vars are not configured.`);
        return;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [to],
            subject,
            html,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to send email: ${message}`);
    }
};

export const sendVerificationEmail = async (email: string, firstName: string, link: string) => {
    await sendMail({
        to: email,
        subject: "Verify your Callie account",
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;">
                <h2>Verify your email</h2>
                <p>Hi ${firstName},</p>
                <p>Tap the link below to verify your account and continue with Callie.</p>
                <p><a href="${link}">${link}</a></p>
                <p>If you did not create this account, you can ignore this email.</p>
            </div>
        `,
    });
};

export const sendResetPasswordEmail = async (email: string, firstName: string, link: string) => {
    await sendMail({
        to: email,
        subject: "Reset your Callie password",
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;">
                <h2>Password reset</h2>
                <p>Hi ${firstName},</p>
                <p>Tap the link below to reset your password.</p>
                <p><a href="${link}">${link}</a></p>
                <p>If you did not request a reset, you can ignore this email.</p>
            </div>
        `,
    });
};
