const MAX_BODY_SIZE = 8 * 1024 * 1024;

const collectBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const parseMultipart = (buffer, contentType) => {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw new Error("Missing multipart boundary.");
  const raw = buffer.toString("latin1");
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  const files = [];

  for (const part of parts) {
    const cleanPart = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = cleanPart.indexOf("\r\n\r\n");
    if (separatorIndex === -1) continue;
    const rawHeaders = cleanPart.slice(0, separatorIndex);
    const rawBody = cleanPart.slice(separatorIndex + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
    if (!name) continue;

    if (filename) {
      const fileBuffer = Buffer.from(rawBody, "latin1");
      if (fileBuffer.length) {
        files.push({
          filename,
          contentType: mimeType,
          content: fileBuffer.toString("base64"),
        });
      }
    } else {
      fields[name] = Buffer.from(rawBody, "latin1").toString("utf8").trim();
    }
  }

  return { fields, files };
};

const sendResendEmail = async ({ fields, files }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is not configured.");
    error.statusCode = 501;
    throw error;
  }

  const to = process.env.B2B_TO_EMAIL || "info@sidyaglobal.com";
  const from = process.env.B2B_FROM_EMAIL || "Sidya Global <onboarding@sidyaglobal.com>";
  const subject = `B2B buyer onboarding - ${fields.company || "New request"}`;
  const text = [
    "Sidya Global B2B buyer onboarding",
    "",
    `Company: ${fields.company || "-"}`,
    `Authorized contact: ${fields.contact || "-"}`,
    `Email: ${fields.email || "-"}`,
    `Destination country: ${fields.country || "-"}`,
    `Tax / registration number: ${fields.tax || "-"}`,
    `Incoterm: ${fields.incoterm || "-"}`,
    "",
    "Notes:",
    fields.notes || "-",
    "",
    "Uploaded files:",
    ...(files.length ? files.map((file, index) => `${index + 1}. ${file.filename}`) : ["No file uploaded"]),
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      attachments: files.map((file) => ({
        filename: file.filename,
        content: file.content,
        content_type: file.contentType,
      })),
    }),
  });

  if (!response.ok) {
    const error = new Error(await response.text());
    error.statusCode = response.status;
    throw error;
  }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) throw new Error("Expected multipart/form-data.");
    const body = await collectBody(req);
    const parsed = parseMultipart(body, contentType);
    await sendResendEmail(parsed);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "B2B request failed." });
  }
};
