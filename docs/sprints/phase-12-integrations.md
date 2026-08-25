# Phase 12 — Integrations

## T-1201 Integration account schema

**Objective:** Encrypted credentials, provider key, org.  
**Deps:** T-0201  
**AC:** Secrets not in API GET (masked).

## T-1202 Payment port + mock adapter

**Objective:** Interface + mock; webhook route stub.  
**Deps:** T-0607  
**AC:** Core payment service calls port only.

## T-1203 Email/SMS ports + mock

**Objective:** Worker jobs send via port.  
**Deps:** T-0009  
**AC:** Dev logs only.

## T-1204 Verified payment provider adapter

**Objective:** Implement **only** if sandbox keys exist; else skip and document.  
**Deps:** T-1202  
**AC:** No fake “live” claims.

## T-1205 Food delivery port + mock ingest

**Objective:** Normalize to ONLINE order.  
**Deps:** T-0603  
**AC:** Mock provider in tests.

## T-1206 Messaging WhatsApp port mock

**Objective:** Interface + mock.  
**Deps:** T-1203  
**AC:** No vendor in domain services.
