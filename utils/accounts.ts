import { getEnvironment } from 'relax-env-json';
const env = getEnvironment();

import {
    seedWithNonce,
    privateKey,
    publicKey,
    address,
    TPrivateKey,
} from '@waves/ts-lib-crypto';
import { transfer } from './transaction';
import { Asset } from './assets';
import { balance } from '@waves/waves-transactions/dist/nodeInteraction';

export type Account = {
  name: string;
  privateKey: TPrivateKey;
  publicKey: string;
  address: string;
  amount?: number;
  orderId?: number;
  exchangeId?: number;
};

export const initAccounts = async function (
    seed: string,
    nonceOffset = 1
): Promise<Account[]> {
    const accounts = env.accounts.map(
        (name: string, nonce: number) => {
            return {
                name: name,
                privateKey: {
                    privateKey: privateKey(seedWithNonce(seed, nonce + nonceOffset)),
                },
                publicKey: publicKey(seedWithNonce(seed, nonce + nonceOffset)),
                address: address(
                    seedWithNonce(seed, nonce + nonceOffset),
                    env.network.chaidID
                ),
            };
        }
    );

    await Promise.all(
        accounts.map(async (account: Account) => {
            await transfer(
                {
                    recipient: account.address,
                    amount: env.amountPerAccount,
                },
                seed
            );
            account.amount = await balance(account.address, env.network.nodeAPI);
        })
    );

    return accounts;
};

export const setAssetsForAccounts = async function(
    seed: string,
    accounts: Account[],
    assets: Asset[]
) {
    await Promise.all(
        accounts.map(async (account: Account) => {
            assets.map(async (asset: Asset) => {
                await transfer(
                    {
                        recipient: account.address,
                        amount: env.amountPerAsset,
                        assetId: asset.assetId
                    },
                    seed
                );
            });
        })
    );
};

export const getAccountByName = function(
    name: string,
    ctx: Mocha.Context | undefined
): Account {
    return ctx?.accounts
        .filter((x: Account) => x.name === name)
        .shift();
};
