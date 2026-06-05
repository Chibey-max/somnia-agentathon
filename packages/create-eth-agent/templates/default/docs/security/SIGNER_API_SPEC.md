# Signer API Spec (Draft)

This document defines the signer boundary used by `runtime/src/signer-client.ts` when `SIGNER_MODE=proxy`.

## Request

- Method: `POST`
- URL: `SIGNER_PROXY_URL`
- Headers:
  - `content-type: application/json`
  - `authorization: Bearer <SIGNER_PROXY_TOKEN>` (optional but recommended)

Body:

```json
{
  "action": "agent_wallet_execute",
  "chainId": 11155111,
  "contractAddress": "0x...",
  "target": "0x...",
  "value": "10000000000000000",
  "data": "0x"
}
```

## Response

Success:

```json
{
  "txHash": "0x..."
}
```

Error:

```json
{
  "error": "human-readable reason"
}
```

with a non-2xx HTTP status.

## Env configuration

- `SIGNER_MODE=local|proxy` (default: `local`)
- `SIGNER_PROXY_URL` required when `SIGNER_MODE=proxy`
- `SIGNER_PROXY_TOKEN` optional bearer token

## Notes

- Local mode signs in-process using `AGENT_PRIVATE_KEY` for development only.
- Production should use proxy mode with KMS/HSM-backed custody and strict authn/authz.
