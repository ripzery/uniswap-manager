export {};

import { ETH } from "./constants";
import Web3 from "web3";
import { getNetwork } from "@ethersproject/networks";
import { getDefaultProvider, BaseProvider } from "@ethersproject/providers";
import { getToken, getPair, getRoute, getTrade } from "./util";
import { WETH, ChainId, BigintIsh } from "@uniswap/sdk";

export default class Uniswap {
  web3: any;
  chainId: ChainId;
  provider: BaseProvider;

  constructor(
    web3: any,
    chainId: ChainId,
    provider = getDefaultProvider(getNetwork(chainId))
  ) {
    this.web3 = web3;
    this.chainId = chainId;
    this.provider = provider;
  }

  swap() {}

  /**
   * Get the price for given token comparing with another token (currency).
   * @param tokenAddress An address for token you want to know price.
   * @param currencyAddress (optional) An address for token used for determine price.
   * @param amount (optional) An amount of token to calculate the price.
   *
   * @returns An amount of currency token.
   */
  async getPrice(
    tokenAddress: string,
    currencyAddress: string,
    amount: BigintIsh
  ) {
    const isInputETH = tokenAddress === ETH;
    const isOutputETH = currencyAddress === ETH;
    const inputToken = isInputETH
      ? WETH[this.chainId]
      : await getToken(
          this.web3,
          this.chainId,
          Web3.utils.toChecksumAddress(tokenAddress)
        );
    const outputToken = isOutputETH
      ? WETH[this.chainId]
      : await getToken(
          this.web3,
          this.chainId,
          Web3.utils.toChecksumAddress(currencyAddress)
        );
    let route;
    if (isInputETH || isOutputETH) {
      const inputPair = await getPair(inputToken, outputToken, this.provider);
      route = getRoute([inputPair], inputToken);
    } else {
      const inputPair = await getPair(
        inputToken,
        WETH[this.chainId],
        this.provider
      );
      const outputPair = await getPair(
        WETH[this.chainId],
        outputToken,
        this.provider
      );
      route = getRoute([inputPair, outputPair], inputToken);
    }
    const trade = getTrade(amount, inputToken, route);
    return trade.outputAmount.toSignificant(6);
  }
}
