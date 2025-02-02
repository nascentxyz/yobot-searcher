/* eslint-disable max-len */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */

import { FlashbotsTransactionResponse, SimulationResponseSuccess } from '@flashbots/ethers-provider-bundle';
import { BigNumber } from 'ethers';
import {
  configure,
  postDiscord,
  craftTransaction,
  createFlashbotsProvider,
  sendFlashbotsBundle,
  simulateBundle,
  validateSimulation,
  validateSubmitResponse,
  craftBundle,
} from '..';

const {
  parentPort: fillOrdersParent,
} = require('worker_threads');

let fillingLocked = false;

type FillingOrder = {
  orderId: string;
  tokenId: string;
};

let fillingOrders: FillingOrder[] = []; // orders that we placed to fill
let fillingOrderTokenIds: string[] = []; // tokenIds that we placed to fill

// ** Create Flashbots Provider ** //
let fbp: any;

const {
  provider,
  wallet,
  EOA_ADDRESS,
  flashbotsEndpoint,
  CHAIN_ID: chainId,
  BLOCKS_TILL_INCLUSION: blocksUntilInclusion,
  LEGACY_GAS_PRICE: legacyGasPrice,
  PRIORITY_FEE: priorityFee,
  YobotERC721LimitOrderInterface,
  // YobotERC721LimitOrderContract,
  YobotERC721LimitOrderContractAddress,
  DISCORD_WEBHOOK_URL: discordWebhookUrl,
} = configure();

// ** Sends a Fill Order Transaction Bundle ** //
const sendTransactionBundle = async (group: any, currentFillingOrders: any, currentFillingOrderTokenIds: any) => {
  // ** Craft a signed bundle of transactions ** //
  const {
    targetBlockNumber,
    transactionBundle,
  }: {
    targetBlockNumber: number,
    transactionBundle: string[]
  } = await craftBundle(
    provider,
    fbp,
    blocksUntilInclusion,
    group,
  );

  // ** Simulate Bundle ** //
  console.log('Simulating Fill Order Bundle: ', transactionBundle);
  console.log('Targeting block:', targetBlockNumber);
  let simulation;
  try {
    simulation = await simulateBundle(
      fbp,
      targetBlockNumber,
      transactionBundle,
    );
  } catch (e) {
    console.error('Simulation Error:', e);
    await postDiscord(
      discordWebhookUrl,
      `❌ FILL ORDER SIMULATION ERRORED ❌ Response=${JSON.stringify(e.body)}`,
    );
    // fillingLocked = false;
    return;
  }

  console.log('Got Flashbots simulation:', JSON.stringify(simulation, null, 2));

  // ** Send Bundle to Flashbots ** //
  if (validateSimulation(simulation)) { // validateSimulation returns true if the simulation errored
    await postDiscord(
      discordWebhookUrl,
      '✅ FILL ORDER SIMULATION SUCCESSFUL ✅',
    );
    await postDiscord(
      discordWebhookUrl,
      `💨 SENDING FILL ORDER FLASHBOTS BUNDLE :: Block Target=${targetBlockNumber}, Transaction Count=${group.length}`,
    );
    const bundleRes = await sendFlashbotsBundle(
      fbp,
      targetBlockNumber,
      group,
    );

    console.log('Bundle response:', JSON.stringify(bundleRes));
    const didBundleError = validateSubmitResponse(bundleRes);
    console.error(`Did bundle submission error: ${didBundleError}`);

    await postDiscord(
      discordWebhookUrl,
      `🚀 FILL ORDER BUNDLE SENT - ${JSON.stringify(bundleRes)}`,
    );

    // ** Wait the response ** //
    const simulatedBundleRes = await (bundleRes as FlashbotsTransactionResponse).simulate();
    console.log('Simulated bundle response:', JSON.stringify(simulatedBundleRes));
    const awaiting = await (bundleRes as FlashbotsTransactionResponse).wait();
    console.log('Awaited response:', JSON.stringify(awaiting));

    await postDiscord(
      discordWebhookUrl,
      `🎉 AWAITED FILL ORDER BUNDLE RESPONSE - ${JSON.stringify(simulatedBundleRes)}`,
    );

    // ** User Stats isn't implemented on goerli ** //
    if (chainId !== 5) {
      // ** Get Bundle Stats ** //
      // @ts-ignore
      // const bundleStats = await fbp.getBundleStats(simulation.bundleHash, targetBlockNumber);
      // console.log('Bundle stats:', JSON.stringify(bundleStats));

      const searcherStats = await fbp.getUserStats();
      console.log('User stats:', JSON.stringify(searcherStats));

      await postDiscord(
        discordWebhookUrl,
        `👑 SEARCHER STATS: ${JSON.stringify(searcherStats)}`,
      );
    }

    // ** Get Order Results ** //
    const ordersRes = 'results' in Object.keys(simulatedBundleRes) ? (simulatedBundleRes as SimulationResponseSuccess).results : [];
    console.log('Got results from simulation response:', ordersRes);

    // ** Add to fillingOrders ** //
    fillingOrders = fillingOrders.concat(currentFillingOrders);
    fillingOrderTokenIds = fillingOrderTokenIds.concat(currentFillingOrderTokenIds);
  } else {
    console.log('Simulation failed, discarding bundle...');
    await postDiscord(
      discordWebhookUrl,
      '❌ FILL ORDER SIMULATION FAILED - DISCARDING BUNDLE ❌',
    );
  }
};

