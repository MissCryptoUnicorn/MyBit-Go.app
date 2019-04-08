/* eslint-disable no-underscore-dangle */
/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
import axios from 'axios';
import dayjs from 'dayjs';
import * as MyBitToken from '../constants/contracts/MyBitToken';

import { ErrorTypes } from 'constants/errorTypes';
import {
  InternalLinks,
  ExternalLinks,
} from 'constants/links';
import {
  FundingStages,
  getFundingStage
} from 'constants/fundingStages';
import {
  BLOCK_NUMBER_CONTRACT_CREATION,
  DEFAULT_TOKEN_CONTRACT,
} from 'constants/app';

import {
  generateRandomURI,
  debug,
  getCategoryFromAssetTypeHash,
  fromWeiToEth,
  toWei,
} from '../utils/helpers';

import BN from 'bignumber.js';
BN.config({ EXPONENTIAL_AT: 80 });

const SDK_CONTRACTS = require("@mybit/contracts/networks/ropsten/Contracts");

let Network;

export const fetchTransactionHistory = async userAddress =>
  new Promise(async (resolve, reject) => {
    try {
      /*
    *  results from etherscan come in lower case
    *  its cheaper to create a var to hold the address in lower case,
    *  than it is to keep converting it for every iteration
    */
      const userAddressLowerCase = userAddress.toLowerCase();
      const endpoint = ExternalLinks.ETHERSCAN_TX_BY_ADDR_ENDPOINT(userAddress);
      const result = await fetch(endpoint);
      const jsonResult = await result.json();
      if (
        !jsonResult.message ||
        (jsonResult.message &&
          jsonResult.message !== 'No transactions found' &&
          jsonResult.message !== 'OK')
      ) {
        throw new Error(jsonResult.result);
      }

      const ethTransactionHistory = jsonResult.result
        .filter(txResult =>
          txResult.to === userAddressLowerCase || txResult.from === userAddressLowerCase)
        .map((txResult, index) => {
          const multiplier = txResult.from === userAddressLowerCase ? -1 : 1;
          let status = 'Confirmed';
          if (txResult.isError === '1') {
            status = 'Error';
          } else if (txResult.confirmations === 0) {
            status = 'Pending';
          }
          return {
            amount: window.web3js.utils.fromWei(txResult.value, 'ether') * multiplier,
            type: 'ETH',
            txId: txResult.hash,
            status,
            date: txResult.timeStamp * 1000,
            key: `${txResult.hash} ${index}`,
          };
        });

      // Pull MYB transactions from event log
      const myBitTokenContract = new window.web3js.eth.Contract(
        MyBitToken.ABI,
        MyBitToken.ADDRESS,
      );
      const logTransactions = await myBitTokenContract.getPastEvents(
        'Transfer',
        { fromBlock: 0, toBlock: 'latest' },
      );

      const mybTransactionHistory = await Promise.all(logTransactions
        .filter(txResult =>
          txResult.returnValues.to === userAddress || txResult.returnValues.from === userAddress)
        .map(async (txResult, index) => {
          const blockInfo = await window.web3js.eth.getBlock(txResult.blockNumber);
          const multiplier =
            txResult.returnValues.from === userAddress ? -1 : 1;

          return {
            amount: window.web3js.utils.fromWei(txResult.returnValues[2], 'ether') * multiplier,
            type: 'MYB',
            txId: txResult.transactionHash,
            status: 'Confirmed',
            date: blockInfo.timestamp * 1000,
            key: `${txResult.transactionHash} ${index}`,
          };
        }));

      const mixedEthAndMybitTransactions =
        ethTransactionHistory.concat(mybTransactionHistory);

      resolve(mixedEthAndMybitTransactions);
    } catch (error) {
      reject(error);
    }
  });

const roiEscrow = async assetId =>
  new Promise(async (resolve, reject) => {
    try {
      const assetCollateralContract = new window.web3js.eth.Contract(
        AssetCollateral.ABI,
        AssetCollateral.ADDRESS,
      );

      const response = await assetCollateralContract.methods
        .roiEscrow(assetId).call();
        debug(response)
      resolve(response);
    } catch (err) {
      reject(err);
    }
  });

export const withdrawAssetManager = async (userAddress, assetId, onTransactionHash, onReceipt, onError) => {
  try {
    const assetManagerFunds = await Network.assetManagerFunds();
    assetManagerFunds.methods.withdraw(assetId, userAddress)
      .send({ from: userAddress, gas: '1000000'})
      .on('transactionHash', (transactionHash) => {
        onTransactionHash();
      })
      .on('error', (error) => {
        processErrorType(error, onError);
      })
      .then(receipt => onReceipt(receipt.status));

  } catch (error) {
    processErrorType(error, onError)
  }
}

