import type { Request, Response, NextFunction } from "express";
import { decodeBase64, verifyPayment, settlePayment, encodeBase64 } from "@q402/core";
import type { SignedPaymentPayload, PaymentExecutionResponse } from "@q402/core";
import type { Q402MiddlewareConfig } from "./config";
import { send402Response } from "./handlers";

/**
 * X-PAYMENT header name
 */
const X_PAYMENT_HEADER = "x-payment";

/**
 * X-PAYMENT-RESPONSE header name
 */
const X_PAYMENT_RESPONSE_HEADER = "x-payment-response";

/**
 * Create q402 payment middleware for Express
 */
export function createQ402Middleware(config: Q402MiddlewareConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Find matching endpoint
      const endpoint = config.endpoints.find((ep) => req.path === ep.path);

      if (!endpoint) {
        // Not a protected endpoint
        next();
        return;
      }

      // Check for X-PAYMENT header
      const paymentHeader = req.headers[X_PAYMENT_HEADER] as string | undefined;

      if (!paymentHeader) {
        // No payment header - return 402
        send402Response(res, config, endpoint, req);
        return;
      }

      // Decode payment payload
      let payload: SignedPaymentPayload;
      try {
        payload = decodeBase64<SignedPaymentPayload>(paymentHeader);
      } catch {
        res.status(400).json({
          error: "Invalid payment header format",
        });
        return;
      }

      // Verify payment
      const verificationResult = await verifyPayment(payload);

      if (!verificationResult.isValid) {
        res.status(402).json({
          x402Version: 1,
          accepts: [],
          error: `Payment verification failed: ${verificationResult.invalidReason}`,
        });
        return;
      }

      // Verification succeeded - proceed with request
      // Attach payment info to request for use by route handlers
      (req as any).payment = {
        verified: true,
        payer: verificationResult.payer,
        amount: payload.paymentDetails.amount,
        token: payload.paymentDetails.token,
      };

      // Settle payment if auto-settle is enabled
      if (config.autoSettle !== false) {
        try {
          const settlementResult = await settlePayment(config.walletClient, payload);

          if (settlementResult.success) {
            // Add settlement response header
            const executionResponse: PaymentExecutionResponse = {
              txHash: settlementResult.txHash!,
              blockNumber: settlementResult.blockNumber,
              status: "confirmed",
            };

            res.setHeader(X_PAYMENT_RESPONSE_HEADER, encodeBase64(executionResponse));
          } else {
            console.error("Settlement failed:", settlementResult.error);
            // Continue anyway - payment was verified
          }
        } catch (error) {
          console.error("Settlement error:", error);
          // Continue anyway - payment was verified
        }
      }

      // Continue to route handler
      next();
    } catch (error) {
      console.error("Middleware error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}

/**
 * Extend Express Request type to include payment info
 */
declare global {
  namespace Express {
    interface Request {
      payment?: {
        verified: boolean;
        payer: string;
        amount: string;
        token: string;
      };
    }
  }
}

