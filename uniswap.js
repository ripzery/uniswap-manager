const { createEthClient } = require("./client");
const chalk = require("chalk");
const { uniRouterAbi, erc20Abi, uniLPAbi } = require("./abi");
const { ethers } = require("ethers");
const ethUtil = require("ethereumjs-util");
const { signUniswapPermit } = require("./signature");
const math = require("./math");
const {
  getTokenDecimal,
  getTokenSymbol,
  approveTokenIfNeeded,
} = require("./token");
const JSBI = require("jsbi");
const sigUtil = require("eth-sig-util");
const dotenv = require("dotenv");
dotenv.config();
const {
  Token,
  WETH,
  Fetcher,
  Percent,
  Route,
  Trade,
  TokenAmount,
  TradeType,
  ChainId,
} = require("@uniswap/sdk");
const token = require("./token");

const { web3, provider } = createEthClient();
const chainId = parseInt(process.env.CHAIN_ID);

const UNIROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const SLIPPAGE = new Percent("500", "10000"); // 3%
const uniRouterContract = new web3.eth.Contract(
  uniRouterAbi,
  UNIROUTER_ADDRESS
);

const DAI = new Token(
  chainId,
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  18,
  "DAI"
);

const USDT = new Token(
  chainId,
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  6,
  "USDT"
);

const ETH = WETH[chainId];

async function getToken(address) {
  const decimals = await getTokenDecimal(address);
  const symbol = await getTokenSymbol(address);
  return new Token(chainId, address, decimals, symbol);
}

function getPair(token1, token2 = ETH) {
  return Fetcher.fetchPairData(token1, token2, provider);
}

function getRoute(pairs, input = ETH) {
  return new Route(pairs, input);
}

function getTrade(amount, token = ETH, route) {
  try {
    return new Trade(
      route,
      new TokenAmount(token, amount),
      TradeType.EXACT_INPUT
    );
  } catch (err) {
    console.log(chalk.redBright(`${route.output.symbol} is not listed yet.`));
    return process.exit(0);
  }
}

async function getTokenPrice(fromTokenAddress, toTokenAddress, fromAmount) {
  const isInputETH = fromTokenAddress === ethers.constants.AddressZero;
  const isOutputETH = toTokenAddress === ethers.constants.AddressZero;
  const inputToken = isInputETH ? ETH : await getToken(fromTokenAddress);
  const outputToken = isOutputETH ? ETH : await getToken(toTokenAddress);
  let route;
  if (isInputETH || isOutputETH) {
    const inputPair = await getPair(isInputETH ? outputToken : inputToken);
    route = getRoute([inputPair], inputToken);
  } else {
    const inputPair = await getPair(inputToken);
    const outputPair = await getPair(outputToken);
    route = getRoute([inputPair, outputPair], inputToken);
  }
  const trade = getTrade(fromAmount, inputToken, route);
  return trade.outputAmount.toSignificant(6);
}

function createSwapETHForExactTokensParams(wallet, trade, destToken) {
  const amountOutMin = JSBI.BigInt(trade.minimumAmountOut(SLIPPAGE).raw);
  const path = [ETH, destToken.address];
  const to = wallet.address;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins
  const value = trade.inputAmount.raw;

  return [amountOutMin.toString(), path, to, deadline, value];
}

function createSwapExactTokensForETHParams(wallet, trade, sourceToken) {
  const amountIn = JSBI.BigInt(trade.inputAmount.raw);
  const amountOutMin = JSBI.BigInt(trade.minimumAmountOut(SLIPPAGE).raw);
  const path = [sourceToken.address, ETH.address];
  const to = wallet.address;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

  return [amountIn.toString(), amountOutMin.toString(), path, to, deadline];
}

function createSwapExactTokensForTokensParams(
  wallet,
  trade,
  sourceToken,
  amountIn,
  destToken = DAI
) {
  const amountOutMin = JSBI.BigInt(trade.minimumAmountOut(SLIPPAGE).raw);
  const path = [sourceToken.address, ETH.address, destToken.address];
  const to = wallet.address;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

  console.log(
    chalk.blueBright(sourceToken.symbol + " > " + "ETH > " + destToken.symbol)
  );
  console.log(
    chalk.blueBright("Price Impact: " + trade.priceImpact.toFixed() + "%")
  );
  console.log(
    chalk.blueBright(
      "Minimum Output: " +
        amountOutMin / Math.pow(10, destToken.decimals) +
        " " +
        destToken.symbol
    )
  );

  return [String(amountIn), amountOutMin.toString(), path, to, deadline];
}

