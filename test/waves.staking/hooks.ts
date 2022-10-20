import { Context } from 'mocha';
import { Account, initAccounts, setAssetsForAccounts } from '../../utils/accounts';
import { Asset, initAssets } from '../../utils/assets';
import { Contract, initContracts } from '../../utils/contracts';
import { getLastBlockBase } from '../../utils/common';
import { invoke } from '../../utils/transaction';

export type TestContext = Mocha.Context & Context;
export type InjectableContext = Readonly<{
    accounts: Account[];
    assets: Asset[];
    contracts: Contract[];
    start_block: string;
}>;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const initData = require('./data/init.json');
const rootSeed = initData.rootSeed;

export const mochaHooks = async (): Promise<Mocha.RootHookObject> => {
    return {
        async beforeAll(this: Mocha.Context) {
            const assets = await initAssets(rootSeed);
            console.table(assets);

            const accounts = await initAccounts(rootSeed);
            await setAssetsForAccounts(rootSeed, accounts, assets);
            console.table(accounts);

            const contracts = await initContracts(
                rootSeed,
                accounts.length + 1
            );
            const stake = contracts.filter(c => c.name == 'waves_staking')[0];
            const user = accounts.filter(a => a.name == 'trinity')[0];
            try {
                await invoke(
                    {
                        dApp: stake.dApp,
                        call: { function: 'init' },
                        additionalFee: 100000000
                    },
                    user.privateKey
                );
                console.info('contract initialized');
            } catch {
                console.info('contract already initialized');
            }
            console.table(contracts);
            
            const context: InjectableContext = {
                accounts: accounts,
                assets: assets,
                contracts: contracts,
                start_block: await getLastBlockBase(),
            };

            Object.assign(this, context);
        }
    };
};