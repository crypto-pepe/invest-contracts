import { Context } from 'mocha';
import {
  Account,
  initAccounts,
  setAssetsForAccounts,
  Asset,
  initAssets,
  Contract,
  createContracts,
  getLastBlockId,
  getDataValue,
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode } from '@waves/ts-lib-crypto';
// import { init, setDefaultClaimData, setSteps } from '../../steps/waves.staking';
import { getEnvironment } from 'relax-env-json';
import { deployMultisigContract, setTechContract } from '../../steps/hooks.common';
import { getTechUser, setSteps, signedTransfer } from '../../steps/common';
import { init as initMultisig } from '../../steps/multisig';
import { init as initNode } from '../../steps/leasing.node.new';
import {
  init as initWAdapter,
  setContract as setAdapterContract,
} from '../../steps/waves.staking.adapter';
import {
  init as initTokenized,
  setContract as setTokenizedContract,
} from '../../steps/tokenized.staking';
const env = getEnvironment();

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
      const assets = await initAssets(env.assets, rootSeed, env.network);
      console.table(assets);

      const accounts = await initAccounts(
        rootSeed,
        env.accounts,
        env.amountPerAccount,
        env.network
      );
      await setAssetsForAccounts(
        rootSeed,
        accounts,
        assets,
        env.amountPerAsset,
        env.network
      );
      console.table(accounts);

      const init_contracts = createContracts(
        rootSeed,
        env.contracts,
        env.network,
        accounts.length + 1
      );
      const contracts: Contract[] = [];
      const techContract = await setTechContract(init_contracts, rootSeed, 'test/tokenized.staking/');
      contracts.push(techContract);
      const isRedeploy = await getDataValue(
        init_contracts.filter(c => c.name === 'multisig')[0],
        'MULTISIG',
        env.network,
        false
      );
      setSteps(
        !isRedeploy ? techContract : init_contracts.filter(c => c.name === 'multisig')[0],
        accounts.filter(a => a.name == 'tech_acc')[0]
      );
      const multisig_ = await deployMultisigContract(init_contracts, 'multisig', rootSeed);
      contracts.push(multisig_);
      setSteps(
        multisig_,
        getTechUser()
      );
      await initRealMultisig(
        contracts,
        [getTechUser().publicKey],
        1
      );
      contracts.push(await deployMultisigContract(init_contracts, 'leasing_node_new', rootSeed));
      contracts.push(await deployMultisigContract(init_contracts, 'tokenized_staking', rootSeed));
      contracts.push(await deployMultisigContract(init_contracts, 'waves_staking_adapter', rootSeed));
      // 1. init leasing node
      await initLeasingNode(contracts);
      /**
       * 2. init staking adapter
       * 
       * target_  - tokenized staking contract
       * adaptee_ - leasing node address
       */
      await initWavesAdapter(contracts, accounts);
      // // 3. init tokenized staking
      await initTokenizedStaking(contracts);
      console.table(contracts);
            
      const context: InjectableContext = {
        accounts: accounts,
        assets: assets,
        contracts: contracts,
        start_block: await getLastBlockId(env.network),
      };
      Object.assign(this, context);
    }
  };
};

async function initRealMultisig(
  contracts: Contract[],
  owners: string[],
  quorum: number
) {
  try {
    await initMultisig(
      contracts.filter(c => c.name === 'multisig')[0],
      owners,
      quorum
    );
    console.info('multisig initialized');
  } catch {
    console.info('multisig already initialized');
  }
}

async function initLeasingNode(contracts: Contract[]) {
  try {
    await initNode(
      contracts.filter(c => c.name === 'leasing_node_new')[0],
      base58Encode(contracts.filter(c => c.name === 'multisig')[0].dApp),
      contracts.filter(c => c.name === 'waves_staking_adapter')[0].dApp
    );
    console.info('leasing node initialized');
  } catch {
    console.info('leasing node already initialized');
  }
}

async function initTokenizedStaking(contracts: Contract[]) {
  setTokenizedContract(contracts.filter(c => c.name === 'tokenized_staking')[0]);
  try {
    await initTokenized(
      base58Encode(contracts.filter(c => c.name === 'multisig')[0].dApp),
      initData.initStaking,
      {
        name: 'WAVES',
        description: 'WAVES token',
        assetId: 'WAVES',
        quantity: 1,
        decimals: 8
      },
      contracts.filter(c => c.name === 'waves_staking_adapter')[0].dApp
    );
    console.info('tokenized staking initialized');
  } catch {
    console.info('tokenized staking already initialized');
  }
}

async function initWavesAdapter(
  contracts: Contract[],
  accounts: Account[]
) {
  const adapter = contracts.filter(c => c.name === 'waves_staking_adapter')[0];
  setAdapterContract(adapter);
  try {
    await initWAdapter(
      base58Encode(contracts.filter(c => c.name === 'multisig')[0].dApp),
      contracts.filter(c => c.name === 'tokenized_staking')[0].dApp,
      contracts.filter(c => c.name === 'leasing_node_new')[0].dApp,
      accounts.filter(a => a.name === 'manager')[0].address,
      env.leasingNode.infraFee
    );
    console.info('waves adapter initialized');
  } catch {
    console.info('waves adapter already initialized');
  }
}
