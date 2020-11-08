import { ChainId, Percent, Trade } from "@uniswap/sdk";
import { SwapType } from "./constants";
import JSBI from "jsbi";
import { Wallet } from "./interfaces";

export default class Swap {
  wallet: Wallet;
  slippage: Percent;
  chainId: ChainId;

  constructor(
    wallet: Wallet,
    chainId: ChainId,
    slippage: Percent = new Percent("100", "10000")
  ) {
    this.slippage = slippage;
    this.chainId = chainId;
    this.wallet = wallet;
  }

  createSwapParams(trade: Trade, swapType: SwapType) {
    const amountIn = JSBI.BigInt(trade.inputAmount.raw);
    const amountOutMin = JSBI.toNumber(
      trade.minimumAmountOut(this.slippage).raw
    );
    const path = trade.route.path.map(({ address }) => address);
    const to = this.wallet.address;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

    switch (swapType) {
      case SwapType.EXACT_ETH_FOR_TOKEN:
        return [String(amountOutMin), path, to, deadline];
      case SwapType.EXACT_TOKEN_FOR_ETH:
      case SwapType.EXACT_TOKEN_FOR_TOKEN:
        return [String(amountIn), String(amountOutMin), path, to, deadline];
    }
  }
}
