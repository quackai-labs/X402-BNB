/**
 * Supported EVM networks for q402 protocol
 */
export const SupportedNetworks = {
  BSC_MAINNET: "bsc-mainnet",
  BSC_TESTNET: "bsc-testnet",
} as const;

export type SupportedNetwork = (typeof SupportedNetworks)[keyof typeof SupportedNetworks];

/**
 * Network configuration for different chains
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
}

/**
 * Network configurations
 */
export const NetworkConfigs: Record<SupportedNetwork, NetworkConfig> = {
  [SupportedNetworks.BSC_MAINNET]: {
    chainId: 56,
    name: "BNB Smart Chain Mainnet",
    rpcUrl: "https://bsc-dataseed1.binance.org",
    explorer: "https://bscscan.com",
  },
  [SupportedNetworks.BSC_TESTNET]: {
    chainId: 97,
    name: "BNB Smart Chain Testnet",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorer: "https://testnet.bscscan.com",
  },
};

