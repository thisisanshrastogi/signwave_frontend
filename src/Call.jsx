import { useParams } from "react-router-dom";
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

function CallScreen() {
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

  const socket = useRef(
    socketio("http://localhost:5000", { autoConnect: false })
  );
  const pcRef = useRef(null); // PeerConnection reference

  let lastVideoTime = -1;
  let results = undefined;

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
    canvasElement.style.height = `250px`;
    webcam.style.height = `${videoHeight}px`;
    canvasElement.style.width = `250px`;
    webcam.style.width = `${videoWidth}px`;

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawingUtils.drawConnectors(
          landmarks,
          GestureRecognizer.HAND_CONNECTIONS,
          {
            color: "#88c8ff",
            lineWidth: 2,
          }
        );
        drawingUtils.drawLandmarks(landmarks, {
          color: "#fff",
          lineWidth: 1,
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
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
      },
      numHands: 2,
    });
    await predictWebcam();
  };

  const sendData = (data) => {
    socket.current.emit("data", {
      username: localUsername,
      room: roomName,
      data: data,
    });
  };

  const startConnection = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          height: 450,
          width: 450,
        },
      })
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;
        socket.current.connect();
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
      sendData({
        type: "candidate",
        candidate: event.candidate,
      });
    }
  };

  const onTrack = (event) => {
    console.log("Adding remote track");
    remoteVideoRef.current.srcObject = event.streams[0];
  };

  const createPeerConnection = () => {
    try {
      pcRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      });
      pcRef.current.onicecandidate = onIceCandidate;
      pcRef.current.ontrack = onTrack;

      pcRef.current.onconnectionstatechange = (event) => {
        console.log("Connection State: ", pcRef.current.connectionState);
      };

      const localStream = localVideoRef.current.srcObject;
      for (const track of localStream.getTracks()) {
        pcRef.current.addTrack(track, localStream);
      }
      console.log("PeerConnection created");
    } catch (error) {
      console.error("PeerConnection failed: ", error);
    }
  };

  const sendOffer = async () => {
    console.log("Sending offer");
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    sendData(offer);
  };

  const sendAnswer = async (data) => {
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
    console.log("Creating answer");
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    sendData(answer);
  };

  const signalingDataHandler = (data) => {
    if (!pcRef.current) {
      createPeerConnection();
    }
    if (data.type === "offer") {
      sendAnswer(data);
    } else if (data.type === "answer") {
      pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === "candidate") {
      pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
      console.log("Unknown Data");
    }
  };

  useEffect(() => {
    video = localVideoRef.current;
    canvasElement = canvasRef.current;
    canvasCtx = canvasElement.getContext("2d");
    createGestureRecognizer();
    socket.current.on("ready", () => {
      console.log("Ready to Connect!");
      if (!pcRef.current) {
        createPeerConnection();
      }
      sendOffer();
    });

    socket.current.on("data", (data) => {
      console.log("Data received: ", data);
      signalingDataHandler(data.data);
    });

    startConnection();

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex item-center justify-center relative h-dvh z-10 ">
      <div className="Local w-full flex  item-center justify-around  ">
        <video
          autoPlay
          muted
          playsInline
          ref={localVideoRef}
          className="rounded-xl m-auto border-2 border-grey-500"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="middleCanvas flex flex-col items-center justify-center">
          <canvas
            className="output_canvas mx-auto border-[0.5px] border-cyan-500 border-opacity-60 shadow-xl"
            id="output_canvas"
            width="400"
            height="400"
            ref={canvasRef}
            style={{
              // position: "absolute",
              // right: "0px",
              // top: "0px",
              transform: "scaleX(-1)",
            }}
          ></canvas>
          <div className="w-[50%]  h-[50px] text-center font-semibold flex items-center justify-center ">
            <p>{gestureOutput[0]}</p>
          </div>
        </div>

        <video
          autoPlay
          muted
          playsInline
          ref={remoteVideoRef}
          className="rounded-xl m-auto border-2 border-grey-500"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      {/* <div className="">Remote Stream</div> */}

      {/* <video autoPlay playsInline ref={remoteVideoRef} /> */}

      {/* <p>{gestureOutput}</p> */}
    </div>
  );
}

export default CallScreen;