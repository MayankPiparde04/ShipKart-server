import cron from "node-cron";
import nodemailer from "nodemailer";
import ItemData from "../models/item.model.js";
import BoxData from "../models/box.model.js";

const STOCK_ALERT_EMAIL = "shipwise.kart@gmail.com";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildTableRows = (rows) =>
  rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:10px;border:1px solid #dbe2ef;font-size:14px;color:#1f2937;">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

const buildReportEmailHtml = ({ title, subtitle, headers, rows }) => {
  const tableBody = rows.length
    ? buildTableRows(rows)
    : `<tr><td colspan="${headers.length}" style="padding:12px;border:1px solid #dbe2ef;color:#6b7280;">No low-stock entries found.</td></tr>`;

  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="padding:16px 20px;background:#0f172a;color:#e2e8f0;">
          <h2 style="margin:0;font-size:20px;">${escapeHtml(title)}</h2>
          <p style="margin:8px 0 0 0;font-size:13px;color:#93c5fd;">${escapeHtml(subtitle)}</p>
        </div>
        <div style="padding:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                ${headers
                  .map(
                    (header) =>
                      `<th style="padding:10px;border:1px solid #dbe2ef;background:#e2e8f0;text-align:left;font-size:13px;color:#111827;">${escapeHtml(header)}</th>`,
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

const createTransporter = () => {
  if (!process.env.EMAIL_FROM || !process.env.EMAIL_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const sendDailyReports = async () => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[DAILY_STOCK_REPORT] Missing EMAIL_FROM or EMAIL_PASSWORD. Skipping report.");
    return;
  }

  const now = new Date();
  const reportDate = now.toISOString().slice(0, 10);
  const reportTitle = `ShipWise Daily Stock Alert - ${reportDate}`;

  const [lowStockItems, lowStockBoxes] = await Promise.all([
    ItemData.find({ quantity: { $lt: 50 }, deletedAt: null })
      .sort({ productName: 1 })
      .lean(),
    BoxData.find({ quantity: { $lt: 50 } })
      .sort({ box_name: 1 })
      .lean(),
  ]);

  const itemRows = lowStockItems.map((item) => [
    item.productName || "Unknown",
    item.category || "Uncategorized",
    Number(item.quantity || 0),
  ]);

  const boxRows = lowStockBoxes.map((box) => [
    box.box_name || "Unknown",
    Number(box.quantity || 0),
  ]);

  const itemEmail = {
    from: `"ShipWise Alerts" <${process.env.EMAIL_FROM}>`,
    to: STOCK_ALERT_EMAIL,
    subject: `${reportTitle} - Items`,
    html: buildReportEmailHtml({
      title: reportTitle,
      subtitle: "Items with stock below 50",
      headers: ["Name", "Category", "Current Count"],
      rows: itemRows,
    }),
  };

  const boxEmail = {
    from: `"ShipWise Alerts" <${process.env.EMAIL_FROM}>`,
    to: STOCK_ALERT_EMAIL,
    subject: `${reportTitle} - Boxes`,
    html: buildReportEmailHtml({
      title: reportTitle,
      subtitle: "Boxes with quantity below 50",
      headers: ["Name", "Current Quantity"],
      rows: boxRows,
    }),
  };

  await Promise.all([transporter.sendMail(itemEmail), transporter.sendMail(boxEmail)]);
  console.log(`[DAILY_STOCK_REPORT] Sent item and box reports for ${reportDate}`);
};

export const initializeDailyStockReportCron = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      await sendDailyReports();
    } catch (error) {
      console.error("[DAILY_STOCK_REPORT] Failed to send reports:", error.message);
    }
  });

  console.log("[DAILY_STOCK_REPORT] Cron initialized for 12:00 AM daily reports.");
};
