import type { Address, WalletClient } from "viem";
import type { SupportedNetwork } from "@q402/core";

/**
 * Payment endpoint configuration
 */
export interface PaymentEndpointConfig {
  /**
   * Endpoint path (e.g., "/api/data")
   */
  path: string;

  /**
   * Payment amount in atomic units
   */
  amount: string;

  /**
   * Token contract address
   */
  token: Address;

  /**
   * Resource description
   */
  description: string;

  /**
   * Response MIME type
   */
  mimeType?: string;
}

/**
 * Middleware configuration
 */
export interface Q402MiddlewareConfig {
  /**
   * Network to use
   */
  network: SupportedNetwork;

  /**
   * Recipient address (where payments go)
   */
  recipientAddress: Address;

  /**
   * Implementation contract address
   */
  implementationContract: Address;

  /**
   * Verifying contract address (for EIP-712 domain)
   */
  verifyingContract: Address;

  /**
   * Wallet client for settlement (sponsor)
   */
  walletClient: WalletClient;

  /**
   * Payment endpoints configuration
   */
  endpoints: PaymentEndpointConfig[];

  /**
   * Auto-settle payments (default: true)
   */
  autoSettle?: boolean;

  /**
   * Timeout for payment verification (ms)
   */
  verificationTimeout?: number;
}

