import type { Address, Hex } from "viem";

/**
 * EIP-712 domain for q402 witness signatures
 */
export interface Eip712Domain {
  name: string;
  version?: string;
  chainId: number;
  verifyingContract: Address;
}

/**
 * Witness message for single payment
 */
export interface WitnessMessage {
  /**
   * Owner/payer address
   */
  owner: Address;

  /**
   * Token contract address
   */
  token: Address;

  /**
   * Amount in atomic units
   */
  amount: bigint;

  /**
   * Recipient address
   */
  to: Address;

  /**
   * Deadline timestamp (unix seconds)
   */
  deadline: bigint;

  /**
   * Unique payment identifier
   */
  paymentId: Hex;

  /**
   * Application-level nonce
   */
  nonce: bigint;
}

/**
 * Single payment item for batch payments
 */
export interface PaymentItem {
  token: Address;
  amount: bigint;
  to: Address;
}

/**
 * Witness message for batch payments
 */
export interface BatchWitnessMessage {
  owner: Address;
  items: PaymentItem[];
  deadline: bigint;
  paymentId: Hex;
  nonce: bigint;
}

/**
 * EIP-712 typed data for witness signing
 */
export interface WitnessTypedData {
  domain: Eip712Domain;
  types: {
    Witness: Array<{ name: string; type: string }>;
  };
  primaryType: "Witness";
  message: WitnessMessage;
}

/**
 * EIP-712 typed data for batch witness signing
 */
export interface BatchWitnessTypedData {
  domain: Eip712Domain;
  types: {
    BatchWitness: Array<{ name: string; type: string }>;
    PaymentItem: Array<{ name: string; type: string }>;
  };
  primaryType: "BatchWitness";
  message: BatchWitnessMessage;
}

