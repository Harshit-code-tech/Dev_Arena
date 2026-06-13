import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
    },
});

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    try {
        const info = await transporter.sendMail({
            from: `Dev Arena <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            text,
            html,
        });
        console.log('Email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

export const sendOTP = async (to: string, otp: string) => {
    const subject = 'Your Dev Arena One-Time Password (OTP)';
    const text = `Your OTP is: ${otp}. It will expire in 10 minutes.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Dev Arena Security</h2>
            <p>Your One-Time Password (OTP) for login is:</p>
            <h1 style="color: #4f46e5; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in 10 minutes. If you did not request this, please secure your account immediately.</p>
        </div>
    `;
    return sendEmail(to, subject, text, html);
};