function createSwapExactETHForTokensParams(
  wallet,
  trade,
  amountIn,
  destToken = DAI
) {
  const amountOutMin = JSBI.toNumber(trade.minimumAmountOut(SLIPPAGE).raw);
  const path = [ETH.address, destToken.address];
  const to = wallet.address;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

  console.log(chalk.blueBright("ETH" + " > " + destToken.symbol));
  console.log(
    chalk.blueBright("Price Impact: " + trade.priceImpact.toFixed() + "%")
  );
  console.log(
    chalk.blueBright(
      "Minimum Output: " +
        amountOutMin / Math.pow(10, destToken.decimals) +
        " " +
        destToken.symbol
    )
  );

  return [String(amountOutMin), path, to, deadline];
}

async function createSwapExactETHForTokensData(
  wallet,
  outputTokenAddress,
  amount = 0
) {
  const finalAmount = BigInt(amount);
  const outputToken = await getToken(outputTokenAddress);
  const SourcePair = await getPair(outputToken);
  const route = getRoute([SourcePair], ETH);
  const trade = getTrade(finalAmount, ETH, route);
  const params = createSwapExactETHForTokensParams(
    wallet,
    trade,
    amount,
    outputToken
  );
  const data = {
    from: wallet.address,
    to: UNIROUTER_ADDRESS,
    value: finalAmount.toString(),
    data: uniRouterContract.methods
      .swapExactETHForTokens(...params)
      .encodeABI(),
  };

  return data;
}

async function createSwapExactTokensForTokensData(
  wallet,
  inputTokenAddress,
  outputTokenAddress,
  amount = 0
) {
  const contract = new web3.eth.Contract(erc20Abi, inputTokenAddress);
  const finalAmount =
    amount || (await contract.methods.balanceOf(wallet.address).call());

  const inputToken = await getToken(inputTokenAddress);
  const outputToken = await getToken(outputTokenAddress);
  const SourcePair = await getPair(inputToken);
  let route;
  if (outputTokenAddress === ETH.address) {
    route = getRoute([SourcePair], inputToken);
  } else {
    const DestPair = await getPair(ETH, outputToken);
    route = getRoute([SourcePair, DestPair], inputToken);
  }
  const trade = getTrade(finalAmount, inputToken, route);
  const params = createSwapExactTokensForTokensParams(
    wallet,
    trade,
    inputToken,
    amount,
    outputToken
  );
  const data = {
    from: wallet.address,
    to: UNIROUTER_ADDRESS,
    data: uniRouterContract.methods
      .swapExactTokensForTokens(...params)
      .encodeABI(),
  };

  return data;
}

async function createSwapExactTokensForETHData(
  wallet,
  tokenAddress,
  amount = 0
) {
  const contract = new web3.eth.Contract(erc20Abi, tokenAddress);
  const finalAmount =
    amount || (await contract.methods.balanceOf(wallet.address).call());

  const token = await getToken(tokenAddress);
  const SourcePair = await getPair(token);
  const route = getRoute([SourcePair], token);

  const trade = getTrade(finalAmount, token, route);
  const params = createSwapExactTokensForETHParams(wallet, trade, token);
  const data = {
    from: wallet.address,
    to: UNIROUTER_ADDRESS,
    data: uniRouterContract.methods
      .swapExactTokensForETH(...params)
      .encodeABI(),
  };

  return data;
}

async function addLiquidityETH(wallet, tokenAddress, amount, slippage = 50) {
  const token = await getToken(tokenAddress);
  const pair = await getPair(token);

  const ratioEthPerToken =
    pair.token0.address === WETH[chainId].address
      ? pair.token1Price.toSignificant(6)
      : pair.token0Price.toSignificant(6);

  const ethAmount = Number(amount) * ratioEthPerToken;

  const _minTokenAmount = math.multiply(amount, 10000 - slippage);
  const minTokenAmount = math.divide(_minTokenAmount, 10000);

  const _minEthAmount = math.multiply(ethAmount, 10000 - slippage);
  const minEthAmount = math.divide(_minEthAmount, 10000);

  await approveTokenIfNeeded(wallet, UNIROUTER_ADDRESS, tokenAddress, amount);

  const params = [
    tokenAddress,
    amount.toString(),
    minTokenAmount.toString(),
    minEthAmount.toString(),
    wallet.address,
    Math.floor(Date.now() / 1000) + 60 * 20,
  ];

  const {
    amountToken,
    amountETH,
    liquidity,
  } = await uniRouterContract.methods
    .addLiquidityETH(...params)
    .call({ from: wallet.address, value: ethAmount });

  console.log(
    chalk.greenBright(
      `Expecting liquidity:  ${liquidity / 1e18} LP (${
        amountToken / 10 ** token.decimals
      } ${token.symbol} and ${amountETH / 1e18} ETH)`
    )
  );

  return {
    from: wallet.address,
    to: UNIROUTER_ADDRESS,
    value: ethAmount,
    data: uniRouterContract.methods.addLiquidityETH(...params).encodeABI(),
  };
}

