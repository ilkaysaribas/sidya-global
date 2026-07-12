const { getRfq } = require("../_rfq-core.js");

module.exports = async (req, res) => {
  try {
    const id = req.query?.id || new URL(req.url, "https://sidyaglobal.com").pathname.split("/").pop();
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const result = await getRfq(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "RFQ getirilemedi." });
  }
};
