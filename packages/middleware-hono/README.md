# @q402/middleware-hono

Hono middleware for q402 EIP-7702 delegated payment protocol.

## Installation

```bash
npm install @q402/middleware-hono hono viem
```

## Usage

```typescript
import { Hono } from "hono";
import { createQ402Middleware } from "@q402/middleware-hono";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const app = new Hono();

// Create sponsor wallet
const sponsor = privateKeyToAccount(process.env.SPONSOR_KEY);
const walletClient = createWalletClient({
  account: sponsor,
  chain: bscTestnet,
  transport: http(),
});

// Configure middleware
const paymentMiddleware = createQ402Middleware({
  network: "bsc-testnet",
  recipientAddress: "0xYourAddress",
  implementationContract: "0xImplementation",
  verifyingContract: "0xVerifier",
  walletClient,
  endpoints: [
    {
      path: "/api/premium",
      amount: "1000000", // 1 USDT
      token: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
      description: "Premium API access",
    },
  ],
  autoSettle: true,
});

// Apply middleware
app.use("*", paymentMiddleware);

// Protected route
app.get("/api/premium", (c) => {
  const payment = c.get("payment");
  
  return c.json({
    data: "Premium content",
    payer: payment?.payer,
    amount: payment?.amount,
  });
});

export default app;
```

## Features

- Automatic 402 response generation
- Payment signature verification
- Optional auto-settlement
- Payment info in Hono context
- X-PAYMENT-RESPONSE header with transaction details
- Fully typed with TypeScript

## Configuration

### Middleware Options

- `network` - Network to use (bsc-mainnet or bsc-testnet)
- `recipientAddress` - Address to receive payments
- `implementationContract` - EIP-7702 implementation contract
- `verifyingContract` - EIP-712 verifying contract
- `walletClient` - Wallet for settlement sponsoring
- `endpoints` - Array of protected endpoint configurations
- `autoSettle` - Auto-settle verified payments (default: true)
- `verificationTimeout` - Max time for verification (ms)

### Endpoint Configuration

Each endpoint in the `endpoints` array requires:

- `path` - Route path (e.g., "/api/data")
- `amount` - Payment amount in atomic units
- `token` - Token contract address
- `description` - Human-readable description
- `mimeType` - Optional response MIME type

## Context Variables

After successful payment verification, `c.get("payment")` contains:

```typescript
{
  verified: boolean;
  payer: string;      // Payer address
  amount: string;     // Payment amount
  token: string;      // Token address
}
```

## TypeScript Types

```typescript
import type { PaymentContext } from "@q402/middleware-hono";

app.get("/api/premium", (c: Context<{ Variables: { payment?: PaymentContext } }>) => {
  const payment = c.get("payment");
  // ...
});
```

## License

Apache-2.0

