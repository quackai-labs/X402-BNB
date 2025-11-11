/**
 * Facilitator Client for q402 Protocol
 * 
 * HTTP client for communicating with facilitator services.
 * This replaces the local facilitator logic in core package.
 */

import type { SignedPaymentPayload } from "../types/payment";

/**
 * Facilitator API response types (matching x402 standard)
 */
export interface FacilitatorVerificationResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
  details?: {
    witnessValid: boolean;
    authorizationValid: boolean;
    amountValid: boolean;
    deadlineValid: boolean;
    recipientValid: boolean;
  };
}

export interface FacilitatorSettlementResponse {
  success: boolean;
  txHash?: string;
  blockNumber?: string;
  error?: string;
}

export interface FacilitatorSupportedResponse {
  kinds: Array<{
    scheme: string;
    network: string;
  }>;
}

/**
 * Standard x402 facilitator client
 */
export class FacilitatorClient {
  constructor(private readonly baseUrl: string) {
    if (!baseUrl) {
      throw new Error("Facilitator base URL is required");
    }
  }

  /**
   * Verify a payment payload with the facilitator
   * POST /verify endpoint
   */
  async verify(payload: SignedPaymentPayload): Promise<FacilitatorVerificationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(`Facilitator verification failed: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error during verification: ${error}`);
    }
  }

  /**
   * Settle a payment through the facilitator
   * POST /settle endpoint
   */
  async settle(payload: SignedPaymentPayload): Promise<FacilitatorSettlementResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(`Facilitator settlement failed: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error during settlement: ${error}`);
    }
  }

  /**
   * Get supported payment schemes and networks
   * GET /supported endpoint
   */
  async getSupported(): Promise<FacilitatorSupportedResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/supported`, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(`Failed to get supported schemes: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error getting supported schemes: ${error}`);
    }
  }

  /**
   * Health check endpoint
   */
  async health(): Promise<{ status: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
        throw new Error(`Health check error: ${String(error)}`);
      }
  }
}

/**
 * Default facilitator client instance
 * Can be configured via environment variables
 */
export function createFacilitatorClient(baseUrl?: string): FacilitatorClient {
  const url = baseUrl || process.env.FACILITATOR_URL || "http://localhost:8080";
  return new FacilitatorClient(url);
}

/**
 * Convenience functions for direct API calls
 */
export async function verifyPaymentWithFacilitator(
  payload: SignedPaymentPayload,
  facilitatorUrl?: string,
): Promise<FacilitatorVerificationResponse> {
  const client = createFacilitatorClient(facilitatorUrl);
  return await client.verify(payload);
}

export async function settlePaymentWithFacilitator(
  payload: SignedPaymentPayload,
  facilitatorUrl?: string,
): Promise<FacilitatorSettlementResponse> {
  const client = createFacilitatorClient(facilitatorUrl);
  return await client.settle(payload);
}
