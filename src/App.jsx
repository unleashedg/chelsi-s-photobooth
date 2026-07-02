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
  const [flash, setFlash] = useState(false);
  const [stripTime] = useState(
    new Date().toLocaleString([],{
    day:"2-digit",
    month:"short",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
    })
    );

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
    setFlash(true);

setTimeout(() => {
  setFlash(false);
},100);
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
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px",
      background: "transparent"
    }}
    >
      <h1
style={{
  fontSize: "70px",
  fontWeight: "700",
  marginBottom: "20px",
  color: "#F472B6",
  textShadow: "0 0 30px rgba(244,114,182,.45)"
}}
>
{timer ? timer : "📸 Chelsi's-Photobooth"}
</h1>

<p
style={{
opacity:.75,
marginBottom:"25px",
fontSize:"17px"
}}
>
Your ID

<br/>

<b
style={{
fontSize:"22px",
color:"#8B5CF6"
}}
>
{peerId}
</b>
</p>

      <div style={{ marginBottom: '20px' }}>
        <input
          placeholder="Partner ID"
          onChange={(e) => setRemotePeerId(e.target.value)}
          style={{
            width:"320px",
            padding:"16px",
            borderRadius:"14px",
            border:"none",
            outline:"none",
            fontSize:"16px",
            background:"#1E293B",
            color:"white",
            marginRight:"10px"
            }}
        />

        <button
          onClick={callPartner}
          style={{
            padding: "16px 30px",
            border: "none",
            borderRadius: "14px",
            background: "#8B5CF6",
            color: "white",
            fontWeight: "600",
            fontSize: "16px",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(139,92,246,.4)"
          }}
        >
          Call
        </button>

        <button
          onClick={triggerTimer}
          style={{
            padding: "16px 35px",
            border: "none",
            borderRadius: "14px",
            background: "#EC4899",
            color: "white",
            fontSize: "18px",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "0 10px 25px rgba(236,72,153,.45)"
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
            width: "100%",
            maxWidth: "450px",
            background: "#111827",
            borderRadius: "22px",
            border: "3px solid rgba(255,255,255,.08)",
            boxShadow: "0 20px 40px rgba(0,0,0,.35)",
            objectFit: "cover"
          }}
        />

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            maxWidth: "450px",
            background: "#111827",
            borderRadius: "22px",
            border: "3px solid rgba(255,255,255,.08)",
            boxShadow: "0 20px 40px rgba(0,0,0,.35)",
            objectFit: "cover"
          }}
        />
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div
        style={{
          display: "flex",
          gap: "25px",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "30px",
          marginBottom: "35px"
        }}
      >
        {photos.map((p, index) => (
          <div
            key={index}
            style={{
              display:"flex",
              flexWrap:"wrap",
              justifyContent:"center",
              gap:"15px",
              
              background:"#0F172A",
              
              borderRadius:"24px",
              
              padding:"20px",
              
              marginBottom:"35px",
              
              border:"10px solid #111",
              
              boxShadow:"0 20px 40px rgba(0,0,0,.45)"
              }}
          >
            {p.me && (
              <img
                src={p.me}
                alt={`Me ${index}`}
                style={{
                  width:"45%",
                  maxWidth:"210px",
                  borderRadius:"10px",
                  border:"8px solid white",
                  background:"white",
                  boxShadow:"0 8px 20px rgba(0,0,0,.3)"
                  }}
              />
            )}

            {p.partner && (
              <img
                src={p.partner}
                alt={`Partner ${index}`}
                style={{
                  width:"45%",
                  maxWidth:"210px",
                  borderRadius:"10px",
                  border:"8px solid white",
                  background:"white",
                  boxShadow:"0 8px 20px rgba(0,0,0,.3)"
                  }}
              />
            )}
            <p
style={{
width:"100%",
textAlign:"center",
marginTop:"15px",
color:"#bbb",
fontSize:"14px",
letterSpacing:"2px"
}}
>
{stripTime}
</p>
          </div>
        ))}
      </div>
      {flash && (
<div
style={{
position:"fixed",
top:0,
left:0,
width:"100%",
height:"100%",
background:"white",
opacity:.9,
zIndex:9999,
pointerEvents:"none"
}}
/>
)}
    </div>
  );
}