/**
 * Resource Server Helper for q402 Protocol
 * 
 * Helper functions for resource servers implementing x402 payment flow
 */

import type { PaymentRequiredResponse } from "../types/payment";

/**
 * Standard x402 payment header format
 */
export interface PaymentHeader {
  x402Version: number;
  scheme: string;
  network: string;
  payload: unknown;
}

/**
 * Standard x402 payment requirement format
 */
export interface PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: object;
}

/**
 * Create a 402 Payment Required response
 */
export function createPaymentRequired(
  accepts: PaymentRequirement[],
  error?: string,
): PaymentRequiredResponse {
  return {
    x402Version: 1,
    accepts,
    error,
  };
}

/**
 * Parse X-PAYMENT header
 */
export function parsePaymentHeader(header: string): PaymentHeader {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Invalid X-PAYMENT header: ${error}`);
  }
}

/**
 * Create X-PAYMENT-RESPONSE header content
 */
export function createPaymentResponse(
  success: boolean,
  options?: {
    error?: string;
    txHash?: string;
    networkId?: string;
    blockNumber?: string;
  },
): string {
  const response = {
    success,
    ...options,
  };
  
  return Buffer.from(JSON.stringify(response)).toString('base64');
}

/**
 * Validate payment header against requirements
 */
export function validatePaymentHeader(
  header: PaymentHeader,
  requirement: PaymentRequirement,
): { isValid: boolean; reason?: string } {
  if (header.scheme !== requirement.scheme) {
    return { isValid: false, reason: `Scheme mismatch: expected ${requirement.scheme}, got ${header.scheme}` };
  }
  
  if (header.network !== requirement.network) {
    return { isValid: false, reason: `Network mismatch: expected ${requirement.network}, got ${header.network}` };
  }
  
  if (header.x402Version !== 1) {
    return { isValid: false, reason: `Unsupported x402 version: ${header.x402Version}` };
  }
  
  return { isValid: true };
}

/**
 * Create payment requirement for EIP-7702 delegated payments
 */
export function createEip7702PaymentRequirement(
  amount: string,
  tokenAddress: string,
  recipientAddress: string,
  resource: string,
  description: string,
  network: string = "bsc-mainnet",
  mimeType: string = "application/json",
): PaymentRequirement {
  return {
    scheme: "evm/eip7702-signature-based",
    network,
    maxAmountRequired: amount,
    resource,
    description,
    mimeType,
    payTo: recipientAddress,
    maxTimeoutSeconds: 60,
    asset: tokenAddress,
    extra: {
      name: "q402",
      version: "1",
    },
  };
}
