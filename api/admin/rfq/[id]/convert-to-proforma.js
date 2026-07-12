const { convertToProforma } = require("../../../_rfq-core.js");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const id = req.query?.id || new URL(req.url, "https://sidyaglobal.com").pathname.split("/").slice(-2)[0];
    const result = await convertToProforma(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Proformaya dönüştürülemedi." });
  }
};
