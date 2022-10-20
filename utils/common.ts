import { nodeInteraction } from '@waves/waves-transactions';
import {Asset} from './assets';
import {Account} from './accounts';
import { getEnvironment } from 'relax-env-json';
import { balance } from '@waves/waves-transactions/dist/nodeInteraction';
import { fetchHeight, fetchLast } from '@waves/node-api-js/cjs/api-node/blocks';
import { Contract } from './contracts';
import { fetchDataKey } from '@waves/node-api-js/cjs/api-node/addresses';
const env = getEnvironment();

export type Balance = {
    name: string,
    assetId: string,
    balance: number
}

export const getAssetBalance = async (
    asset: Asset,
    itemAccount: Account
): Promise<number> => {
    const assetBalance = await nodeInteraction.assetBalance(asset.assetId, itemAccount.address, env.network.nodeAPI);
    return parseInt(assetBalance.toString());
};

export const getBalance = async (address: string): Promise<number> => {
    const itemBalance = await balance(address, env.network.nodeAPI);
    return parseInt(itemBalance.toString());
};

export const getAllAssetBalances = async (
    assets: Asset[],
    account: Account
): Promise<Balance[]> => {
    const balances: Balance[] = [];
    for(const asset of assets) {
        const currBalance = await nodeInteraction.assetBalance(asset.assetId, account.address, env.network.nodeAPI);
        balances.push({
            name: asset.name,
            assetId: asset.assetId,
            balance: parseInt(currBalance.toString())
        });
    }
    return balances;
};

export const getLastLiquidationBlock = async (shift: number): Promise<number> => {
    const lastBlock = await fetchHeight(env.network.nodeAPI);
    return lastBlock.height + shift;
};

export const getLastBlockBase = async (): Promise<string> => {
    return (await fetchLast(env.network.nodeAPI)).id;
};

export const rollbackTo = async (block_id: string) => {
    if(await getLastBlockBase() != block_id) {
        return fetch(`${env.network.nodeAPI}/debug/rollback-to/${block_id}`, {
            method: 'DELETE',
            headers: {
                'X-API-Key': env.network.apiKey,
                'Content-Type': 'application/json'
            },
        }).then(response => console.info(response));
    }
};

export const getDataValue = async (contract: Contract, key: string, default_value: any = null): Promise<any> => {
    let result: any = default_value;
    try {
        const response = await fetchDataKey(env.network.nodeAPI, contract.dApp, key);
        result = response.value;
    } catch(e: any) {
        if(e.message != 'no data for this key') {
            throw new Error(e.message);
        }
    }
    return result;
};

export const liqBlockWaiting = (lastBlock: number): Promise<void> => {
    return new Promise((resolve) => {
        const i = setInterval(async () => {
            const block = await getLastLiquidationBlock(0);
            if(block > lastBlock) {
                clearInterval(i);
                resolve();
            }
        }, 1000);
    });
};
