# Encryption Design

## 1. Encryption in Transit
- TLS 1.3 only (1.2 disabled), strong cipher suites (AEAD only: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256).
- HSTS with `includeSubDomains; preload`, minimum 1 year max-age.
- Internal traffic (proxy→app, app→DB) stays on a private Docker network; if ever crossing hosts, mTLS is required — not plaintext internal trust.

## 2. Key Hierarchy (Envelope Encryption)
```
Root Secret (KMS-equivalent: file-based master key, 0400 perms,
             mounted via Docker secret, never in image/env/git)
        │
        ▼
Key Encryption Key (KEK) — per organization, derived via HKDF
        │  from Root Secret + organization_id
        ▼
Data Encryption Key (DEK) — generated fresh per document/file,
        │  random 256-bit, wraps content with AES-256-GCM
        ▼
Ciphertext stored on disk; wrapped DEK stored alongside
(document_versions.encrypted_dek)
```
Rationale: compromising the DB alone yields only ciphertext + wrapped keys, not plaintext. Compromising the file store alone yields only ciphertext. The Root Secret is the single high-value target and is deliberately kept outside both the DB and the object store.

**Accepted risk (v1, explicit):** v1 stores the Root Secret as a 0400 file delivered via Docker secret, not an HSM/KMS. This is a deliberate scope decision for a self-hosted single-VPS deployment — introducing an HSM (e.g. YubiHSM2, AWS CloudHSM, SoftHSM+PKCS#11) adds operational complexity disproportionate to v1's threat profile, but it means anyone with root on the host at the moment the app process holds the secret in memory can potentially extract it. This is called out here, not left implicit, so the deploying operator makes an informed choice. **Upgrade path**: swap `core/security/crypto.py`'s root-secret loader for a PKCS#11/HSM-backed provider behind the same interface — no other code changes required. Recommended trigger for upgrading: any deployment handling regulated data (PII subject to breach-notification law, financial/health data) or crossing a per-org sensitivity threshold set by policy.

## 3. What Is Encrypted
| Data | At Rest | Method |
|---|---|---|
| Documents/files | Yes | AES-256-GCM, per-file DEK wrapped by org KEK |
| Chat messages | Yes | AES-256-GCM, per-channel or per-message DEK derived from org KEK |
| TOTP secrets | Yes | AES-256-GCM via app-level KEK |
| Refresh tokens | Hashed (not reversible), SHA-256 or Argon2-light | one-way — never need to decrypt |
| Passwords | Hashed | Argon2id — one-way |
| Backups | Yes | Encrypted archive, key stored separately from backup destination |
| Database volume | Yes (defense in depth) | Disk-level LUKS in addition to app-layer encryption |

## 4. Algorithm Choices & Justification
- **AES-256-GCM** for symmetric AEAD: authenticated encryption prevents tampering, hardware-accelerated (AES-NI), NIST-approved.
- **Argon2id** for passwords: OWASP-recommended, resistant to GPU/ASIC cracking, tunable memory-hardness.
- **EdDSA (Ed25519)** for JWT signing: fast, small signatures, avoids RSA padding pitfalls; RS256 acceptable fallback if library support requires it.
- **HKDF-SHA256** for key derivation from the root secret to per-org KEKs: standard, well-analyzed KDF for this exact purpose.
- Explicitly **not** using: MD5/SHA1 for anything security-relevant, ECB mode, custom/home-grown crypto — all forbidden by policy; only vetted library primitives (`cryptography` / `pyca` in Python) are used, never hand-rolled.

## 5. Key Rotation
- Root Secret: rotatable via a documented re-wrap procedure (decrypt all KEKs with old root, re-encrypt with new root) — offline maintenance operation, logged and requires System Administrator + secondary approval (two-person rule recommended for this operation).
- Org KEK rotation: re-wrap all DEKs for that org's documents/messages; versioned key IDs (`encrypted_dek` stores which KEK version wrapped it) so rotation can be incremental/background rather than a hard cutover.
- TOTP/session secrets: signing key rotation supported via `kid` header in JWTs; old key kept available only long enough to validate outstanding unexpired tokens, then destroyed.

## 6. Nonce/IV Handling
- GCM nonces: 96-bit, generated via CSPRNG per encryption operation, **never reused** with the same key (enforced by always generating fresh random nonce, not counter-based, to avoid multi-process counter-collision risk).

## 7. File Download Path (avoiding public URLs)
```
1. Client requests GET /api/v1/documents/{id}/download-url
2. Server verifies RBAC (can_view), verifies document not deleted
3. Server issues a signed token: HMAC-SHA256(secret, doc_id|version|expiry|nonce)
   valid for e.g. 60 seconds, single-use (nonce recorded in Redis, consumed on first use)
4. Client calls GET /api/v1/downloads/{token}
5. Server validates signature, expiry, single-use nonce; decrypts DEK via org KEK,
   streams decrypted content with Content-Disposition, never writes plaintext to disk
6. Token invalidated after use or expiry, whichever first
```

## 8. Search vs. Encryption (resolved contradiction)
The API spec exposes `GET /channels/{id}/search?q=` and `GET /projects/{id}/documents/search?q=` while message/document bodies are stored as AES-GCM ciphertext. These are not compatible unless resolved explicitly — ciphertext cannot be searched directly.

**v1 resolution: server-side plaintext indexing, not searchable encryption.**
- On write, the service layer holds plaintext transiently in memory (post-decrypt-on-read or pre-encrypt-on-write), derives a search index entry (PostgreSQL `tsvector`), and stores *that derived index* — not the raw ciphertext key — in a `message_search_index` / `document_search_index` table, scoped by `organization_id` and covered by the same RLS policy as the parent table.
- This means: **the server can read plaintext at index time** — consistent with "not E2EE" already stated as the v1 trust model (Section 8 below, and Threat Model residual risk). It is not a new weakening; it makes an existing property explicit and enforced consistently, instead of leaving search's implications undocumented.
- The search index itself is a second at-rest artifact containing derived plaintext (tokens) — it must be covered by the same encryption-at-rest expectations as the source (disk-level LUKS at minimum; consider column-level encryption for the index if token content is itself sensitive, e.g. hashing/truncating highly sensitive terms is out of scope for v1 free-text search).
- **Implication for the future E2EE option (Section 9):** any channel/document opted into true E2EE automatically loses server-side search for that channel/document — the search index is simply not populated for it. This must be surfaced in the UI (e.g., "search unavailable in end-to-end encrypted channels") so the tradeoff is visible to users, not silent.

## 9. Future Option: True E2EE for High-Sensitivity Channels (Roadmap, not v1)
For channels/documents requiring zero server-side plaintext access even from a compromised admin: client-side generated keypairs (e.g., X25519 for key agreement, per-channel symmetric key wrapped per-member public key), server stores only ciphertext it cannot decrypt. Trade-off: no server-side search/indexing, no admin content moderation/legal hold, more complex key-loss recovery (member device loss = data loss unless a recovery/escrow scheme is added). Documented as a v2 consideration requiring separate design and explicit product decision.
