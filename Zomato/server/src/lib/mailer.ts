import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const canSendEmail = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);

const transporter = canSendEmail
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });

export const sendMail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) => {
  const info = await transporter.sendMail({
    from: env.SMTP_FROM ?? "noreply@zomatoluxe.dev",
    to,
    subject,
    html,
    text,
  });

  if (!canSendEmail) {
    logger.info("Email captured by local stream transport", {
      to,
      subject,
      previewId: info.messageId,
    });
  }

  return info;
};
