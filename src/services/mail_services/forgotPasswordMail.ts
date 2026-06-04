import nodemailer from "nodemailer";

// --- NODEMAILER CONFIGURATION ---
// Ideally, move this to a separate config/email.ts file
export const transporter = nodemailer.createTransport({
    service: "gmail", // Or your preferred email provider (SendGrid, AWS SES, etc.)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD, // Use an App Password, not your real password
    },
});