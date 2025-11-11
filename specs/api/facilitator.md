# Facilitator API Specification

## Overview

The facilitator API provides verification and settlement services for x402 payments, following the standard x402 facilitator interface.

## Base URL

```
https://facilitator.example.com
```

## Authentication

No authentication required for public facilitators. Private facilitators may implement API keys.

## Endpoints

### POST /verify

Verify a payment payload without submitting to blockchain.

**Request:**
```json
{
  "x402Version": 1,
  "paymentHeader": "base64-encoded-payload",
  "paymentRequirements": {
    "scheme": "evm/eip7702-signature-based",
    "network": "bsc-mainnet",
    "maxAmountRequired": "50000000000000000",
    "resource": "/api/resource",
    "description": "Premium API access",
    "mimeType": "application/json",
    "payTo": "0x742F54094094CA5C52a49cEE0fcA0fB4E8f05bbe",
    "maxTimeoutSeconds": 60,
    "asset": "0x55d398326f99059fF775485246999027B3197955",
    "extra": {
      "name": "q402",
      "version": "1"
    }
  }
}
```

**Response (Success):**
```json
{
  "isValid": true,
  "payer": "0x1234567890123456789012345678901234567890",
  "details": {
    "witnessValid": true,
    "authorizationValid": true,
    "amountValid": true,
    "deadlineValid": true,
    "recipientValid": true
  }
}
```

**Response (Failure):**
```json
{
  "isValid": false,
  "invalidReason": "Invalid signature",
  "payer": "0x1234567890123456789012345678901234567890",
  "details": {
    "witnessValid": false,
    "authorizationValid": true,
    "amountValid": true,
    "deadlineValid": true,
    "recipientValid": true
  }
}
```

### POST /settle

Verify and settle a payment on the blockchain.

**Request:**
```json
{
  "x402Version": 1,
  "paymentHeader": "base64-encoded-payload",
  "paymentRequirements": {
    // Same as /verify
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "networkId": "bsc-mainnet",
  "blockNumber": "12345678"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Insufficient gas",
  "txHash": null,
  "networkId": "bsc-mainnet"
}
```

### GET /supported

Get supported payment schemes and networks.

**Response:**
```json
{
  "kinds": [
    {
      "scheme": "evm/eip7702-signature-based",
      "network": "bsc-mainnet"
    },
    {
      "scheme": "evm/eip7702-signature-based", 
      "network": "bsc-testnet"
    }
  ]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

## Error Codes

- `400 Bad Request` - Invalid request format or parameters
- `422 Unprocessable Entity` - Valid format but invalid payment data
- `500 Internal Server Error` - Facilitator internal error
- `503 Service Unavailable` - Blockchain or network unavailable

## Rate Limits

- Verification: 100 requests/minute per IP
- Settlement: 10 requests/minute per IP
- Supported: 60 requests/minute per IP

## CORS

All endpoints include appropriate CORS headers for web client access:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Monitoring

Facilitators should provide metrics for:
- Request volume and success rates
- Verification and settlement latency
- Blockchain confirmation times
- Error rates by type

## Security

- Input validation on all endpoints
- Rate limiting to prevent abuse
- Request/response logging for audit
- Private key protection for settlement wallet
