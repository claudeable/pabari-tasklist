# Backup & Disaster Recovery Plan

## 1. Objectives
- **RPO (Recovery Point Objective)**: ≤ 24 hours (configurable to hourly for higher-tier deployments).
- **RTO (Recovery Time Objective)**: ≤ 4 hours for full-service restore on replacement hardware.

## 2. What Is Backed Up
| Data | Method | Frequency | Retention |
|---|---|---|---|
| PostgreSQL | `pg_dump`/WAL archiving | Full nightly + continuous WAL | 30 days rolling, monthly kept 1 year |
| File store (documents) | Incremental encrypted archive | Nightly | 30 days rolling |
| Root encryption secret | Manual, offline, split-custody (e.g. Shamir or simple dual-holder) | On creation/rotation only | Indefinite, offline media |
| Config (non-secret) | Git | Every change | Full history |

## 3. Backup Security
- Backups encrypted client-side (`scripts/backup.sh`) with a key **not** stored on the same host/volume as the backup destination — decouples "attacker with DB access" from "attacker with backup access."
- Backup destination: separate storage (different disk/host/off-site), access-controlled, not internet-writable beyond the backup push mechanism.
- Integrity: SHA-256 checksum recorded per backup archive; verified on every restore drill.

## 4. Restore Procedure (summary)
```
1. Provision clean host/container environment from known-good images.
2. Retrieve latest verified backup archive; verify checksum.
3. Decrypt using the offline-held backup key (two-person retrieval if split-custody).
4. Restore PostgreSQL (pg_restore) then replay WAL to target point-in-time if available.
5. Restore file store archive to the encrypted volume.
6. Restore root encryption secret from offline storage (required to decrypt document/message DEKs).
7. Bring up app containers pointed at restored data; run smoke tests (health checks, login,
   sample document decrypt) before opening to users.
8. Rotate any credentials that might have been exposed by the disaster (as a precaution).
```

## 5. Testing
- **Quarterly restore drill** to a sandbox environment, timed, results logged; failed drills trigger a corrective-action item before the next quarter.
- Backup job failures alert admin same-day (not discovered only at restore time).

## 6. Disaster Scenarios
| Scenario | Response |
|---|---|
| Single disk failure | Restore from most recent backup to new volume; RPO = time since last backup |
| Full VPS loss | Provision new VPS, redeploy via IaC/compose, restore data per Section 4 |
| Ransomware/encryption of live data | Do not pay; isolate host; restore from backup predating infection, after eradicating the entry vector (see Incident Response Plan) |
| Root encryption secret lost (no backup) | **Unrecoverable** for encrypted content — this is why the secret has its own dedicated offline backup independent of the data backup, explicitly to prevent this single point of failure |
| Corrupted backup | Fall back to next-oldest verified-good backup; this is why checksums are verified proactively, not only at restore time |

## 7. High Availability (beyond v1 single-VPS baseline)
Documented as an upgrade path, not required for v1: Postgres streaming replica + automated failover (Patroni/repmgr), multi-instance app behind a load balancer with sticky WS sessions or Redis-backed session affinity, object storage replicated across two physical locations.
