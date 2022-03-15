import { ethers } from 'ethers';
import { readJson, saveJson } from '.';

const generateWallet = (path: string) => {
  const wallet = ethers.Wallet.createRandom();

  // Store the wallet in the wallet config
  const walletStore = readJson(path);
  walletStore.wallets = [...walletStore.wallets, wallet];
  saveJson(path, walletStore);
  // console.log('address:', wallet.address)
  // console.log('mnemonic:', wallet.mnemonic.phrase)
  // console.log('privateKey:', wallet.privateKey)
};

export default generateWallet;
