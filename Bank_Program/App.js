import './App.css';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import Modal from './Modal.js';

import bankArtifact from './artifacts/contracts/Bank.sol/Bank.json';
import maticArtifact from './artifacts/contracts/Matic.sol/Matic.json';
import shibArtifact from './artifacts/contracts/Shib.sol/Shib.json';
import usdtArtifact from './artifacts/contracts/Usdt.sol/Usdt.json';

function App() {
  const [provider, setProvider] = useState(undefined);
  const [signer, setSigner] = useState(undefined);
  const [signerAddress, setSignerAddress] = useState(undefined);
  const [bankContract, setBankContract] = useState(undefined);
  const [tokenContracts, setTokenContracts] = useState({});
  const [tokenBalances, setTokenBalances] = useState({});
  const [tokenSymbols, setTokenSymbols] = useState([]);
  const [amount, setAmount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(undefined);
  const [isDeposit, setIsDeposit] = useState(true);

  const toBytes32 = text => ethers.utils.formatBytes32String(text);
  const toString = bytes32 => ethers.utils.parseBytes32String(bytes32);
  const toWei = ether => ethers.utils.parseEther(ether);
  const toEther = wei => ethers.utils.formatEther(wei).toString();
  const toRound = num => Number(num).toFixed(2);

  useEffect(() => {
    const init = async () => {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);

      const bankContract = new ethers.Contract("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707", bankArtifact.abi);
      setBankContract(bankContract);

      const result = await bankContract.connect(provider).getWhitelistedSymbols();
      const symbols = result.map(s => toString(s));
      setTokenSymbols(symbols);
      getTokenContracts(symbols, bankContract, provider);
    };

    init();
  }, []);

  const getTokenContract = async (symbol, bankContract, provider) => {
    const address = await bankContract.connect(provider).getWhitelistedTokenAddress(toBytes32(symbol));
    const abi = symbol === 'Matic' ? maticArtifact.abi : symbol === 'Shib' ? shibArtifact.abi : usdtArtifact.abi;
    const tokenContract = new ethers.Contract(address, abi);
    return tokenContract;
  };

  const getTokenContracts = async (symbols, bankContract, provider) => {
    const contracts = await Promise.all(
      symbols.map(async symbol => {
        const contract = await getTokenContract(symbol, bankContract, provider);
        return { symbol, contract };
      })
    );

    const tokenContracts = contracts.reduce((prev, curr) => {
      prev[curr.symbol] = curr.contract;
      return prev;
    }, {});

    setTokenContracts(tokenContracts);
  };

  const isConnected = () => signer !== undefined;

  const getSigner = async provider => {
    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    setSignerAddress(address);
    return signer;
  };

  const connect = () => {
    getSigner(provider)
      .then(signer => {
        setSigner(signer);
        getTokenBalances(signer);
      });
  };

  const getTokenBalance = async (symbol, signer) => {
    const balance = await bankContract.connect(signer).getTokenBalance(toBytes32(symbol));
    return toEther(balance);
  };

  const getTokenBalances = async signer => {
    const balances = await Promise.all(
      tokenSymbols.map(async symbol => {
        const balance = await getTokenBalance(symbol, signer);
        return { symbol, balance: balance.toString() };
      })
    );

    const tokenBalances = balances.reduce((prev, curr) => {
      prev[curr.symbol] = curr.balance;
      return prev;
    }, {});

    setTokenBalances(tokenBalances);
  };

  const displayModal = symbol => {
    setSelectedSymbol(symbol);
    setShowModal(true);
  };

  const depositTokens = async (wei, symbol) => {
    if (symbol === 'Eth') {
      await signer.sendTransaction({
        to: bankContract.address,
        value: wei
      });
    } else {
      const tokenContract = tokenContracts[symbol];
      await tokenContract.connect(signer).approve(bankContract.address, wei);
      await bankContract.connect(signer).depositTokens(wei, toBytes32(symbol));
    }
  };

  const withdrawTokens = async (wei, symbol) => {
    if (symbol === 'Eth') {
      await bankContract.connect(signer).withdrawEther(wei);
    } else {
      await bankContract.connect(signer).withdrawTokens(wei, toBytes32(symbol));
    }
  };

  const depositOrWithdraw = (e, symbol) => {
    e.preventDefault();
    const wei = toWei(amount);

    if (isDeposit) {
      depositTokens(wei, symbol);
    } else {
      withdrawTokens(wei, symbol);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        {isConnected() ? (
          <div>
            <p>Welcome {signerAddress?.substring(0, 10)}...</p>
            <div>
              <div className="list-group">
                <div className="list-group-item">
                  {Object.keys(tokenBalances).map((symbol, idx) => (
                    <div className="row d-flex py-3" key={idx}>
                      <div className="col-md-3">
                        <div>{symbol.toUpperCase()}</div>
                      </div>

                      <div className="d-flex gap-4 col-md-3">
                        <small className="opacity-50 text-nowrap">{toRound(tokenBalances[symbol])}</small>
                      </div>

                      <div className="d-flex gap-4 col-md-6">
                        <button onClick={() => displayModal(symbol)} className="btn btn-primary">
                          Deposit/Withdraw
                        </button>
                        <Modal
                          show={showModal}
                          onClose={() => setShowModal(false)}
                          symbol={selectedSymbol}
                          depositOrWithdraw={depositOrWithdraw}
                          isDeposit={isDeposit}
                          setIsDeposit={setIsDeposit}
                          setAmount={setAmount}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p>You are not connected</p>
            <button onClick={connect} className="btn btn-primary">
              Connect Metamask
            </button>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
