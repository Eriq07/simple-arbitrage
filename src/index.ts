import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { Contract, providers, Wallet } from "ethers";
import { BUNDLE_EXECUTOR_ABI } from "./abi";
import { UniswappyV2EthPair } from "./UniswappyV2EthPair";
import { FACTORY_ADDRESSES } from "./addresses";
import { Arbitrage } from "./Arbitrage";
import { get } from "https"
//import { Contract, providers, Wallet } from "ethers";

const ETHEREUM_RPC_URL = "https://mainnet.infura.io/v3/f5bab68a41fd40cbaac71c9b4ae79499"; //process.env.ETHEREUM_RPC_URL;//|| "http://127.0.0.1:8545"
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""
const BUNDLE_EXECUTOR_ADDRESS = process.env.BUNDLE_EXECUTOR_ADDRESS || "";
const FLASHBOTS_KEY_ID = process.env.FLASHBOTS_KEY_ID || "";
const FLASHBOTS_SECRET = process.env.FLASHBOTS_SECRET || "";

const MINER_REWARD_PERCENTAGE = parseInt(process.env.MINER_REWARD_PERCENTAGE || "80")
/*
if (PRIVATE_KEY === "") {
  console.warn("Must provide PRIVATE_KEY environment variable")
  process.exit(1)
}
if (BUNDLE_EXECUTOR_ADDRESS === "") {
  console.warn("Must provide BUNDLE_EXECUTOR_ADDRESS environment variable. Please see README.md")
  process.exit(1)
}
if (FLASHBOTS_KEY_ID === "" || FLASHBOTS_SECRET === "") {
  console.warn("Must provide FLASHBOTS_KEY_ID and FLASHBOTS_SECRET environment variable. Please see https://hackmd.io/@flashbots/rk-qzgzCD")
  process.exit(1)
}*/

const HEALTHCHECK_URL = process.env.HEALTHCHECK_URL || ""

const provider = new providers.StaticJsonRpcProvider(ETHEREUM_RPC_URL);

function healthcheck() {
  if (HEALTHCHECK_URL === "") {
    return
  }
  get(HEALTHCHECK_URL).on('error', console.error);
}

async function main() {
  const markets = await UniswappyV2EthPair.getUniswapMarketsByToken(provider, FACTORY_ADDRESSES);
  const arbitrage = new Arbitrage(
    new Wallet(PRIVATE_KEY),
    await FlashbotsBundleProvider.create(provider, FLASHBOTS_KEY_ID, FLASHBOTS_SECRET),
    new Contract(BUNDLE_EXECUTOR_ADDRESS, BUNDLE_EXECUTOR_ABI, provider) )

  provider.on('block', async (blockNumber) => {
    await UniswappyV2EthPair.updateReserves(provider, markets.allMarketPairs);
    const bestCrossedMarkets = await arbitrage.evaluateMarkets(markets.marketsByToken);
    if (bestCrossedMarkets.length === 0) {
      console.log("No crossed markets")
      return
    }
    bestCrossedMarkets.forEach(Arbitrage.printCrossedMarket);
    arbitrage.takeCrossedMarkets(bestCrossedMarkets, blockNumber, MINER_REWARD_PERCENTAGE).then(healthcheck).catch(console.error)
  })
}

main();
