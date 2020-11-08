import { ChainId, JSBI, Percent, WETH } from "@uniswap/sdk";
import Web3 from "web3";
import { getPair, getRoute, getToken, getTrade } from "../src/util";
import { JsonRpcProvider } from "@ethersproject/providers";
import Swap from "../src/swap";

const TIMEOUT = 15000;
describe("Swap", function () {
  let web3, provider, swap, wallet, ethToken, erc20Token;
  const chainId = ChainId.MAINNET;
  const YFI = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e";

  beforeAll(async () => {
    const url = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`;
    web3 = new Web3(url);
    provider = new JsonRpcProvider(url);
    wallet = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
    swap = new Swap(wallet, chainId);
    ethToken = WETH[chainId];
    erc20Token = await getToken(web3, chainId, YFI);
  });

  it(
    "can get swap params when swap eth to erc20",
    async function () {
      // Prepare
      const pair = await getPair(ethToken, erc20Token, provider);
      const route = getRoute([pair], ethToken);
      const trade = getTrade((10 ** 18).toString(), ethToken, route);

      // Action
      const data = swap.createSwapParams(trade);

      // Assertion
      const minimumAmount = JSBI.toNumber(
        trade.minimumAmountOut(new Percent("100", "10000")).raw
      ).toString();

      expect(data).toHaveLength(4);
      expect(data[0]).toEqual(minimumAmount);
      expect(data[1]).toEqual([ethToken.address, erc20Token.address]);
      expect(data[2]).toBe(wallet.address);
      expect(data[3]).toBeDefined();
    },
    TIMEOUT
  );

  it(
    "can get swap params when swap erc20 to eth",
    async function () {
      // Prepare
      const pair = await getPair(ethToken, erc20Token, provider);
      const route = getRoute([pair], erc20Token);
      const trade = getTrade((10 ** 18).toString(), erc20Token, route);

      // Action
      const data = swap.createSwapParams(trade);

      // Assertion
      const minimumAmount = JSBI.toNumber(
        trade.minimumAmountOut(new Percent("100", "10000")).raw
      ).toString();

      expect(data).toHaveLength(4);
      expect(data[0]).toEqual(minimumAmount);
      expect(data[1]).toEqual([erc20Token.address, ethToken.address]);
      expect(data[2]).toBe(wallet.address);
      expect(data[3]).toBeDefined();
    },
    TIMEOUT
  );
});
