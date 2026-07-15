const backendConfigHandler = require("./backend-config");

module.exports = async (req, res) => {
  req.query = { ...(req.query || {}), mailCrm: "crm-center" };
  return backendConfigHandler(req, res);
};
