import type { Context, Next, MiddlewareHandler } from "hono";
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
 * Payment context type
 */
export interface PaymentContext {
  verified: boolean;
  payer: string;
  amount: string;
  token: string;
}

/**
 * Create q402 payment middleware for Hono
 */
export function createQ402Middleware(
  config: Q402MiddlewareConfig,
): MiddlewareHandler<{
  Variables: {
    payment?: PaymentContext;
  };
}> {
  return async (c: Context, next: Next) => {
    try {
      // Find matching endpoint
      const endpoint = config.endpoints.find((ep) => c.req.path === ep.path);

      if (!endpoint) {
        // Not a protected endpoint
        await next();
        return;
      }

      // Check for X-PAYMENT header
      const paymentHeader = c.req.header(X_PAYMENT_HEADER);

      if (!paymentHeader) {
        // No payment header - return 402
        return send402Response(c, config, endpoint);
      }

      // Decode payment payload
      let payload: SignedPaymentPayload;
      try {
        payload = decodeBase64<SignedPaymentPayload>(paymentHeader);
      } catch {
        return c.json(
          {
            error: "Invalid payment header format",
          },
          400,
        );
      }

      // Verify payment
      const verificationResult = await verifyPayment(payload);

      if (!verificationResult.isValid) {
        return c.json(
          {
            x402Version: 1,
            accepts: [],
            error: `Payment verification failed: ${verificationResult.invalidReason}`,
          },
          402,
        );
      }

      // Verification succeeded - attach payment info to context
      c.set("payment", {
        verified: true,
        payer: verificationResult.payer!,
        amount: payload.paymentDetails.amount,
        token: payload.paymentDetails.token,
      });

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

            c.header(X_PAYMENT_RESPONSE_HEADER, encodeBase64(executionResponse));
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
      await next();
    } catch (error) {
      console.error("Middleware error:", error);
      return c.json(
        {
          error: "Internal server error",
        },
        500,
      );
    }
  };
}

