import { BigintIsh, ChainId, Percent, Trade, WETH } from "@uniswap/sdk";
import { SwapType } from "./constants";
import { getPair, getRoute, getToken, getTrade } from "./util";
import { BaseProvider } from "@ethersproject/providers";
import { uniRouterAbi } from "../abi";
import JSBI from "jsbi";
import Web3 from "web3";

const ROUTERV2_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
export default class Swap {
  web3: Web3;
  provider: BaseProvider;
  walletAddress: string;
  slippage: Percent;
  chainId: ChainId;

  constructor(
    web3: Web3,
    provider: BaseProvider,
    walletAddress: string,
    chainId: ChainId = ChainId.MAINNET,
    slippage: Percent = new Percent("100", "10000")
  ) {
    this.web3 = web3;
    this.slippage = slippage;
    this.chainId = chainId;
    this.walletAddress = walletAddress;
    this.provider = provider;
  }

  async createSwapData(
    tokenIn: string,
    tokenOut: string,
    amount: BigintIsh,
    swapType: SwapType
  ) {
    const uniRouterContract = new this.web3.eth.Contract(
      uniRouterAbi,
      ROUTERV2_ADDRESS
    );

    const _tokenIn = await getToken(this.web3, this.chainId, tokenIn);
    const _tokenOut = await getToken(this.web3, this.chainId, tokenOut);

    let trade: Trade;
    switch (swapType) {
      case SwapType.EXACT_TOKEN_FOR_ETH:
      case SwapType.EXACT_ETH_FOR_TOKEN: {
        const pair = await getPair(_tokenIn, _tokenOut, this.provider);
        const route = getRoute([pair], _tokenIn);
        trade = getTrade(amount, _tokenIn, route);
        break;
      }
      case SwapType.EXACT_TOKEN_FOR_TOKEN: {
        const pair1 = await getPair(
          _tokenIn,
          WETH[this.chainId],
          this.provider
        );
        const pair2 = await getPair(
          WETH[this.chainId],
          _tokenOut,
          this.provider
        );
        const route = getRoute([pair1, pair2], _tokenIn);
        trade = getTrade(amount, _tokenIn, route);
        break;
      }
    }

    const params = this.createSwapParams(trade, swapType);
    const data = uniRouterContract.methods[swapType](...params).encodeABI();
    return this.createTransactionParams(amount, data);
  }

  createSwapParams(trade: Trade, swapType: SwapType) {
    const amountIn = JSBI.BigInt(trade.inputAmount.raw);
    const amountOutMin = JSBI.toNumber(
      trade.minimumAmountOut(this.slippage).raw
    );
    const path = trade.route.path.map(({ address }) => address);
    const to = this.walletAddress;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

    switch (swapType) {
      case SwapType.EXACT_ETH_FOR_TOKEN:
        return [String(amountOutMin), path, to, deadline];
      case SwapType.EXACT_TOKEN_FOR_ETH:
      case SwapType.EXACT_TOKEN_FOR_TOKEN:
        return [String(amountIn), String(amountOutMin), path, to, deadline];
    }
  }

  private createTransactionParams(amount: BigintIsh, data: string) {
    return {
      from: this.walletAddress,
      to: ROUTERV2_ADDRESS,
      value: amount.toString(),
      data,
    };
  }
}
