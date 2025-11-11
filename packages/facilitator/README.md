# @q402/facilitator

Facilitator service for q402 - handles payment verification and settlement.

## Installation

```bash
npm install @q402/facilitator
```

Or run directly:

```bash
npx @q402/facilitator
```

## Configuration

Create a `.env` file:

```env
# Server Configuration
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=info

# Sponsor Account (for transaction signing)
SPONSOR_PRIVATE_KEY=0x...

# RPC URLs
RPC_URL_BSC_MAINNET=https://bsc-dataseed1.binance.org
RPC_URL_BSC_TESTNET=https://data-seed-prebsc-1-s1.binance.org:8545

# Implementation Whitelist (comma-separated)
IMPLEMENTATION_WHITELIST=0xImplementation1,0xImplementation2
```

## Running

### Development

```bash
pnpm run dev
```

### Production

```bash
pnpm run build
pnpm start
```

## API Endpoints

### POST /verify

Verify a payment payload.

**Request:**

```json
{
  "witnessSignature": "0x...",
  "authorization": {
    "chainId": 56,
    "address": "0x...",
    "nonce": 42,
    "yParity": 1,
    "r": "0x...",
    "s": "0x..."
  },
  "paymentDetails": {
    "scheme": "evm/eip7702-delegated-payment",
    "networkId": "bsc-mainnet",
    "token": "0x...",
    "amount": "1000000",
    "to": "0x...",
    "implementationContract": "0x...",
    "witness": { /* ... */ },
    "authorization": { /* ... */ }
  }
}
```

**Response:**

```json
{
  "isValid": true,
  "payer": "0x...",
  "details": {
    "witnessValid": true,
    "authorizationValid": true,
    "amountValid": true,
    "deadlineValid": true,
    "recipientValid": true
  }
}
```

### POST /settle

Submit a verified payment to blockchain.

**Request:** Same as /verify

**Response:**

```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": "12345678"
}
```

### GET /supported

List supported networks.

**Response:**

```json
{
  "version": 1,
  "networks": [
    {
      "networkId": "bsc-mainnet",
      "chainId": 56,
      "name": "BNB Smart Chain Mainnet",
      "explorer": "https://bscscan.com"
    }
  ]
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok"
}
```

## Security

The facilitator service:

- Verifies both witness and authorization signatures
- Checks implementation contracts against whitelist
- Validates payment amounts and deadlines
- Sponsors gas for all transactions
- Logs all verification and settlement attempts

## Monitoring

The facilitator logs:
- All verification attempts and results
- Settlement transactions with tx hashes
- Errors and failures
- Performance metrics

Integrate with your logging infrastructure for production monitoring.

## License

Apache-2.0

