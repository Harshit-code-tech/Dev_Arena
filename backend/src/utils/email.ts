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
    const subject = 'DevArena Security: Your One-Time Password';
    const text = `Your OTP is: ${otp}. It will expire in 10 minutes.`;
    const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc; border-radius: 12px;">
            <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); text-align: center;">
                <h1 style="color: #0f172a; margin-top: 0; font-size: 24px; font-weight: 700;">DevArena Security</h1>
                <p style="color: #64748b; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
                    You recently requested a One-Time Password (OTP) to authenticate your account. Please use the code below to proceed:
                </p>
                <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0;">
                    <h2 style="color: #38bdf8; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: 800;">${otp}</h2>
                </div>
                <p style="color: #ef4444; font-size: 14px; font-weight: 600; margin-bottom: 30px;">
                    ⏱️ This code will expire in 10 minutes.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                    If you did not request this OTP, please ignore this email or contact support if you have security concerns. Please do not reply to this email.
                </p>
            </div>
        </div>
    `;
    return sendEmail(to, subject, text, html);
};