async function getAccountLPToken(wallet, tokenAddress) {
  const token = await getToken(tokenAddress);
  const pair = await getPair(token);
  const contract = new web3.eth.Contract(uniLPAbi, pair.liquidityToken.address);
  const balance = await contract.methods.balanceOf(wallet.address).call();
  const totalSupply = await contract.methods.totalSupply().call();

  const reserveETH =
    pair.token0.address === WETH[chainId].address
      ? pair.reserve0.raw.toString()
      : pair.reserve1.raw.toString();

  const reserveToken =
    pair.token0.address === WETH[chainId].address
      ? pair.reserve1.raw.toString()
      : pair.reserve0.raw.toString();

  const nonces = await contract.methods.nonces(wallet.address).call();
  const _myToken = math.multiply(balance, reserveToken);
  const _myETH = math.multiply(balance, reserveETH);
  const myToken = math.divide(_myToken, totalSupply);
  const myETH = math.divide(_myETH, totalSupply);

  return { balance, totalSupply, myToken, myETH, nonces };
}

// percentage is between 1 - 10000
async function removeLiquidityETHWithPermit(
  wallet,
  tokenAddress,
  percentage = 10000,
  slippage = 50
) {
  const token = await getToken(tokenAddress);
  const pair = await getPair(token);
  const { balance, myToken, myETH, nonces } = await getAccountLPToken(
    wallet,
    tokenAddress
  );

  const _removeLiquidityAmount = math.multiply(balance, percentage);
  const liquidity = math.divide(_removeLiquidityAmount, 10000);

  const _amountTokenMin = math.multiply(myToken, percentage - slippage); // slippage 0.5%
  const amountTokenMin = math.divide(_amountTokenMin, 10000);

  const _amountETHMin = math.multiply(myETH, percentage - slippage);
  const amountETHMin = math.divide(_amountETHMin, 10000);

  console.log(
    chalk.greenBright(
      `Minimum returns ${Number(amountETHMin) / 1e18} ETH and ${
        Number(amountTokenMin) / 10 ** token.decimals
      } ${token.symbol}`
    )
  );

  console.log(
    chalk.greenBright(
      `Removing ${Number(liquidity) / 1e18} out of ${Number(balance) / 1e18} ${
        token.symbol
      }/ETH LP Token...`
    )
  );

  const message = {
    owner: wallet.address,
    spender: UNIROUTER_ADDRESS,
    value: liquidity.toString(),
    nonce: ethers.utils.hexlify(parseInt(nonces)),
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  };

  const { v, r, s } = signUniswapPermit(
    pair.liquidityToken.address,
    message,
    ethUtil.toBuffer(wallet.privateKey)
  );

  const params = [
    tokenAddress,
    liquidity.toString(),
    amountTokenMin.toString(),
    amountETHMin.toString(),
    wallet.address,
    Math.floor(Date.now() / 1000) + 60 * 20,
    false,
    v,
    ethUtil.bufferToHex(r),
    ethUtil.bufferToHex(s),
  ];

  const {
    amountToken,
    amountETH,
  } = await uniRouterContract.methods
    .removeLiquidityETHWithPermit(...params)
    .call({ from: wallet.address });

  console.log(
    chalk.greenBright("Expecting returns: ") +
      chalk.blueBright(
        `${amountToken / 10 ** token.decimals} ${token.symbol}`
      ) +
      chalk.greenBright(" and ") +
      chalk.blueBright(`${amountETH / 1e18} ETH`)
  );

  return {
    from: wallet.address,
    to: UNIROUTER_ADDRESS,
    data: uniRouterContract.methods
      .removeLiquidityETHWithPermit(...params)
      .encodeABI(),
  };
}

module.exports = {
  getToken,
  getTokenPrice,
  getPair,
  getRoute,
  getTrade,
  getAccountLPToken,
  createSwapETHForExactTokensParams,
  createSwapExactTokensForETHParams,
  createSwapExactTokensForTokensParams,
  createSwapExactETHForTokensData,
  createSwapExactTokensForTokensData,
  createSwapExactTokensForETHData,
  uniRouterContract,
  removeLiquidityETHWithPermit,
  addLiquidityETH,
  DAI,
  ETH,
  UNIROUTER_ADDRESS,
};
