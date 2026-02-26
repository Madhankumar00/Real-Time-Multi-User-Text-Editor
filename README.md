# Real-Time Multi-User Text Editor

![demo](https://github.com/user-attachments/assets/ae50eb77-4793-43ce-a273-68bd3b12baf9)

A realtime collaborative rich-text editor using Conflict-free Replicated Data Types (CRDTs) and Google's WebRTC framework. With this editor, several users can edit documents together in realtime with automatic conflict-merge and user-intent preservation. The implementation of the CRDT is using a variant of the RGA (Replicated Growable Arrays) protocol. The RGA protocol is implemented as Timestamped Insertion List (TI List) and guarantees "Eventual Consistency".

## Key Features

- Real-time collaborative editing.
- Automatic merge conflict resolution using CRDTs.
- Peer to peer architecture using WebRTC.
- Local-first software implementation.
- User-intent preservation.