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
import { MdCallEnd } from "react-icons/md";
import { useNavigate } from "react-router-dom";
const Loader = () => {
  return (
    <div className="loader">
      hello
      {/* <span className="bar"></span>
      <span className="bar"></span>
      <span className="bar"></span> */}
    </div>
  );
};
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
  let gestureRecognizer;
  const model_path = "./mark1.task";
  let runningMode = "VIDEO";
  const params = useParams();
  const localUsername = params.username;
  const roomName = params.room;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);

  const navigate = useNavigate();
  let video;
  let canvasElement;
  let canvasCtx;
  const [gestureOutput, setGestureOutput] = useState("");
  const [loader, setLoader] = useState(true);
  const [anotherLoader, setAnotherLoader] = useState(true);

  const endCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localVideoRef.current.srcObject) {
      const localStream = localVideoRef.current.srcObject;
      localStream.getTracks().forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (socket.current.connected) {
      socket.current.disconnect();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    navigate("/");
  };

  const socket = useRef(
    socketio("http://172.16.207.228:9000", { autoConnect: false })
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
            color: "#06b6d4",
            lineWidth: 4,
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
        modelAssetPath: "/mark1.task",
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
          height: 500,
          width: 800,
        },
      })
      .then((stream) => {
        console.log("Local Stream found");

        localVideoRef.current.srcObject = stream;

        setLoader(false);
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
    setAnotherLoader(false);
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
    <div
      className="gradBack flex item-center justify-center relative w-dvw h-dvh  "
      style={{ position: "relative", zIndex: 1, padding: "20px" }}
    >
      <div className="Local w-full flex  item-center justify-around relative ">
        {loader && <Loader />}
        {/* <div className="leftBox bg-current w-2/3"></div> */}
        <div className="w-fit h-full min-w-[60%] flex items-center justify-center">
          <video
            autoPlay
            muted
            playsInline
            ref={localVideoRef}
            className="rounded-3xl m-auto "
            style={{ transform: "scaleX(-1)" }}
          />
          <button
            onClick={endCall}
            className="bg-red-600 btn text-white rounded-badge absolute bottom-16 m-auto w-[60px]"
          >
            <MdCallEnd />
          </button>
        </div>

        <div className="middleCanvas flex flex-col items-center justify-center  w-[30%] h-[90%] rounded-2xl border border-neutral-700 border-opacity-30 my-auto bg-neutral-700 bg-opacity-10 ">
          <div className="remoteFeed w-[80%] h-[200px] rounded-3xl overflow-hidden  relative mt-4 mb-10 ">
            <video
              autoPlay
              muted
              playsInline
              ref={remoteVideoRef}
              className="rounded-3xl m-0 p-0 border border-gray-400"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
          <canvas
            className="output_canvas mx-auto border-[1.5px] rounded-xl border-cyan-500 border-opacity-60 shadow-md   shadow-cyan-600/40"
            id="output_canvas"
            width="800"
            height="600"
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
