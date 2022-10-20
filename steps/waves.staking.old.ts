import { IDataParams, lease } from '@waves/waves-transactions';
import { Account } from '../utils/accounts';
import { Contract, setContractContext } from '../utils/contracts';
import { invoke, LONG } from '../utils/transaction';
import { getEnvironment } from 'relax-env-json';
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

export const resetStakeState = async function(contract: Contract) {
    const initData: IDataParams = {
        data: [
            { key: 'LIQUID_TOTAL_SUPPLY', type: 'integer', value: 0 },
            { key: 'LIQUID_DEPOSIT', type: 'integer', value: 0 },
            { key: 'PERCENTS_LAST_IDX', type: 'integer', value: 1 },
            { key: 'LEASE_AMOUNT', type: 'integer', value: 0 },
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const resetAccountDepo = async function(
    contract: Contract,
    user: Account
) {
    const initData: IDataParams = {
        data: [
            { key: `ACCOUNT_DEPOSIT__${user.address}`, type: 'integer', value: 0 },
            { key: `ACCOUNT_REWARD_IDX__${user.address}`, type: 'integer', value: 1 },
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const stake = async function(
    contract: Contract,
    node: Account,
    args: any[]
) {
    const params = {
        dApp: contract.dApp,
        call: {
            function: 'stake',
            args: args
        }
    };
    const tx = await invoke(params, node.privateKey);
    return tx;
};

export const setTotalLiquidSupply = async function(
    contract: Contract,
    totalSupply: number
) {
    const initData: IDataParams = {
        data: [
            { key: 'LIQUID_TOTAL_SUPPLY', type: 'integer', value: totalSupply }
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const setLiquidDepo = async function(
    contract: Contract,
    depo: number
) {
    const initData: IDataParams = {
        data: [
            { key: 'LIQUID_DEPOSIT', type: 'integer', value: depo }
        ]
    };
    await setContractContext(initData, contract.publicKey, { privateKey: contract.privateKey });
};

export const withdraw = async function(
    contract: Contract,
    user: Account
) {
    const params = {
        dApp: contract.dApp,
        call: { function: 'withdraw' },
        payment: [
            {
                assetId: null,
                amount: env.network.WavesInvokeFee
            }
        ]
    };
    const tx = await invoke(params, user.privateKey);
    return tx;
};
