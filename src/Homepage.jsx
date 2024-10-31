import { useState } from "react";
import { Link } from "react-router-dom";
import { FaDiceD6 } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ParticleBackground from "./ParticleBackground";

function HomeScreen() {
  const navigate = useNavigate();
  const [room, setRoom] = useState("");
  const [username, setUsername] = useState("");

  const joinMeeting = () => {
    if (username.trim() === "" || room.trim() === "") {
      alert("Please enter valid username and room id");
      return;
    }
    navigate(`/call/${username}/${room}`);
  };

  const generateRoom = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < 7; i++) {
      if (i === 3) result += "-";
      else {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }
    }
    setRoom(result);
  };

  return (
    <div
      className="card  text-neutral-content w-[39%]  flex flex-col items-center justify-center gap-7 backdrop-blur-sm border-[1.5px] border-gray-600 bg-opacity-60 "
      style={{ position: "relative", zIndex: 1, padding: "20px" }}
    >
      <div className="username flex items-center w-full gap-4 py-4 ">
        <span className="text-white font-semibold">Username</span>
        <input
          value={username}
          title="username"
          className="input input-bordered w-[70%] max-w-xs"
          placeholder=""
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="meetingId flex items-center w-full gap-4">
        <span className="text-white font-semibold">Meeting Id</span>
        <input
          value={room}
          title="room"
          type="text"
          className="input input-bordered w-[70%] max-w-xs"
          placeholder=""
          onChange={(e) => setRoom(e.target.value)}
        />
        <button onClick={generateRoom}>
          <FaDiceD6 className="text-2xl text-primary" />
        </button>
      </div>

      <button className="btn btn-primary font-bold mb-2" onClick={joinMeeting}>
        Join Meeting
      </button>
    </div>
  );
}

export default HomeScreen;
