import Web3 from 'web3';
import { getNetwork } from '@ethersproject/networks';
import { getDefaultProvider, BaseProvider } from '@ethersproject/providers';
import {
  WETH, ChainId, BigintIsh, Trade,
} from '@uniswap/sdk';
import {
  getToken, getPair, getRoute, getTrade,
} from './util';
import { ETH } from './constants';

export {};

export default class Uniswap {
  web3: any;

  chainId: ChainId;

  provider: BaseProvider;

  constructor(
    web3: any,
    chainId: ChainId,
    provider = getDefaultProvider(getNetwork(chainId)),
  ) {
    this.web3 = web3;
    this.chainId = chainId;
    this.provider = provider;
  }

  swap() {}

  /**
   * Get the price for the given token by comparing with another token (currency).
   * @param tokenAddress A token address you want to know price.
   * @param currencyAddress (optional) A token address to be used as currency.
   * @param amount (optional) An amount of token to calculate the price.
   *
   * @returns A promise of trade object.
   * Then, it can be used to get token price against currency token. For example,
   * Call `trade.outputAmount.toSignificant(6)` to get the price.
   */
  async getPrice(
    tokenAddress: string,
    currencyAddress: string,
    amount: BigintIsh,
  ): Promise<Trade> {
    const isInputETH = tokenAddress === ETH;
    const isOutputETH = currencyAddress === ETH;
    const inputToken = isInputETH
      ? WETH[this.chainId]
      : await getToken(
        this.web3,
        this.chainId,
        Web3.utils.toChecksumAddress(tokenAddress),
      );
    const outputToken = isOutputETH
      ? WETH[this.chainId]
      : await getToken(
        this.web3,
        this.chainId,
        Web3.utils.toChecksumAddress(currencyAddress),
      );
    let route;
    if (isInputETH || isOutputETH) {
      const pair1 = await getPair(inputToken, outputToken, this.provider);
      route = getRoute([pair1], inputToken);
    } else {
      const pair1 = await getPair(
        inputToken,
        WETH[this.chainId],
        this.provider,
      );
      const pair2 = await getPair(
        WETH[this.chainId],
        outputToken,
        this.provider,
      );
      route = getRoute([pair1, pair2], inputToken);
    }
    return getTrade(amount, inputToken, route);
  }
}