export const withdrawEscrow = async (userAddress, assetId, onTransactionHash, onReceipt, onError) => {
  try {
    const assetManagerEscrow = await Network.assetManagerEscrow();
    assetManagerEscrow.methods.unlockEscrow(assetId, userAddress)
      .send({ from: userAddress, gas: '1000000'})
      .on('transactionHash', (transactionHash) => {
        onTransactionHash();
      })
      .on('error', (error) => {
        processErrorType(error, onError);
      })
      .then(receipt => onReceipt(receipt.status));
  } catch (error) {
    processErrorType(error, onError)
  }
}

export const fetchRevenueLogsByAssetId = async assetId => {
  try{
    return Network.getAssetIncome(assetId);
  }catch(err){
    debug(err);
    reject(err);
  }
}

export const createAsset = async (onCreateAsset, onApprove, params) => {
  try {
    const {
      asset,
      userAddress,
      managerPercentage,
      collateral,
      amountToBeRaised,
      paymentTokenAddress,
      operatorID,
    } = params;

    const randomURI = generateRandomURI(window.web3js);
    const api = await Network.api();
    const response = await Network.createAsset({
      escrow: toWei(collateral),
      assetURI: randomURI,
      assetManager: userAddress,
      fundingLength: 2592000,
      startTime: 1551732113,
      amountToRaise: toWei(amountToBeRaised),
      assetManagerPercent: managerPercentage,
      operatorID,
      fundingToken: DEFAULT_TOKEN_CONTRACT,
      paymentToken: paymentTokenAddress,
      createAsset: {
        onTransactionHash: onCreateAsset.onTransactionHash,
        onError: error => processErrorType(error, onCreateAsset.onError),
      },
      approve: {
        onTransactionHash: onApprove.onTransactionHash,
        onError: error => processErrorType(error, onApprove.onError),
        onReceipt: receipt => onApprove.onReceipt(receipt.status),
      }
    })

    onCreateAsset.onReceipt(response.asset);
  } catch (error) {
    debug(error)
  }
}

export const uploadFilesToAWS = async (
  assetId,
  fileList,
  performInternalAction,
) => {
  try{
    let data = new FormData();
    data.append('assetId', assetId);
    for(const file of fileList){
      data.append('file', file.originFileObj ? file.originFileObj : file);
    }
    const result = await axios.post(InternalLinks.S3_UPLOAD,
      data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )

    if(performInternalAction){
      performInternalAction();
    } else {
      return result;
    }

  } catch(err){
    setTimeout(() => uploadFilesToAWS(assetId, fileList, performInternalAction), 5000);
    debug(err);
  }
}

export const createEntryForNewCollateral = async (
  address,
  escrow,
  assetId,
  performInternalAction,
) => {
  try{
    await axios.post(InternalLinks.MYBIT_API_COLLATERAL, {
      address,
      escrow,
      assetId,
    })
    performInternalAction();
  } catch(err){
    setTimeout(() => createEntryForNewCollateral(address, escrow, assetId, performInternalAction), 5000);
    debug(err);
  }
}

export const updateAirTableWithNewAsset = async (
  assetId,
  assetName,
  country,
  city,
  collateralPercentage,
  performInternalAction,
) => {
  try{
    await axios.post(InternalLinks.UPDATE_ASSETS, {
      assetId,
      assetName,
      country,
      city,
      collateralPercentage,
    });
    performInternalAction();
  } catch(err){
    setTimeout(() => updateAirTableWithNewAsset(assetId, assetName, country, city, collateralPercentage, performInternalAction), 5000);
    debug(err);
  }
}

export const payoutAsset = ({
  userAddress,
  assetId,
  onTransactionHash,
  onReceipt,
  onError,
}) => {
  try {
    Network.payout({
      asset: assetId,
      from: userAddress,
      onTransactionHash,
      onError: error => processErrorType(error, onError),
      onReceipt,
    })
  } catch(error) {
    processErrorType(error, onError)
  }
}

export const withdrawInvestorProfit = async (userAddress, assetId, onTransactionHash, onReceipt, onError) => {
  try {
    const dividendTokenETH = await Network.dividendTokenETH(assetId);
    const response = await dividendTokenETH.methods.withdraw()
      .send({from: userAddress, gas: '1000000'})
      .on('transactionHash', (transactionHash) => {
        onTransactionHash();
      })
      .on('error', (error) => {
        processErrorType(error, onError);
      })
      .then((receipt) => {
        onReceipt(receipt.status);
      });
  } catch (error) {
    processErrorType(error, onError)
  }
}

