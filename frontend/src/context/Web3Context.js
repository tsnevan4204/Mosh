import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

export const Web3Context = createContext();

const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);

        const accounts = await web3Provider.send('eth_requestAccounts', []);
        setAccount(accounts[0]);

        const web3Signer = await web3Provider.getSigner();
        setSigner(web3Signer);
      } else {
        console.error('MetaMask is not installed.');
      }
    };

    initWeb3();
  }, []);

  return (
    <Web3Context.Provider value={{ account, provider, signer }}>
      {children}
    </Web3Context.Provider>
  );
};

export default Web3Provider;