const fs = require("fs");
const uniRouterAbi = JSON.parse(fs.readFileSync("abi/unirouter.json", "utf8"));
const uniAdapterAbi = JSON.parse(
  fs.readFileSync("abi/uniadapter.json", "utf8")
);
const uniStakingAbi = JSON.parse(
  fs.readFileSync("abi/unistaking.json", "utf8")
);
const uniLPAbi = JSON.parse(fs.readFileSync("abi/unilp.json", "utf8"));
const erc20Abi = JSON.parse(fs.readFileSync("abi/erc20.json", "utf8"));

module.exports = {
  uniRouterAbi,
  uniAdapterAbi,
  uniStakingAbi,
  uniLPAbi,
  erc20Abi,
};
