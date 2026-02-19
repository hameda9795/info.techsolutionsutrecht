import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send({ message: 'Only POST requests allowed' });
    }

    const { to, subject, html, attachments } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).send({ message: 'Missing required fields' });
    }

    // Create transporter using environment variables
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        const mailOptions = {
            from: `"TechSolutionsUtrecht" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
            attachments
        };

        await transporter.sendMail(mailOptions);

        res.status(200).send({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).send({ message: 'Failed to send email', error: error.message });
    }
}
