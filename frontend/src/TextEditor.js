import { useCallback, useEffect, useRef, useState } from "react";
import { localSave } from "./utils";
import { v4 as uuidv4 } from "uuid";
import {
  DATA_CHANNEL,
  HOST_URL,
  SIGNALING_SERVER_ADDRESS,
  STUN_SERVERS,
} from "./constants";
import Quill from "quill";
import io from "socket.io-client";
import "quill/dist/quill.snow.css";

const socket = io(SIGNALING_SERVER_ADDRESS);
const replicaId = uuidv4();

export const TextEditor = () => {
  const [quill, setQuill] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 🔥 Use Map to store multiple peer connections
  const peerConnections = useRef(new Map()); // socketId -> RTCPeerConnection
  const dataChannels = useRef(new Map());    // socketId -> DataChannel
  const hasReceivedInitialSync = useRef(false); // Track if we got initial content

  /* ---------------- LOAD EXISTING DOCUMENT ON STARTUP ---------------- */
  
  useEffect(() => {
    if (!quill) return;

    // Fetch existing document content from file server
    const loadExistingDocument = async () => {
      try {
        const response = await fetch(`${HOST_URL}/getContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replicaId }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.curContent && data.curContent.length > 0) {
            console.log('Loading existing content from server:', data.curContent);
            // Convert CRDT content to Quill format
            const content = data.curContent.map(item => item.value).join('');
            quill.setText(content);
            hasReceivedInitialSync.current = true;
          }
        }
      } catch (error) {
        console.log('No existing document found or error loading:', error);
      }
      
      // Mark as initialized after attempting to load
      setIsInitialized(true);
    };

    loadExistingDocument();
  }, [quill]);

  /* ---------------- HELPER: Create Peer Connection ---------------- */
  
  const createPeerConnection = (peerId) => {
    console.log(`Creating peer connection for ${peerId}`);
    
    const pc = new RTCPeerConnection(STUN_SERVERS);
    
    // Handle ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("icecandidate", {
          candidate: e.candidate,
          to: peerId,
        });
      }
    };
    
    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      dataChannels.current.set(peerId, channel);
      
      channel.onmessage = (e) => {
        const data = JSON.parse(e.data);
        
        // Check if this is a full document sync or delta update
        if (data.type === 'full-sync') {
          console.log(`Received full document sync from ${peerId}`);
          
          // IMPORTANT: Only apply full sync if we haven't loaded content yet
          if (!hasReceivedInitialSync.current && quill) {
            console.log('Applying full sync (first time load)');
            quill.setContents(data.content);
            hasReceivedInitialSync.current = true;
          } else {
            console.log('Ignoring full sync (already have content)');
          }
        } else {
          // Regular delta update - always apply these
          console.log(`Received delta from ${peerId}:`, data);
          quill?.updateContents(data);
        }
      };
      
      channel.onopen = () => {
        console.log(`Data channel opened with ${peerId}`);
        // Send full document ONLY to new peer (not to everyone)
        // We do this when WE open a connection to them
      };
      
      channel.onclose = () => console.log(`Data channel closed with ${peerId}`);
    };
    
    peerConnections.current.set(peerId, pc);
    return pc;
  };

  /* ---------------- SEND FULL DOCUMENT TO NEW PEER ---------------- */
  
  const sendFullDocument = (channel) => {
    if (!quill || channel.readyState !== 'open') return;
    
    const currentContent = quill.getContents();
    console.log('Sending full document to new peer:', currentContent);
    
    // Send full document ONLY through this specific channel
    channel.send(JSON.stringify({
      type: 'full-sync',
      content: currentContent
    }));
  };

  /* ---------------- WebRTC: Handle New User Connection ---------------- */

  useEffect(() => {
    if (!isInitialized) return; // Wait until we've loaded our own content
    
    socket.on("user-connected", (newUserId) => {
      console.log(`New user connected: ${newUserId}, will send them full document`);
      
      // Create peer connection for new user
      const pc = createPeerConnection(newUserId);
      
      // Create data channel (we're the initiator)
      const channel = pc.createDataChannel(DATA_CHANNEL);
      dataChannels.current.set(newUserId, channel);
      
      channel.onmessage = (e) => {
        const data = JSON.parse(e.data);
        
        if (data.type === 'full-sync') {
          console.log(`Received full document sync from ${newUserId}`);
          
          // IMPORTANT: Only apply if we don't have content
          if (!hasReceivedInitialSync.current && quill) {
            console.log('Applying full sync (first time load)');
            quill.setContents(data.content);
            hasReceivedInitialSync.current = true;
          } else {
            console.log('Ignoring full sync (already have content)');
          }
        } else {
          console.log(`Received delta from ${newUserId}:`, data);
          quill?.updateContents(data);
        }
      };
      
      channel.onopen = () => {
        console.log(`Data channel opened with ${newUserId}, sending full document`);
        // WE opened the channel, so WE send them our content
        sendFullDocument(channel);
      };
      
      // Create and send offer
      pc.createOffer()
        .then((sdp) => {
          return pc.setLocalDescription(sdp);
        })
        .then(() => {
          socket.emit("offer", {
            sdp: pc.localDescription,
            to: newUserId,
          });
        });
    });

    return () => socket.off("user-connected");
  }, [quill, isInitialized]);

  /* ---------------- SIGNALING: Handle Offers ---------------- */

  useEffect(() => {
    socket.on("offer", ({ sdp, from }) => {
      console.log(`Received offer from ${from}`);
      
      // Create peer connection for this user if doesn't exist
      let pc = peerConnections.current.get(from);
      if (!pc) {
        pc = createPeerConnection(from);
      }
      
      pc.setRemoteDescription(sdp)
        .then(() => pc.createAnswer())
        .then((answer) => {
          return pc.setLocalDescription(answer);
        })
        .then(() => {
          socket.emit("answer", {
            sdp: pc.localDescription,
            to: from,
          });
        });
    });

    return () => socket.off("offer");
  }, [quill]);

  /* ---------------- SIGNALING: Handle Answers ---------------- */

  useEffect(() => {
    socket.on("answer", ({ sdp, from }) => {
      console.log(`Received answer from ${from}`);
      
      const pc = peerConnections.current.get(from);
      if (pc) {
        pc.setRemoteDescription(sdp);
      }
    });

    return () => socket.off("answer");
  }, []);

  /* ---------------- SIGNALING: Handle ICE Candidates ---------------- */

  useEffect(() => {
    socket.on("icecandidate", ({ candidate, from }) => {
      console.log(`Received ICE candidate from ${from}`);
      
      const pc = peerConnections.current.get(from);
      if (pc) {
        pc.addIceCandidate(candidate);
      }
    });

    return () => socket.off("icecandidate");
  }, []);

  /* ---------------- QUILL CHANGE HANDLER ---------------- */

  useEffect(() => {
    if (!quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;

      // 1️⃣ Persist locally (CRDT / backend)
      localSave({
        operationsList: delta.ops,
        replicaId,
      });

      // 2️⃣ Send delta to ALL connected peers (as regular delta, not full-sync)
      const deltaString = JSON.stringify(delta.ops);
      dataChannels.current.forEach((channel, peerId) => {
        if (channel.readyState === "open") {
          console.log(`Sending delta to ${peerId}`);
          channel.send(deltaString);
        }
      });
    };

    quill.on("text-change", handler);
    return () => quill.off("text-change", handler);
  }, [quill]);

  /* ---------------- INIT QUILL ---------------- */

  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;
    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);

    setQuill(
      new Quill(editor, {
        theme: "snow",
      })
    );
  }, []);

  /* ---------------- CLEANUP ON UNMOUNT ---------------- */
  
  useEffect(() => {
    return () => {
      // Close all connections when component unmounts
      peerConnections.current.forEach((pc) => pc.close());
      dataChannels.current.forEach((channel) => channel.close());
    };
  }, []);

  return <div className="container" ref={wrapperRef}></div>;
};