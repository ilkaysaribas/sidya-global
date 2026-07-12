const { getRfq, patchRfq, convertToProforma } = require("../../_rfq-core.js");

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, "https://sidyaglobal.com");
    const id = req.query?.id || url.pathname.split("/").pop();
    const action = url.searchParams.get("action") || "";
    if (req.method === "GET") {
      const result = await getRfq(id);
      res.status(200).json(result);
      return;
    }
    if (req.method === "PATCH") {
      const result = await patchRfq(id, req);
      res.status(200).json(result);
      return;
    }
    if (req.method === "POST" && action === "convert-to-proforma") {
      const result = await convertToProforma(id);
      res.status(200).json(result);
      return;
    }
    if (req.method === "POST" && ["convert-to-order", "send-quote", "attachments", "notes"].includes(action)) {
      res.status(202).json({ ok: true, queued: true, action, message: "Aksiyon kaydedilebilir altyapıya hazırlandı; operasyon akışı admin notu olarak izlenecek." });
      return;
    }
    res.setHeader("Allow", "GET, PATCH, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "RFQ işlemi başarısız." });
  }
};
