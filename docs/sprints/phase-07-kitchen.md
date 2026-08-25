# Phase 7 — Kitchen

## T-0701 Kitchen ticket schema

**Objective:** tickets + items from confirmed orders.  
**Deps:** T-0608  
**AC:** Created in same tx as confirm or via outbox processor.

## T-0702 Kitchen APIs

**Objective:** list tickets by column; update item/ticket status.  
**Deps:** T-0701  
**AC:** `kitchen.update`; no payment fields in JSON.

## T-0703 Realtime kitchen events

**Objective:** Emit to `kitchen:{branchId}` only.  
**Deps:** T-0702, T-0010  
**AC:** Other branches do not receive.

## T-0704 KDS UI

**Objective:** Fullscreen columns, timers, contrast.  
**Deps:** T-0307, T-0703  
**AC:** No revenue UI.

## T-0705 Sound alert optional

**Objective:** Setting + audio on new ticket.  
**Deps:** T-0704  
**AC:** Mute control.

## T-0706 Ready → order READY sync

**Objective:** When tickets done, order status READY.  
**Deps:** T-0702, T-0602  
**AC:** State machine respected.
