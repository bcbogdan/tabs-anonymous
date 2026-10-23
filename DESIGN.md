# Tabs Anonymous design

## Trust and delivery

Each installation is both a possible participant and sponsor. A participant has one active sponsor; a sponsor may track multiple pairings. P-256 ECDSA SHA-256 signatures establish authority. Manual code exchange over an existing trusted channel provides transport; there is no server, automated email delivery, or WebRTC connection.

Cards contain name, email, and public SPKI key, signed by that key. Email is a claim, not inbox verification. Both pairing screens display a SHA-256 fingerprint and require the user to confirm it through a trusted conversation. Private nonextractable CryptoKeys persist in IndexedDB. Local Chrome storage contains public profiles, pairings, pending requests, signed decisions, and counters only. Browser ownership remains ultimate authority; this is accountability rather than tamper-proof access control.

## Protocol version 1

Codes start with `TA1.` and contain base64url-encoded UTF-8 JSON with `payload` and `signature`. Signatures cover a canonical JSON payload with sorted object keys. Strict per-kind schemas reject unknown fields, unsupported versions, invalid budgets, and invalid decision sequences. Maximum code size is 16,000 characters.

- `card`: signer public key, name, email.
- `pair`: participant signer, sponsor public key, random pairing ID, random request ID, name, email.
- `request`: participant signer, sponsor public key, pairing ID, request ID, total budget, reason.
- `decision`: sponsor signer, participant public key, pairing ID, request ID, monotonic sequence, approved flag, total budget.

Every payload also includes version and kind. Pairing and request identifiers use cryptographic UUIDs. Decisions must be signed by the selected sponsor, name this installation and pairing, match its outstanding request, and advance the stored sequence. Initial approval activates the pairing and locks the local budget. Declining initial pairing permits a new pairing. Subsequent declines preserve the existing budget and clear the request. Only one request is outstanding at a time. Sponsor responses are stored by request ID; duplicate imports return the original response without issuing a second decision. Requests for a declined or unknown pairing cannot be signed as budget decisions.

## Worker and UI

The MV3 worker serializes events/messages, enforces the budget, owns private-key operations, and saves state. Extension UIs only receive public identity and codes. Settings supports both roles; the over-limit page creates requests and imports decisions alongside specific/random/FIFO/LIFO replacement choices. No external host permissions are requested. Public tab metadata is used locally for the replacement UI, never in signed codes.

Existing pages are grandfathered when a budget is reduced. Waiting pages are excluded from admitted-tab counts. Normal non-incognito windows share a budget. Temporary-tab metadata and waiting destinations remain in session storage, so restarting Chrome resets timers and can lose a waiting tab’s original destination; extension reloads can also clear that state. The user may need to reopen the original URL manually. Alarms expire tabs when possible; browser suspension can delay execution.

## Remaining scope

Manual email/chat transport; no notifications or hosted relay. No key backup/rotation/revocation, sponsor switching UI, pending-request cancellation, or signed unsolicited budget changes. Reinstall/clear storage requires new identity and pairing. Sponsor history is retained locally without pruning in this prototype. A later relay can carry the same signed codes without authority to forge them. Recovery needs an explicit design before adding cloud backup or sync.
