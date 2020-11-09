import { ChainId, JSBI, Percent, Token, WETH } from "@uniswap/sdk";
import Web3 from "web3";
import { getPair, getRoute, getToken, getTrade } from "../src/util";
import { JsonRpcProvider } from "@ethersproject/providers";
import Swap from "../src/swap";
import { SwapType } from "../src/constants";

const TIMEOUT = 15000;
describe("Swap", function () {
  let web3, provider, swap: Swap, wallet, ethToken: Token, erc20Token: Token;
  const chainId = ChainId.MAINNET;
  const YFI = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e";
  const ROUTERV2_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  beforeAll(async () => {
    const url = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`;
    web3 = new Web3(url);
    provider = new JsonRpcProvider(url);
    wallet = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
    swap = new Swap(web3, provider, wallet.address, chainId);
    ethToken = WETH[chainId];
    erc20Token = await getToken(web3, chainId, YFI);
  });
  //test
  describe("createSwapData", function () {
    it("can create swap data for eth and erc20 pair", async function () {
      const amount = (10 ** 18).toString();
      const result = await swap.createSwapData(
        erc20Token.address,
        ethToken.address,
        amount,
        SwapType.EXACT_TOKEN_FOR_ETH
      );
      expect(result.from).toBe(wallet.address);
      expect(result.to).toBe(ROUTERV2_ADDRESS);
      expect(result.value).toBe(amount);
      expect(result.data).toBeDefined();
    });
  });

  describe("createSwapParam", function () {
    it(
      "can get swap params when swap exact eth to erc20",
      async function () {
        // Prepare
        const pair = await getPair(ethToken, erc20Token, provider);
        const route = getRoute([pair], ethToken);
        const trade = getTrade((10 ** 18).toString(), ethToken, route);

        // Action
        const data = swap.createSwapParams(trade, SwapType.EXACT_ETH_FOR_TOKEN);

        // Assertion
        const minimumAmount = JSBI.toNumber(
          trade.minimumAmountOut(new Percent("100", "10000")).raw
        );

        expect(data).toHaveLength(4);
        expect(data[0]).toEqual(String(minimumAmount));
        expect(data[1]).toEqual([ethToken.address, erc20Token.address]);
        expect(data[2]).toBe(wallet.address);
        expect(data[3]).toBeDefined();
      },
      TIMEOUT
    );

    it(
      "can get swap params when swap exact erc20 to eth",
      async function () {
        // Prepare
        const pair = await getPair(ethToken, erc20Token, provider);
        const route = getRoute([pair], erc20Token);
        const trade = getTrade((10 ** 18).toString(), erc20Token, route);

        // Action
        const data = swap.createSwapParams(trade, SwapType.EXACT_TOKEN_FOR_ETH);

        // Assertion
        const amountIn = JSBI.toNumber(trade.inputAmount.raw);
        const minimumAmountOut = JSBI.toNumber(
          trade.minimumAmountOut(new Percent("100", "10000")).raw
        );

        expect(data).toHaveLength(5);
        expect(data[0]).toEqual(String(amountIn));
        expect(data[1]).toEqual(String(minimumAmountOut));
        expect(data[2]).toEqual([erc20Token.address, ethToken.address]);
        expect(data[3]).toBe(wallet.address);
        expect(data[4]).toBeDefined();
      },
      TIMEOUT
    );

    it(
      "can get swap params when swap exact erc20 to erc20",
      async function () {
        // Prepare
        const usdtToken = await getToken(
          web3,
          chainId,
          "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        );
        const pairTokenEth = await getPair(erc20Token, ethToken, provider);
        const pairEthToken = await getPair(ethToken, usdtToken, provider);
        const route = getRoute([pairTokenEth, pairEthToken], erc20Token);
        const trade = getTrade((10 ** 18).toString(), erc20Token, route);

        // Action
        const data = swap.createSwapParams(
          trade,
          SwapType.EXACT_TOKEN_FOR_TOKEN
        );

        // Assertion
        const amountIn = JSBI.toNumber(trade.inputAmount.raw);
        const minimumAmountOut = JSBI.toNumber(
          trade.minimumAmountOut(new Percent("100", "10000")).raw
        );

        expect(data).toHaveLength(5);
        expect(data[0]).toEqual(String(amountIn));
        expect(data[1]).toEqual(String(minimumAmountOut));
        expect(data[2]).toEqual([
          erc20Token.address,
          ethToken.address,
          usdtToken.address,
        ]);
        expect(data[3]).toBe(wallet.address);
        expect(data[4]).toBeDefined();
      },
      TIMEOUT
    );
  });
});
