import { useEffect, useRef, useState } from 'react';
import { Peer } from 'peerjs';

export default function App() {
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [peerInstance, setPeerInstance] = useState(null);
  const [conn, setConn] = useState(null);
  const [timer, setTimer] = useState(null);
  const [photos, setPhotos] = useState([]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const peer = new Peer();

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

    peer.on('connection', (dataConn) => {
      setConn(dataConn);

      dataConn.on('data', (data) => {
        if (data.type === 'start') {
          startCountdown();
        }

        if (data.type === 'snap') {
          setPhotos((prev) => {
            const next = [...prev];

            if (!next[data.index]) {
              next[data.index] = {
                me: null,
                partner: null,
              };
            }

            next[data.index] = {
              ...next[data.index],
              partner: data.data,
            };

            return next;
          });
        }
      });
    });

    return () => {
      peer.destroy();
    };
  }, []);

  const callPartner = () => {
    const dataConn = peerInstance.connect(remotePeerId);

    setConn(dataConn);

    const call = peerInstance.call(
      remotePeerId,
      localVideoRef.current.srcObject
    );

    call.on('stream', (remoteStream) => {
      remoteVideoRef.current.srcObject = remoteStream;
    });
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = localVideoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext('2d').drawImage(video, 0, 0);

    return canvas.toDataURL('image/png');
  };

  const startCountdown = async () => {
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

      if (conn) {
        conn.send({
          type: 'snap',
          data: myPhoto,
          index: i,
        });
      }

      if (i < 3) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setTimer(null);
  };

  const triggerTimer = () => {
    if (conn) {
      conn.send({
        type: 'start',
      });
    }

    startCountdown();
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