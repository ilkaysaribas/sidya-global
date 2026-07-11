const backendConfigHandler = require("./backend-config");

module.exports = async (req, res) => {
  req.query = { ...(req.query || {}), mailCrm: "mail-settings" };
  return backendConfigHandler(req, res);
};
