export {};

import Web3 from "web3";
import { BaseProvider } from "@ethersproject/providers";
import { erc20Abi } from "../abi";

import {
  Token,
  Fetcher,
  Route,
  Pair,
  Trade,
  TokenAmount,
  TradeType,
  Currency,
  BigintIsh,
  WETH,
  ChainId,
} from "@uniswap/sdk";
import { ETH } from "./constants";

export async function getToken(web3: Web3, chainId: ChainId, address: string) {
  if (address === ETH) {
    return WETH[chainId];
  }

  const decimals = await getTokenDecimal(web3, address);
  const symbol = await getTokenSymbol(web3, address);
  return new Token(chainId, address, decimals, symbol);
}

export function getPair(token1: Token, token2: Token, provider: BaseProvider) {
  return Fetcher.fetchPairData(token1, token2, provider);
}

export function getRoute(pairs: Pair[], input: Currency) {
  return new Route(pairs, input);
}

export function getTrade(amount: BigintIsh, token: Token, route: Route): Trade {
  try {
    return new Trade(
      route,
      new TokenAmount(token, amount),
      TradeType.EXACT_INPUT
    );
  } catch (err) {
    throw new Error(`${route.output.symbol} is not listed yet`);
  }
}

export function checkAddress(address: string, error = "Invalid address") {
  if (!Web3.utils.isAddress(address)) {
    throw Error(error);
  }
  return true;
}

function getTokenSymbol(web3: Web3, tokenAddress: string) {
  const contract = new web3.eth.Contract(erc20Abi, tokenAddress);
  return contract.methods
    .symbol()
    .call()
    .then((symbol) => symbol.toUpperCase());
}

function getTokenDecimal(web3: Web3, tokenAddress) {
  const contract = new web3.eth.Contract(erc20Abi, tokenAddress);
  return contract.methods.decimals().call().then(parseInt);
}
