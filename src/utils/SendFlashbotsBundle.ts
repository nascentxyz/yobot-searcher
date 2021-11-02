import { ethers } from "ethers";
import { Web3Provider } from "@ethersproject/providers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

const sendFlashbotsBundle = async (
  provider: ethers.providers.Provider,
  flashbotsProvider: FlashbotsBundleProvider,
  authSigner: ethers.Wallet,
  FLASHBOTS_ENDPOINT: string,
  CHAIN_ID: number,
  ETHER: bigint,
  GWEI: bigint,
  ATTACHED_ADDRESS: string,
) => {

  // ** Create our signed transactions bundle **
  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: authSigner,
      transaction: {
        chainId: CHAIN_ID,
        type: 2,
        value: ETHER / 100n * 3n,
        data: "0x1249c58b",
        maxFeePerGas: GWEI * 3n,
        maxPriorityFeePerGas: GWEI * 2n,
        to: ATTACHED_ADDRESS
      },
    },
  ]);

  // ** Grab the current block and use the gas price from the previous block
  const blockNumber = await provider.getBlockNumber();

  // ** Simulate the transaction **
  console.log(new Date());
  const simulation = await flashbotsProvider.simulate(
    signedTransactions,
    blockNumber + 1
  );
  console.log(new Date());

  // ** Using TypeScript discrimination **
  if ("error" in simulation) {
    console.log(`Simulation Error: ${simulation.error.message}`);
  } else {
    console.log(`Simulation Success: ${blockNumber} ${JSON.stringify(simulation, null, 2)}`);
  }
  console.log(signedTransactions);

  // ** Submit bundles for the next 10 transactions - necessary on goerli since not many flashbots providers **
  for (var i = 1; i <= 10; i++) {
    const bundleSubmission = flashbotsProvider.sendRawBundle(signedTransactions, blockNumber + i);
    console.log("submitted for block # ", blockNumber + i);
  }
  console.log("bundles submitted");

  // TODO: check if this is not more than what the user is compensating for

  // TODO: The value should be exactly what the user set
}

export default sendFlashbotsBundle;