// ****************************** //
// ** Fill Order Worker Thread ** //
// ****************************** //

fillOrdersParent.on('message', async (data: any) => {
  if (data.type === 'fill') {
    // ** Fill Orders if not already filling ** //
    if (!fillingLocked) {
      fillingLocked = true;

      // ** Destructure Arguments ** //
      const {
        walletTokens,
        remainingOrders,
      } = data;

      // !! If we don't have any remaining orders, we can break here !! //
      if (remainingOrders.length <= 0) {
        console.log('No remaining orders, leaving fillOrders worker');
        fillingLocked = false;
        return;
      }

      // ** Map wallet tokens to token ids ** //
      const tokens = walletTokens.map((e: any) => e.id);

      // ** Get previous block's gas limit ** //
      const currentBlockNumber = await provider.getBlockNumber();
      const block = await provider.getBlock(currentBlockNumber);
      const blockGasLimit = block.gasLimit;

      // ** Craft the Transactions to Bundle ** //
      const currentFillingOrders: FillingOrder[][] = []; // orders that we placed to fill
      const currentFillingOrderTokenIds: string[][] = []; // tokenIds that we placed to fill
      let tokenIdNum = 0;
      const transactionGroups: any[][] = [];
      let cumulativeGasCost = BigNumber.from(0);
      let txgroupSizeLimit = 2; // The maximum number of transactions per bundle (can be less if we hit the bundle gas limit)
      for (const order of remainingOrders) {
        if (
          tokenIdNum < tokens.length // If we have enough tokens in our wallet
          && !fillingOrderTokenIds.includes(tokens[tokenIdNum]) // if the token id is not already being used to fill
        ) {
          console.log('Crafting Transaction with tokenId:', tokens[tokenIdNum]);
          // ** Craft the transaction data ** //
          const txdata = YobotERC721LimitOrderInterface.encodeFunctionData(
            'fillOrder',
            [
              order.orderId, // The order ID
              tokens[tokenIdNum], // Order Number
              order.priceInWeiEach, // Price in Wei Each
              EOA_ADDRESS, // profit to
              true, // we want the profit immediately to continue minting
            ],
          );

          // ** Estimating tx gas ** //
          let gasEstimate = BigNumber.from(200_000);
          try {
            const tempEstimate = await provider.estimateGas({ to: YobotERC721LimitOrderContractAddress, from: EOA_ADDRESS, data: txdata });
            gasEstimate = tempEstimate;
          } catch (e) {
            // !! IGNORE !! //
          }

          if (cumulativeGasCost.add(gasEstimate).gt(blockGasLimit)) {
            console.log('Gas limit reached, creating a new transaction group:', cumulativeGasCost.add(gasEstimate).toNumber());
            txgroupSizeLimit = transactionGroups[transactionGroups.length - 1].length;
          } else {
            cumulativeGasCost = cumulativeGasCost.add(gasEstimate);
          }

          // ** Craft mintable transactions ** //
          const tx = await craftTransaction(
            provider,
            wallet,
            chainId,
            blocksUntilInclusion,
            legacyGasPrice,
            priorityFee,
            gasEstimate,
            YobotERC721LimitOrderContractAddress,
            txdata,
            BigNumber.from(0), // value in wei
          );
          // ** Push into a tx group - only 2 transactions per group to minimize bundling to increase chance of landing ** //
          if (transactionGroups[transactionGroups.length - 1].length >= txgroupSizeLimit) {
            txgroupSizeLimit = 2;
            // ** Reset the cumulative gas cost when we hit the limit ** //
            cumulativeGasCost = BigNumber.from(0);
            transactionGroups.push([tx]);
            // ** Add to the current filling orders ** //
            currentFillingOrders.push([{
              orderId: order.orderId,
              tokenId: tokens[tokenIdNum],
            }]);
            currentFillingOrderTokenIds.push([tokens[tokenIdNum]]);
          } else {
            transactionGroups[transactionGroups.length - 1].push(tx);
            // ** Add to the current filling orders ** //
            currentFillingOrders[currentFillingOrders.length - 1].push({
              orderId: order.orderId,
              tokenId: tokens[tokenIdNum],
            });
            currentFillingOrderTokenIds[currentFillingOrderTokenIds.length - 1].push(tokens[tokenIdNum]);
          }
        }
        tokenIdNum += 1;
      }

      console.log('Transaction Groups:', transactionGroups.length);
      console.log('Max transactions:', transactionGroups.length * 2);

      // !! If we don't have any transactions, we can break here !! //
      if (transactionGroups.length <= 0) {
        console.log('No bundle transactions, leaving fillOrders worker');
        fillingLocked = false;
        return;
      }
      // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! //

      // ** For each group of transactions, send a flashbots bundle ** //
      for (const group of transactionGroups) {
        await sendTransactionBundle(
          group, // The group of transactions
          currentFillingOrders, // The current orders being filled
          currentFillingOrderTokenIds, // The current tokenIds being filled
        );
      }

      // ** Unlock Filling ** //
      fillingLocked = false;
    } else {
      await postDiscord(
        discordWebhookUrl,
        '🔒 FILLING ORDERS LOCKED 🔒',
      );
    }
    // !! Otherwise ignore, and fill later !! //
  }

  if (data.type === 'start') {
    // ** Create Flashbots Provider if not already created yet ** //
    if (fbp === undefined) {
      fbp = await createFlashbotsProvider(
        provider,
        flashbotsEndpoint,
        wallet,
      );
    }
  }
});
