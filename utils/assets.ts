import { issue } from './transaction';

export const DefaultQuantity = 1000000000;

export type Asset = {
  name: string;
  description: string;
  quantity: number;
  decimals: number;
  assetId: string;
};

export const initAssets = async function (seed: string): Promise<Asset[]> {
    const assets: Asset[] = [
        {
            name: 'USDN',
            description: 'Neutrino USD',
            quantity: DefaultQuantity * 10 ** 6,
            decimals: 6,
            assetId: ''
        },
        {
            name: 'WBTC',
            description: 'Wrapped BTC',
            quantity: DefaultQuantity * 10 ** 8,
            decimals: 8,
            assetId: ''
        },
        {
            name: 'WETH',
            description: 'Wrapped ETH',
            quantity: DefaultQuantity * 10 ** 8,
            decimals: 8,
            assetId: ''
        },
    ];

    await Promise.all(
        assets.map(async (asset) => {
            const res_issue: any = await issue(
                {
                    name: asset.name,
                    description: asset.description,
                    quantity: asset.quantity,
                    decimals: asset.decimals,
                },
                seed
            );
            asset.assetId = res_issue.assetId;
        })
    );

    return assets;
};

export const getAssetByName = function(
    name: string,
    ctx: Mocha.Context | undefined
): Asset {
    return ctx?.assets
        .filter((x: Asset) => x.name === name)
        .shift();
};
