import { ChainId, Percent, Trade } from "@uniswap/sdk";
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

  createSwapParams(trade: Trade) {
    const amountOutMin = JSBI.toNumber(
      trade.minimumAmountOut(this.slippage).raw
    );
    const path = trade.route.path.map(({ address }) => address);
    const to = this.wallet.address;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins
    return [String(amountOutMin), path, to, deadline];
  }
}
