import { providers, Wallet } from "ethers";
import * as ethers from "ethers"
const Blocknative = require('bnc-sdk')
import Web3 from 'web3';
const WebSocket = require('ws');

import {
  DeployedContracts,
  fetchAllERC721LimitOrderEvents,
  sendFlashbotsBundle,
  fetchSortedOrdersForAllTokens
} from "./utils";

require('dotenv').config();

console.log("Yobot Searcher starting...");

// ** Default to Goerli if no chain id provided **
const CHAIN_ID = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 5;
console.log("Using CHAIN ID:", CHAIN_ID);

// ** We need the INFURA_PROJECT_ID **
if (process.env.INFURA_PROJECT_ID === undefined) {
  console.error("Please provide INFURA_PROJECT_ID env")
  process.exit(1)
}

const provider = new providers.InfuraProvider(CHAIN_ID, process.env.INFURA_PROJECT_ID)

const FLASHBOTS_ENDPOINT = "https://relay-goerli.flashbots.net";

// ** We need the WALLET PRIVATE KEY **
if (process.env.WALLET_PRIVATE_KEY === undefined) {
  console.error("Please provide WALLET_PRIVATE_KEY env")
  process.exit(1)
}

console.log("Found a wallet!");

const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY, provider)

// ** Import the Abis **
const YobotERC721LimitOrderAbi = require("./abi/YobotERC721LimitOrder.json");
const YobotArtBlocksBrokerAbi = require("./abi/YobotArtBlocksBroker.json");

// ** Instantiate Interfaces **
const YobotERC721LimitOrderInterface = new ethers.utils.Interface(YobotERC721LimitOrderAbi)
const YobotERC721LimitOrderContractAddress = DeployedContracts[CHAIN_ID]["YobotERC721LimitOrder"];
console.log("Using YobotERC721LimitOrder defined at:", YobotERC721LimitOrderContractAddress);
console.log(`https://goerli.etherscan.io/address/${YobotERC721LimitOrderContractAddress}`);

// ** Sanity Check We Can Fetch the Contract Code **
(async () => {
  let erc721_code = await provider.getCode(YobotERC721LimitOrderContractAddress);
  if(erc721_code === "0x") {
    console.error("Invalid contract address or provider configuration...")
    process.exit(1)
  } else {
    console.log("Successfully Fetched YobotERC721LimitOrder Contract Code");
  }
})();

const YobotArtBlocksBrokerInterface = new ethers.utils.Interface(YobotArtBlocksBrokerAbi)

// ** Instantiate Contracts **
const YobotERC721LimitOrderContract = new ethers.Contract(YobotERC721LimitOrderContractAddress, YobotERC721LimitOrderAbi, provider)
const YobotArtBlocksBrokerContract = new ethers.Contract(DeployedContracts[CHAIN_ID]["YobotArtBlocksBroker"], YobotArtBlocksBrokerAbi, provider)

// ** ethers.js can use Bignumber.js class OR the JavaScript-native bigint **
// ** I changed this to bigint as it is MUCH easier to deal with **
const GWEI: bigint = 10n ** 9n;
const ETHER: bigint = 10n ** 18n;

// ** Filter From Block Number **
const filterStartBlock = 0;

// ** Create a new ethers provider **
// const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');

// ** We need the BLOCKNATIVE_API_KEY **
if (process.env.BLOCKNATIVE_API_KEY === undefined) {
  console.error("Please provide BLOCKNATIVE_API_KEY env")
  process.exit(1)
}

// ** Main Function **
async function main() {

  const handleTransaction = (event) => {
    const {
      transaction, // ** transaction object **
      emitterResult // ** data that is returned from the transaction event listener defined on the emitter **
    } = event;

    console.log(`Transaction ${transaction.hash}:`);
    console.log(transaction)
  }

  // ** Blocknative SDK **
  // ** https://docs.blocknative.com/notify-sdk **
  const options = {
    dappId: process.env.BLOCKNATIVE_API_KEY,
    networkId: CHAIN_ID,
    // system: 'ethereum', // defaults to ethereum
    ws: WebSocket,
    name: 'Yobot Searcher', // optional use for managing multiple instances
    transactionHandlers: [handleTransaction],
    onerror: (error) => {console.log("BlockNative SDK ERROR:", error)} // optional, use to catch errors
  }

  console.log("Instantiating Blocknative SDK...");
  const sdk = new Blocknative(options);
  await sdk.configuration({
    scope: YobotERC721LimitOrderContractAddress, // [required] - either 'global' or valid Ethereum address
    // abi: {}, // [optional] - valid contract ABI
    // filters: [
    //   { from:  process.env.CONTRACT_ADMIN_ADDRESS },
    //   { "contractCall.methodName": "flipSaleState" },
    //   { status: "pending" }
    // ],
    watchAddress: true // [optional] - Whether the server should automatically watch the "scope" value if it is an address
  })


  // let all_events = await fetchAllERC721LimitOrderEvents(
  //   YobotERC721LimitOrderContract,
  //   filterStartBlock,
  //   provider,
  //   YobotERC721LimitOrderInterface
  // );

  // console.log("-------");
  // console.log("All Events....")
  // console.log(all_events);
  // console.log("-------");

  // let sorted_events = fetchSortedOrdersForAllTokens(
  //   YobotERC721LimitOrderContract,
  //   filterStartBlock,
  //   provider,
  //   YobotERC721LimitOrderInterface
  // );

  // console.log("-------");
  // console.log("Sorted Events....")
  // console.log(sorted_events);
  // console.log("-------");

  // await sendFlashbotsBundle(
  //   provider,
  //   FLASHBOTS_ENDPOINT,
  //   CHAIN_ID,
  //   ETHER,
  //   GWEI,
  //   wallet,
  // );
}

main();