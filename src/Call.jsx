import { useParams } from "react-router-dom";
import { FaVideoSlash } from "react-icons/fa6";

import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { useState } from "react";
import { useRef, useEffect } from "react";
import socketio from "socket.io-client";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

// const Loader = () => {
//   return (
//     <div className="loader">
//       hello
//       {/* <span className="bar"></span>
//       <span className="bar"></span>
//       <span className="bar"></span> */}
//     </div>
//   );
// };
// const LoaderBig = () => {
//   return (
//     <div className="loader">
//       <span className="barBig"></span>
//       <span className="barBig"></span>
//       <span className="barBig"></span>
//     </div>
//   );
// };

function CallScreen() {
  const config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  // Disabling console logs
  // console.log = function (...args) {};
  let gestureRecognizer;
  const model_path = "./mark1.task";
  let runningMode = "VIDEO";
  const params = useParams();
  const localUsername = params.username;
  const roomName = params.room;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  let video;
  let canvasElement;
  let canvasCtx;
  const [gestureOutput, setGestureOutput] = useState("");
  const [loader, setLoader] = useState(true);

  const socket = useRef(
    socketio("http://172.16.207.228:9000", { autoConnect: false })
  );
  const pcRef = useRef(null); // PeerConnection reference

  let lastVideoTime = -1;
  let results = undefined;

  const toggleVideo = async () => {
    const stream = localVideoRef.current.srcObject;
    const tracks = stream.getVideoTracks();
    setVideoOff(!tracks[0].enabled);
    tracks[0].enabled = !tracks[0].enabled;
  };

  const handleVideoLoaded = () => {
    setLoader(false);
  };

  async function predictWebcam() {
    const webcam = localVideoRef.current;
    const videoWidth = webcam.videoWidth;
    const videoHeight = webcam.videoHeight;

    await gestureRecognizer.setOptions({ runningMode: "VIDEO" });

    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      results = await gestureRecognizer.recognizeForVideo(video, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);
    canvasElement.style.height = `200px`;
    // webcam.style.height = `${videoHeight}px`;
    canvasElement.style.width = `300px`;
    // webcam.style.width = `${videoWidth}px`;

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawingUtils.drawConnectors(
          landmarks,
          GestureRecognizer.HAND_CONNECTIONS,
          {
            color: "#06b6d4",
            lineWidth: 4,
          }
        );
        drawingUtils.drawLandmarks(landmarks, {
          color: "#fff",
          lineWidth: 0,
        });
      }
    }
    canvasCtx.restore();

    if (results.gestures && results.gestures.length > 0) {
      const categoryName = results.gestures[0][0].categoryName;
      const categoryScore = parseFloat(
        results.gestures[0][0].score * 100
      ).toFixed(2);
      const handedness = results.handednesses[0][0].displayName;
      setGestureOutput([categoryName, categoryScore, handedness]);
    } else {
      setGestureOutput([]);
    }

    window.requestAnimationFrame(predictWebcam);
  }

  const createGestureRecognizer = async () => {
    // Create task for image file processing:
    const vision = await FilesetResolver.forVisionTasks(
      // path/to/wasm/root
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mark1.task",
      },
      numHands: 2,
    });
    await predictWebcam();
  };

  const sendData = (data, type) => {
    socket.current.emit("data", {
      username: localUsername,
      room: roomName,
      data: data,
      type: type,
    });
  };

  const startConnection = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          width: { min: 200, ideal: 1920, max: 1920 },
          height: { min: 150, ideal: 1080, max: 1080 },
        },
      })
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;
        socket.current.connect();
        console.log("Socket connected ");
        socket.current.emit("join", {
          username: localUsername,
          room: roomName,
        });
      })
      .catch((error) => {
        console.error("Stream not found: ", error);
      });
  };

  const onIceCandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate");
      sendData(event.candidate, "candidate");
    }
  };

  const onTrack = (event) => {
    console.log("Adding remote track");
    remoteVideoRef.current.srcObject = event.streams[0];
  };

  const createPeerConnection = () => {
    try {
      console.log("Creating peer connection");
      pcRef.current = new RTCPeerConnection(config);
      pcRef.current.onicecandidate = onIceCandidate;
      pcRef.current.ontrack = onTrack;
      pcRef.current.onnegotiationneeded = handleNegotiationNeededEvent;
      pcRef.current.onremotetrack = handleRemotetrackEvent;
      pcRef.current.oniceconnectionstatechange =
        handleICEConnectionStateChangeEvent;

      pcRef.current.onconnectionstatechange = (event) => {
        console.log("Connection State: ", pcRef.current.connectionState);
      };

      const localStream = localVideoRef.current.srcObject;
      for (const track of localStream.getTracks()) {
        pcRef.current.addTrack(track, localStream);
      }
      localVideoRef.current.srcObject = localStream;
      console.log("PeerConnection created");
    } catch (error) {
      console.error("PeerConnection failed: ", error);
    }
  };

  const sendOffer = async () => {
    console.log("Sending offer");
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    sendData(offer, "offer");
  };

  const sendAnswer = async (data) => {
    console.log("here");
    console.log(data);
    const offer = new RTCSessionDescription(data.data);
    await pcRef.current.setRemoteDescription(offer);
    console.log("Creating answer");
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    sendData(answer, "answer");
  };

  const signalingDataHandler = (data) => {
    console.log(data);
    if (!pcRef.current) {
      createPeerConnection();
    }
    if (data.type === "offer" && pcRef.current.signalingState !== "stable") {
      console.log("trying to send answer");
      sendAnswer(data);
    } else if (data.type === "answer") {
      console.log("first answer");

      const answer = new RTCSessionDescription(data.data);
      pcRef.current.setRemoteDescription(answer);
    } else if (data.type === "candidate") {
      pcRef.current.addIceCandidate(new RTCIceCandidate(data.data));
    } else {
      console.log("Unknown Data");
    }
  };

  useEffect(() => {
    video = localVideoRef.current;
    canvasElement = canvasRef.current;
    canvasCtx = canvasElement.getContext("2d");
    createGestureRecognizer();
    startConnection();
    remoteVideoRef.current.addEventListener(
      "loadedmetadata",
      handleVideoLoaded
    );
    remoteVideoRef.current.addEventListener("canplay", handleVideoLoaded);
    socket.current.on("ready", () => {
      if (!pcRef.current) {
        console.log("Ready to Connect!");
        createPeerConnection();
      }
      // sendOffer();
    });

    socket.current.on("data", (data) => {
      signalingDataHandler(data);
    });

    return () => {
      socket.current.disconnect();
      console.log("Socket disconnected");
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="gradBack flex item-center justify-center relative w-dvw h-dvh  "
      style={{ position: "relative", zIndex: 1, padding: "20px" }}
    >
      <div className="Local w-full flex  item-center justify-around  ">
        {/* <div className="leftBox bg-current w-2/3"></div> */}

        <video
          autoPlay
          muted
          playsInline
          ref={localVideoRef}
          className="rounded-3xl m-auto "
          style={{ transform: "scaleX(-1)" }}
        />

        <div className="middleCanvas  flex flex-col items-center justify-center  w-[30%] h-[90%] rounded-2xl border border-neutral-700 border-opacity-30 my-auto bg-neutral-700 bg-opacity-10 ">
          <div className="remoteFeed  w-[80%] h-[200px] rounded-3xl   relative mt-4 mb-10 ">
            {loader ? (
              <Loader />
            ) : (
              <video
                autoPlay
                muted
                playsInline
                ref={remoteVideoRef}
                className="rounded-3xl m-0 p-0 border border-gray-400"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
          </div>
          <canvas
            className="output_canvas mx-auto border-[1.5px] rounded-xl border-cyan-500 border-opacity-60 shadow-md   shadow-cyan-600/40 "
            id="output_canvas"
            width="800"
            height="600"
            // width="800"
            // height="600"
            ref={canvasRef}
            style={{
              // position: "absolute",
              // right: "0px",
              // top: "0px",
              transform: "scaleX(-1)",
            }}
          ></canvas>
          <div className="w-[50%]  h-[50px] text-center font-bold flex items-center justify-center">
            <p>{gestureOutput[0]}</p>
          </div>
        </div>

        {/* <video
          autoPlay
          muted
          playsInline
          ref={remoteVideoRef}
          className="rounded-xl m-auto border-2 border-grey-500"
          style={{ transform: "scaleX(-1)" }}
        /> */}
      </div>

      {/* <div className="">Remote Stream</div> */}

      {/* <video autoPlay playsInline ref={remoteVideoRef} /> */}

      {/* <p>{gestureOutput}</p> */}
    </div>
  );
}

export default CallScreen;
