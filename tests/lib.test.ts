import Web3 from "web3";
import UniswapManager from "../";
import { JsonRpcProvider } from "@ethersproject/providers";

describe("Uniswap Manager", function () {
  let manager;
  beforeAll(() => {
    const url = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`;
    const web3 = new Web3(url);
    const chainId = 1;
    manager = new UniswapManager(web3, chainId, new JsonRpcProvider(url));
  });

  it("can get token price", function () {
    const YFI = "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e";
    const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

    return manager.getPrice(YFI, USDT, (10 ** 18).toString()).then((result) => {
      console.log(result);
      expect(result).toBeDefined();
    });
  }, 15000);
});
