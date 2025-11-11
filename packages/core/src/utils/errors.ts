/**
 * Base error class for q402 errors
 */
export class Q402Error extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "Q402Error";
  }
}

/**
 * Payment validation error
 */
export class PaymentValidationError extends Q402Error {
  constructor(message: string, details?: unknown) {
    super(message, "PAYMENT_VALIDATION_ERROR", details);
    this.name = "PaymentValidationError";
  }
}

/**
 * Signature error
 */
export class SignatureError extends Q402Error {
  constructor(message: string, details?: unknown) {
    super(message, "SIGNATURE_ERROR", details);
    this.name = "SignatureError";
  }
}

/**
 * Network error
 */
export class NetworkError extends Q402Error {
  constructor(message: string, details?: unknown) {
    super(message, "NETWORK_ERROR", details);
    this.name = "NetworkError";
  }
}

/**
 * Transaction error
 */
export class TransactionError extends Q402Error {
  constructor(message: string, details?: unknown) {
    super(message, "TRANSACTION_ERROR", details);
    this.name = "TransactionError";
  }
}

