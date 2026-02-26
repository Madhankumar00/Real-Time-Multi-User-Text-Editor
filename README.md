# Real-Time Multi-User Text Editor

https://github.com/user-attachments/assets/8a188dba-48f2-4995-bbb5-f456e7d46c19

A real-time multi-user text editor using Conflict-free Replicated Data Types (CRDTs) and Google's WebRTC framework. With this editor, several users can edit documents together in realtime with automatic conflict-merge and user-intent preservation. The implementation of the CRDT is using a variant of the RGA (Replicated Growable Arrays) protocol. The RGA protocol is implemented as Timestamped Insertion List (TI List) and guarantees "Eventual Consistency".

## Key Features

- Real-time collaborative editing - Multiple users can edit the same document simultaneously with instant updates.
- Automatic conflict resolution - CRDT ensures concurrent edits merge without overwriting data.
- Peer-to-peer architecture - Clients communicate directly using WebRTC (no central synchronization bottleneck).
- Local-first design - Changes are stored locally and synchronized automatically when connected.
- User-intent preservation - Editing actions are maintained without destroying others’ work.

## 🛠 Tech Stack

**Frontend:** React, Quill.js  
**Backend:** Node.js, Express.js, Socket.IO  
**Networking:** WebRTC  
**Data Sync:** CRDT (RGA)
