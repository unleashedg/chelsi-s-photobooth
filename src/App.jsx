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
  const [selectedFilter, setSelectedFilter] = useState("none");
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
  const downloadCanvasRef = useRef(null);
  const stripRef = useRef(null);
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

const getCanvasFilter = () => {
  switch (selectedFilter) {

    case "kodak":
      return `
        sepia(.18)
        saturate(1.35)
        contrast(.95)
        brightness(1.06)
        hue-rotate(-6deg)
      `;

    case "ilford":
      return `
        grayscale(100%)
        contrast(1.28)
        brightness(.98)
      `;

    case "fuji":
      return `
        saturate(1.45)
        contrast(1.08)
        brightness(1.04)
        hue-rotate(8deg)
      `;

    case "polaroid":
      return `
        saturate(.88)
        contrast(.92)
        brightness(1.12)
        sepia(.08)
      `;

    default:
      return "none";
  }
};

const capturePhoto = () => {

  setFlash(true);

  setTimeout(() => {
    setFlash(false);
  }, 100);

  const canvas = canvasRef.current;
  const video = localVideoRef.current;

  if (!canvas || !video) return null;

  const desiredRatio = 4 / 3;

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  let cropWidth = videoWidth;
  let cropHeight = videoHeight;

  if (videoWidth / videoHeight > desiredRatio) {

    cropWidth = videoHeight * desiredRatio;

  } else {

    cropHeight = videoWidth / desiredRatio;

  }

  const sx = (videoWidth - cropWidth) / 2;
  const sy = (videoHeight - cropHeight) / 2;

  canvas.width = 1200;
  canvas.height = 900;

  const ctx = canvas.getContext("2d");

  ctx.filter = getCanvasFilter();

  ctx.drawImage(
    video,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.filter = "none";

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

const downloadStrip = async () => {
  if (!photos.length) return;

  const canvas = downloadCanvasRef.current;
  const ctx = canvas.getContext("2d");

  const photoWidth = 500;
  const photoHeight = 375;
  const gap = 20;
  const padding = 40;

  canvas.width = photoWidth * 2 + gap + padding * 2;
  canvas.height =
    padding * 2 +
    120 +
    photos.length * (photoHeight + gap);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";

  ctx.fillText(
    "Chelsi's Photobooth",
    canvas.width / 2,
    55
  );

  const timestamp = new Date().toLocaleString();

  ctx.font = "20px Arial";

  ctx.fillText(
    timestamp,
    canvas.width / 2,
    90
  );

  const loadImage = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });

  let y = 120;

  for (const pair of photos) {
    const me = await loadImage(pair.me);
    const partner = await loadImage(pair.partner);

    ctx.drawImage(
      me,
      padding,
      y,
      photoWidth,
      photoHeight
    );

    ctx.drawImage(
      partner,
      padding + photoWidth + gap,
      y,
      photoWidth,
      photoHeight
    );

    y += photoHeight + gap;
  }

  const link = document.createElement("a");

  link.download = "Chelsis-Photobooth.png";

  link.href = canvas.toDataURL("image/png");

  link.click();
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
        <button
  onClick={downloadStrip}
  style={{
    padding: "16px 35px",
    marginLeft: "15px",
    border: "none",
    borderRadius: "14px",
    background: "#10B981",
    color: "white",
    fontSize: "18px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(16,185,129,.45)"
  }}
>
  ⬇ Download Strip
</button>
      </div>
      <div
  style={{
    marginBottom: "25px",
    display: "flex",
    alignItems: "center",
    gap: "15px"
  }}
>

  <span
    style={{
      color: "white",
      fontWeight: "600"
    }}
  >
    Film Stock
  </span>

  <select

    value={selectedFilter}

    onChange={(e)=>setSelectedFilter(e.target.value)}

    style={{
      padding: "14px 22px",
      borderRadius: "14px",
      background: "#0F172A",
      color: "white",
      border: "2px solid rgba(255,255,255,.08)",
      fontSize: "15px",
      fontWeight: "600",
      cursor: "pointer"
    }}
  >

<option value="none">📷 Original</option>

<option value="kodak">
🎞 Kodak Gold 200
</option>

<option value="fuji">
🌿 Fujifilm Superia
</option>

<option value="polaroid">
📸 Polaroid 600
</option>

<option value="ilford">
⚫ Ilford HP5
</option>

  </select>

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
            objectFit: "cover",
            filter: getCanvasFilter(),
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
            objectFit: "cover",
            filter:getCanvasFilter()
          }}
        />
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas
  ref={downloadCanvasRef}
  style={{ display: "none" }}
/>

      <div
  ref={stripRef}
  style={{
    width: "680px",
    maxWidth: "95vw",
    background: "#121212",
    borderRadius: "24px",
    padding: "35px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "25px",
    marginTop: "30px",
    marginBottom: "35px",
    boxShadow: "0 20px 60px rgba(0,0,0,.5)"
  }}
>
<div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: "45px",
    marginBottom: "15px"
  }}
>
  {[1,2,3,4].map((i)=>(
    <div
      key={i}
      style={{
        width:"18px",
        height:"18px",
        borderRadius:"50%",
        background:"#000",
        border:"2px solid #444"
      }}
    />
  ))}
</div>
  {photos.map((p, index) => (
          <div
            key={index}
            style={{
              display:"flex",
              flexWrap:"wrap",
              justifyContent:"center",
              gap:"15px",
              
              background:"transparent",
              border:"none",
              padding:"0",
              marginBottom:"18px",
              borderRadius:"0",
              
              boxShadow:"0 20px 40px rgba(0,0,0,.45)"
              }}
          >
            {p.me && (
              <img
                src={p.me}
                alt={`Me ${index}`}
                style={{
                  width:"260px",
                  height:"195px",
                  objectFit:"cover",
                  border:"10px solid white",
                  borderRadius:"12px",
                  background:"white",
                  boxShadow:"0 8px 20px rgba(0,0,0,.35)"
                }}              />
            )}

            {p.partner && (
              <img
                src={p.partner}
                alt={`Partner ${index}`}
                style={{
                  width:"260px",
                  height:"195px",
                  objectFit:"cover",
                  border:"10px solid white",
                  borderRadius:"12px",
                  background:"white",
                  boxShadow:"0 8px 20px rgba(0,0,0,.35)"
                }}
              />
            )}
           
          </div>
        ))}
        <p
  style={{
    color: "#d1d5db",
    marginTop: "20px",
    fontSize: "16px",
    letterSpacing: "2px",
    fontWeight: "500",
    textAlign: "center"
  }}
>
  {stripTime}
</p>
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