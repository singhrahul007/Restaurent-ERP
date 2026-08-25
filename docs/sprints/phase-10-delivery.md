# Phase 10 — Delivery

## T-1001 Delivery schema

**Objective:** agents, deliveries, events, otp_hash, cod_amount_minor.  
**Deps:** T-0602  
**AC:** FK to orders DELIVERY type.

## T-1002 Agent online/offline API

**Objective:** `delivery.self`.  
**Deps:** T-1001  
**AC:** Audit optional.

## T-1003 Assign delivery

**Objective:** Manager assign; event `delivery.assigned` to `user:{id}`.  
**Deps:** T-1002, T-0010  
**AC:** Cannot assign other org.

## T-1004 Pickup and OTP confirm

**Objective:** Status workflow; OTP hashed verify.  
**Deps:** T-1003  
**AC:** OTP not in GET payloads.

## T-1005 COD tracking

**Objective:** Record COD collected vs expected.  
**Deps:** T-1004, T-0607  
**AC:** Money integers.

## T-1006 Driver PWA UI

**Objective:** Mobile shell: list, detail, call deeplink, OTP, online toggle.  
**Deps:** T-0307, T-1004  
**AC:** No other customers’ jobs.

## T-1007 Earnings summary API

**Objective:** Daily count/COD for self.  
**Deps:** T-1005  
**AC:** Agent cannot see others.

## T-1008 Maps adapter stub

**Objective:** Deep link Google/Apple maps from address; mock geocode.  
**Deps:** T-1006  
**AC:** No billed Maps API required.