export const fundAsset = async (onFundAsset, onApprove, params) => {
  try {
    const {
      userAddress,
      assetId,
      amount,
      paymentToken,
    } = params;

    const response = await Network.fundAsset({
      asset: assetId,
      investor: userAddress,
      paymentToken,
      amount: toWei(amount),
      buyAsset: {
        onTransactionHash: onFundAsset.onTransactionHash,
        onError: error => processErrorType(error, onFundAsset.onError),
      },
      approve: {
        onTransactionHash: onApprove.onTransactionHash,
        onError: error => processErrorType(error, onFundAsset.onError),
        onReceipt: receipt => onApprove.onReceipt(receipt.status),
      }
    })

    onFundAsset.onReceipt(response.status);
  } catch (error) {
    processErrorType(error, onFundAsset.onError)
  }
}

const processErrorType = (error, handleError) => {
  console.log(error)
  if(error.message.includes("User denied transaction signature")){
    handleError(ErrorTypes.METAMASK);
  } else{
    handleError(ErrorTypes.ETHEREUM);
  };
}

const getAssetDetails = (api, assetId) => {
  return Promise.all([
      Network.dividendTokenETH(assetId),
      api.methods.getAssetPlatformFee(assetId).call(),
      Network.getAssetOperator(assetId),
      api.methods.crowdsaleFinalized(assetId).call(),
      api.methods.getCrowdsaleDeadline(assetId).call(),
      Network.getFundingGoal(assetId),
      Network.getAssetManager(assetId),
      Network.getAssetInvestors(assetId),
      Network.getFundingProgress(assetId),
      api.methods.getAssetManagerFee(assetId).call(),
    ]);
}

const getExtraAssetDetails = (ownershipUnitsTmp, isAssetManager, apiContract, asset, realAddress) => {
  return Promise.all([
    getNumberOfInvestors(asset.assetId),
    ownershipUnitsTmp > 0 ? apiContract.methods.getAmountOwed(asset.assetId, realAddress).call() : 0,
    isAssetManager ? Promise.all([
          getManagerIncomeEarned(realAddress, asset.assetId),
          getManagerIncomeWithdraw(realAddress, asset.assetId)
        ]) : [0, 0],
    ]);
}

export const issueDividends = (
  amount,
  address,
  assetId,
) => {
  try{
    Network.issueDividends({
      asset: assetId,
      account: address,
      amount: toWei(amount),
    })
  } catch(err){
    debug(err);
  }
}

