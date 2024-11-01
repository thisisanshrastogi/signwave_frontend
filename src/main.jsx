import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from "./App.jsx";
import ParticleBackground from "./ParticleBackground.jsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Homepage from "./Homepage.jsx";
import Call from "./Call.jsx";
import DarkRadialGradientBackground from "./DarkRadialGradientBackground.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <div
        className="flex items-center justify-center"
        style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}
      >
        <ParticleBackground />
        <Homepage />,
      </div>
    ),
  },
  {
    path: "/call/:username/:room",
    element: (
      <div
        className="flex item-center justify-center"
        style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}
      >
        {/* <DarkRadialGradientBackground> */}
        {/* </DarkRadialGradientBackground> */}
        {/* <ParticleBackground /> */}
        <Call />
      </div>
    ),
  },
]);
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
