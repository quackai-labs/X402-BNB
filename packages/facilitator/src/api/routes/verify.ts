import type { Request, Response } from "express";
import type { SignedPaymentPayload } from "@q402/core";
import { SignedPaymentPayloadSchema } from "@q402/core";
import { verifyPaymentWithChecks } from "../../services/verification";
import type { EnvConfig } from "../../config/env";

/**
 * POST /verify
 * Verify a payment payload
 */
export async function handleVerify(
  req: Request,
  res: Response,
  config: EnvConfig,
): Promise<void> {
  try {
    // Validate request body

    console.log("/verify go req body", req.body);

    const parseResult = SignedPaymentPayloadSchema.safeParse(req.body);


    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid payment payload",
        details: parseResult.error.errors,
      });
      return;
    }

    const payload: SignedPaymentPayload = parseResult.data as SignedPaymentPayload;

    // Verify payment
    const result = await verifyPaymentWithChecks(payload, config);

    console.log("/verify go result", result);

    res.json(result);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