export const fetchAssets = async (userAddress, assetsAirTableById, categoriesAirTable) =>
  new Promise(async (resolve, reject) => {
    try {
      if(!Network){
        Network = require('@mybit/network.js')(window.web3js, SDK_CONTRACTS);
      }
      const realAddress = userAddress && window.web3js.utils.toChecksumAddress(userAddress);
      //console.log("Network: ", Network)
      const api = await Network.api();
      const assetManagerFunds = await Network.assetManagerFunds();

      const database = await Network.database();
      const events = await Network.events();

      /*const x = await Network.acceptERC20Token({
        id: "0x3eccf03d236410e626e8000a285b59e17132713a829ada5638ccf8b82a6e7a65",
        token: DEFAULT_TOKEN_CONTRACT,
        operator: '0x15c9C83075b7214308fd4526731db4172299E2a4',
      });*/

      let assets = await Network.getTotalAssets();
      assets =
        assets
          .filter(assetContractAddress => assetsAirTableById[assetContractAddress] !== undefined)
          .map(assetContractAddress => {
            return {
              ...assetsAirTableById[assetContractAddress],
              assetId: assetContractAddress,
            }
          });

      const assetDetails = await Promise.all(assets.map(async asset =>  {
        const {
          assetId,
        } = asset;
        let [
          dividendTokenETH,
          platformFee,
          assetOperator,
          crowdsaleFinalized,
          fundingDeadline,
          fundingGoal,
          assetManager,
          assetInvestors,
          fundingProgress,
          assetManagerFee
        ] = await getAssetDetails(api, assetId);

        const escrowId = await api.methods.getAssetManagerEscrowID(assetId, assetManager).call();
        const escrow = await api.methods.getAssetManagerEscrow(escrowId).call();
        const isAssetManager = assetManager === realAddress;
        let daysSinceItWentLive = 1;
        let assetIncome = 0;
        let managerHasToCallPayout = false;
        let totalShares = 0;
        let availableShares = 0;
        let owedToInvestor = 0;
        let owedToAssetManager = 0;
        let assetIncomeForCollateral = 0;

        assetManagerFee = BN(assetManagerFee);
        platformFee = BN(platformFee);
        fundingGoal = BN(fundingGoal);
        fundingProgress = BN(fundingProgress);
        totalShares = fundingGoal.plus(assetManagerFee).plus(platformFee);
        availableShares = totalShares.minus(assetManagerFee).minus(platformFee).minus(fundingProgress);
        assetManagerFee = assetManagerFee.div(totalShares).toNumber();
        platformFee = platformFee.div(totalShares).toNumber();
        fundingGoal = fundingGoal.toNumber();

        availableShares = availableShares.toNumber();
        totalShares = totalShares.toNumber();

        let percentageOwnedByUser = 0;
        let balanceOfUser = 0;
        let investment = 0;

        const isInvestor = realAddress && assetInvestors.includes(realAddress);
        const [
          remainingEscrow,
          escrowRedeemed,
          assetManagerCollateral,
        ] = await Promise.all([
          api.methods.getAssetManagerEscrowRemaining(escrowId).call(),
          api.methods.getAssetManagerEscrowRedeemed(escrowId).call(),
          api.methods.getAssetManagerEscrow(escrowId).call(),
        ])

        if(isInvestor){
          balanceOfUser = await dividendTokenETH.methods.balanceOf(realAddress).call();
          investment = fromWeiToEth(BN(balanceOfUser).toString());
          percentageOwnedByUser = BN(balanceOfUser).div(totalShares).toNumber();
        }

        if(crowdsaleFinalized){
          const timestamp = await Network.getTimestampOfFundedAsset(assetId)
          // no timestamp means payout has to be called (asset manager does it)
          if(timestamp){
            fundingProgress = fundingProgress - ((assetManagerFee + platformFee) * fundingProgress)
            if(isInvestor){
              assetIncome = await dividendTokenETH.methods.assetIncome().call();
              owedToInvestor = await dividendTokenETH.methods.getAmountOwed(realAddress).call();
            }
            if(isAssetManager){
              assetIncome = await dividendTokenETH.methods.assetIncome().call();
              daysSinceItWentLive = dayjs().diff(dayjs(timestamp * 1000), 'day');
              daysSinceItWentLive = daysSinceItWentLive === 0 ? 1 : daysSinceItWentLive;
              assetIncomeForCollateral = Number(fromWeiToEth(assetIncome)) * (1 - platformFee - assetManagerFee);
              owedToAssetManager = await assetManagerFunds.methods.viewAmountOwed(assetId, realAddress).call();
            }
            assetIncome = Number(fromWeiToEth(assetIncome));
          } else if(isAssetManager) {
            managerHasToCallPayout = true;
          }
        }

        const searchQuery = `mybit_watchlist_${assetId}`;
        const alreadyFavorite = window.localStorage.getItem(searchQuery) === 'true';

        // determine whether asset has expired
        const dueDate = dayjs(fundingDeadline * 1000);
        const pastDate = dayjs() >= dueDate ? true : false;

        const fundingStageTmp = crowdsaleFinalized ? 0 : (!pastDate && !crowdsaleFinalized) ? 2 : 1;
        const fundingStage = getFundingStage(fundingStageTmp);

        const fundingProgressFormatted = Number(Number(fromWeiToEth(fundingProgress)).toFixed(2));
        const availableSharesFormatted = Number(fromWeiToEth(availableShares));

        return {
          ...asset,
          managerHasToCallPayout,
          fundingGoal: Number(Number(fromWeiToEth(fundingGoal)).toFixed(2)),
          fundingProgress: (availableSharesFormatted < 0.01 && availableSharesFormatted > 0 && !crowdsaleFinalized) ? fundingProgressFormatted - 0.01 : fundingProgressFormatted,
          fundingStage,
          pastDate,
          isAssetManager,
          assetManager,
          percentageOwnedByUser,
          daysSinceItWentLive,
          assetIncome,
          assetIncomeForCollateral,
          owedToInvestor,
          owedToAssetManager: fromWeiToEth(owedToAssetManager),
          remainingEscrow: fromWeiToEth(remainingEscrow),
          assetManagerCollateral: fromWeiToEth(assetManagerCollateral),
          escrowRedeemed: fromWeiToEth(escrowRedeemed),
          userInvestment: investment,
          totalSupply: Number(fromWeiToEth(totalShares)),
          availableShares: availableSharesFormatted,
          managerPercentage: assetManagerFee,
          fundingDeadline: dueDate,
          numberOfInvestors: assetInvestors.length,
          blockNumberitWentLive: 0,
          managerTotalWithdrawn: 0,
          watchListed: alreadyFavorite,
          funded: fundingStage === FundingStages.FUNDED,
        };
      }));

      console.log("ALL ASSETS: ", assetDetails)
      resolve(assetDetails);
    } catch (error) {
      debug('failed to fetch assets, error: ', error);
      reject(error);
    }
  });
