const { createRfq, getRfq } = require("./_rfq-core.js");

module.exports = async (req, res) => {
  try {
    if (req.method === "POST") {
      const result = await createRfq(req);
      res.status(200).json(result);
      return;
    }
    if (req.method === "GET") {
      const url = new URL(req.url, "https://sidyaglobal.com");
      const id = url.searchParams.get("id");
      if (!id) {
        res.status(400).json({ error: "RFQ id zorunludur." });
        return;
      }
      const result = await getRfq(id);
      res.status(200).json(result);
      return;
    }
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const message = String(error.message || "RFQ işlemi başarısız.");
    res.status(error.statusCode || 500).json({ error: message });
  }
};
