import { IDataParams } from '@waves/waves-transactions';
import { Account } from '../utils/accounts';
import { Contract, setContractContext } from '../utils/contracts';
import { invoke, InvokeParams, LONG } from '../utils/transaction';
import { getEnvironment } from 'relax-env-json';
import { DataTransactionEntry } from '@waves/ts-types';
const env = getEnvironment();

export const sendDeposit = async function(
    contract: Contract,
    user: Account,
    payments: any[]
) {
    const params = {
        dApp: contract.dApp,
        call: { function: 'deposit' },
        payment: payments
    };
    const tx = await invoke(params, user.privateKey);
    return tx;
};

export const stake = async function(
    contract: Contract,
    node: Account,
    args: any[],
    payment: any[]
) {
    const params = {
        dApp: contract.dApp,
        call: {
            function: 'stake',
            args: args
        },
        payment: payment
    };
    const tx = await invoke(params, node.privateKey);
    return tx;
};

export const withdraw = async function(
    contract: Contract,
    user: Account,
    assetId: string | null,
    amount: number
) {
    const params = {
        dApp: contract.dApp,
        call: { function: 'withdraw' },
        payment: [
            {
                assetId: assetId,
                amount: amount
            }
        ]
    };
    const tx = await invoke(params, user.privateKey);
    return tx;
};

export const setLeaseNode = async function(
    contract: Contract,
    nodeAddress: string
) {
    const initData: IDataParams = {
        data: [
            { key: 'LEASE_NODE', type: 'string', value: nodeAddress }
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const setAsset = async function(
    contract: Contract,
    value: string
) {
    const initData: IDataParams = {
        data: [
            { key: 'ASSET', type: 'string', value: value }
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const resetStakeState = async function(contract: Contract) {
    await stakeState(contract, 0, 0, 0, 0, 0);
};

export const setLeaseAmount = async function(
    contract: Contract,
    value: number
) {
    const initData: IDataParams = {
        data: [
            { key: 'LEASE_AMOUNT', type: 'integer', value: value }
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const init = async function (contract: Contract, user: Account) {
    await invoke(
        {
            dApp: contract.dApp,
            call: { function: 'init' },
            additionalFee: 100000000
        },
        user.privateKey
    );
};

export const setStakeState = async function (
    contract: Contract,
    totalDepo: any,
    lastRate: any,
    currRate: any,
    lastHeight: any,
    targetHeigh: any
) {
    await stakeState(contract, totalDepo, lastRate, currRate, lastHeight, targetHeigh);
};

async function stakeState (
    contract: Contract,
    totalDepo: any,
    lastRate: any,
    currRate: any,
    lastHeight: any,
    targetHeigh: any
) {
    const data_: Array<DataTransactionEntry<LONG>> = [];
    if(totalDepo != null) {
        data_.push({ key: 'TOTAL_DEPOSIT', type: 'integer', value: totalDepo });
    }
    if(lastRate != null) {
        data_.push({ key: 'LAST_RATE', type: 'integer', value: lastRate });
    }
    if(currRate != null) {
        data_.push({ key: 'CURRENT_RATE', type: 'integer', value: currRate });
    }
    if(lastHeight != null) {
        data_.push({ key: 'LAST_HEIGHT', type: 'integer', value: lastHeight });
    }
    if(targetHeigh != null) {
        data_.push({ key: 'TARGET_HEIGHT', type: 'integer', value: targetHeigh });
    }
    const initData: IDataParams = {data: data_};
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
}

export const setInt = async function (
    contract: Contract,
    user: Account,
    value: number
) {
    const params: InvokeParams = {
        dApp: contract.dApp,
        call: {
            function: 'bigintToBinary',
            args: [
                { type: 'integer', value: value }
            ]
        },
        payment: [
            { assetId: null, amount: env.network.WavesInvokeFee }
        ]
    };
    const tx = await invoke(params, user.privateKey);
    return tx;
};
