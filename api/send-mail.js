const backendConfigHandler = require("./backend-config");

module.exports = async (req, res) => {
  req.query = { ...(req.query || {}), mailCrm: "send-mail" };
  return backendConfigHandler(req, res);
};
