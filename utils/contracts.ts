import { getEnvironment } from 'relax-env-json';
const env = getEnvironment();

let initData: any;

import {
    seedWithNonce,
    privateKey,
    publicKey,
    address,
} from '@waves/ts-lib-crypto';
import { setData, transfer } from './transaction';
import { deployScript } from './script';
import { IDataParams, TSeedTypes } from '@waves/waves-transactions';
import { Asset } from './assets';
import { Account } from './accounts';

export type Contract = {
    name: string;
    privateKey: string;
    publicKey: string;
    dApp: string;
};

export const setInitData = function (newData: any) {
    initData = newData;
};

export const initContracts = async function (
    seed: string,
    nonceOffset = 1
): Promise<Contract[]> {
    const envContracts: string[] = env.contracts;
    const contracts = envContracts.map((name, nonce) => {
        return {
            name: name,
            path: env.contractsPath.concat(name, env.contractsExtention),
            privateKey: privateKey(seedWithNonce(seed, nonce + nonceOffset)),
            publicKey: publicKey(seedWithNonce(seed, nonce + nonceOffset)),
            dApp: address(
                seedWithNonce(seed, nonce + nonceOffset),
                env.network.chaidID
            ),
        };
    });

    await Promise.all(
        contracts.map(
            async ({ path, dApp, privateKey }) =>
                await transfer(
                    {
                        recipient: dApp,
                        amount: env.amountPerContract + 2,
                    },
                    seed
                ).then(async () => {
                    await deployScript(path, privateKey);
                })
        )
    );

    return contracts;
};

export const getContractByName = function (
    name: string,
    ctx: Mocha.Context | undefined
): Contract {
    return ctx?.contracts.filter((x: Contract) => x.name === name).shift();
};

export const initCryptoFiat = async function (
    contracts: Contract[],
    assets: Asset[]
) {
    return await Promise.all(
        contracts.map(async ({ name, publicKey, privateKey }) => {
            if (name === 'crypto-fiat') {
                const initDataWithAssets = setAssets(assets);
                await setContractContext(initDataWithAssets, publicKey, {
                    privateKey: privateKey,
                });
            }
        })
    );
};

export const initInsurance = async function (
    contracts: Contract[],
    assets: Asset[],
    accounts: Account[]
) {
    return await Promise.all(
        contracts.map(async ({ name, publicKey, privateKey }) => {
            if (name === 'insurance') {
                const insInitData = insSetAssets(assets, accounts);
                await setContractContext(insInitData, publicKey, {
                    privateKey: privateKey,
                });
            }
        })
    );
};

export const initCryptoFiatWithContext = async function (
    context: any,
    contracts: Contract[]
) {
    return await Promise.all(
        contracts.map(async ({ name, publicKey, privateKey }) => {
            if (name === 'crypto-fiat') {
                await setContractContext(context, publicKey, {
                    privateKey: privateKey,
                });
            }
        })
    );
};

export const setContractContext = async (
    data: IDataParams,
    publicKey: string,
    invoker: TSeedTypes
) => {
    const setConfigTx = await setData(data, publicKey, invoker);
    return setConfigTx;
};

const setAssets = (assets: Asset[]) => {
    initData.data.map((e: any) => {
        switch (e.key) {
            case 'CA__1':
                e.value = assets[0].assetId;
                break;
            case 'CA__2':
                e.value = assets[1].assetId;
                break;
            case 'CA__3':
                e.value = assets[2].assetId;
                break;
        }
        return e;
    });
    return initData;
};

const insSetAssets = (assets: Asset[], accounts: Account[]) => {
    initData.data.map((e: any) => {
        switch (e.key) {
            case 'ASSETS_ALLOWED': {
                let allowedAssets = '_waves_';
                assets.forEach((curr: any) => {
                    allowedAssets = allowedAssets + `${curr.assetId}_`;
                });
                e.value = allowedAssets;
                break;
            }
            case 'CALLERS_ALLOWED': {
                let allowedCallers = '_';
                accounts
                    .filter(
                        (f: any) =>
                            f.name == 'liquidator_1' ||
                            f.name == 'liquidator_2' ||
                            f.name == 'liquidator_3'
                    )
                    .forEach((curr: any) => {
                        allowedCallers = allowedCallers + `${curr.address}_`;
                    });
                e.value = allowedCallers;
                break;
            }
        }
        return e;
    });
    return initData;
};
