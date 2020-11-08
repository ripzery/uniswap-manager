const fs = require("fs");
export const uniRouterAbi = JSON.parse(
  fs.readFileSync("abi/unirouter.json", "utf8")
);
export const uniAdapterAbi = JSON.parse(
  fs.readFileSync("abi/uniadapter.json", "utf8")
);
export const uniStakingAbi = JSON.parse(
  fs.readFileSync("abi/unistaking.json", "utf8")
);
export const uniLPAbi = JSON.parse(fs.readFileSync("abi/unilp.json", "utf8"));
export const erc20Abi = JSON.parse(fs.readFileSync("abi/erc20.json", "utf8"));
