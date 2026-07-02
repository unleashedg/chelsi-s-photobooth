import { useEffect, useRef, useState } from 'react';
import { Peer } from 'peerjs';

export default function App() {
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [peerInstance, setPeerInstance] = useState(null);
  const [conn, setConn] = useState(null);
  const countdownRunning = useRef(false);
  const [timer, setTimer] = useState("");
  const [photos, setPhotos] = useState([
    { me: null, partner: null },
    { me: null, partner: null },
    { me: null, partner: null },
    { me: null, partner: null },
  ]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const connRef = useRef(null);
const peerRef = useRef(null);
const runningRef = useRef(false);

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    setPeerInstance(peer);

    peer.on('open', (id) => {
      setPeerId(id);
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
      });

    peer.on('call', (call) => {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          call.answer(stream);

          call.on('stream', (remoteStream) => {
            remoteVideoRef.current.srcObject = remoteStream;
          });
        });
    });

    peer.on("connection",(dataConn)=>{
      setupConnectionHandlers(dataConn);
  });
    return () => {
      peer.destroy();
    };
  }, []);

const setupConnectionHandlers = (dataConn) => {
  setConn(dataConn);

  dataConn.on("open", () => {
    console.log("Data channel connected");
  });

  dataConn.on("data", (message) => {
    console.log("Received:", message);

    switch (message.type) {
      case "START_TIMER":
  console.log("Received START_TIMER");

  startCountdown();

  break;

      case "NEW_PHOTO":
        setPhotos((prev) => {
          const next = [...prev];

          if (!next[message.index]) {
            next[message.index] = {
              me: null,
              partner: null,
            };
          }

          next[message.index] = {
            ...next[message.index],
            partner: message.photo,
          };

          return next;
        });

        break;

      default:
        console.log("Unknown message", message);
    }
  });
};
function setupConnectionHandlers(dataConn) {
  connRef.current = dataConn;
  setConn(dataConn);

  dataConn.on("open", () => {
    console.log("Data channel connected");
  });

  dataConn.on("data", async (msg) => {
    switch (msg.type) {

      case "START_TIMER":

        if (runningRef.current) return;

        runningRef.current = true;

        await startCountdown(false);

        runningRef.current = false;

        break;

      case "NEW_PHOTO":

        setPhotos(prev => {
          const next = [...prev];

          if (!next[msg.index]) {
            next[msg.index] = {
              me: null,
              partner: null
            };
          }

          next[msg.index].partner = msg.photo;

          return [...next];
        });

        break;

      default:
        break;
    }
  });
}
const callPartner = () => {

  const dataConn = peerRef.current.connect(remotePeerId);

  setupConnectionHandlers(dataConn);

  const call = peerRef.current.call(
    remotePeerId,
    localVideoRef.current.srcObject
  );

  call.on("stream",(remoteStream)=>{
      remoteVideoRef.current.srcObject = remoteStream;
  });

};

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = localVideoRef.current;
  
    if (!canvas || !video) return null;
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
  
    return canvas.toDataURL("image/png");
  };
  const startCountdown = async (sendSignal = true) => {
    if (sendSignal && connRef.current) {
      connRef.current.send({
          type: "START_TIMER"
      });
  }
    setPhotos([]);

    for (let j = 3; j > 0; j--) {
      setTimer(j);
      await new Promise((r) => setTimeout(r, 1000));
    }

    for (let i = 0; i < 4; i++) {
      setTimer(`SNAP ${i + 1}`);

      const myPhoto = capturePhoto();

      setPhotos((prev) => {
        const next = [...prev];

        if (!next[i]) {
          next[i] = {
            me: null,
            partner: null,
          };
        }

        next[i] = {
          ...next[i],
          me: myPhoto,
        };

        return next;
      });

      connRef.current?.send({
        type: "NEW_PHOTO",
        index: i,
        photo: myPhoto,
      });

      if (i < 3) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setTimer(null);
  };

  const triggerTimer = async () => {

    if (runningRef.current) return;

    runningRef.current = true;

    await startCountdown(true);

    runningRef.current = false;

};

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '20px',
        fontFamily: 'sans-serif',
      }}
    >
      <h1>{timer ? timer : 'Photobooth'}</h1>

      <p>
        Your ID: <strong>{peerId}</strong>
      </p>

      <div style={{ marginBottom: '20px' }}>
        <input
          placeholder="Partner ID"
          onChange={(e) => setRemotePeerId(e.target.value)}
        />

        <button
          onClick={callPartner}
          style={{
            padding: '10px 20px',
            margin: '5px',
          }}
        >
          Call
        </button>

        <button
          onClick={triggerTimer}
          style={{
            padding: '10px 20px',
            margin: '5px',
            fontWeight: 'bold',
          }}
        >
          Click a Pic!
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          justifyContent: 'center',
          padding: '10px',
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#333',
            borderRadius: '10px',
            objectFit: 'cover',
          }}
        />

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#333',
            borderRadius: '10px',
            objectFit: 'cover',
          }}
        />
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '20px',
        }}
      >
        {photos.map((p, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            {p.me && (
              <img
                src={p.me}
                alt={`Me ${index}`}
                style={{
                  width: '45%',
                  maxWidth: '200px',
                  border: '5px solid white',
                }}
              />
            )}

            {p.partner && (
              <img
                src={p.partner}
                alt={`Partner ${index}`}
                style={{
                  width: '45%',
                  maxWidth: '200px',
                  border: '5px solid white',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}