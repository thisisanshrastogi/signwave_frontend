import React from "react";

const DarkRadialGradientBackground = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full bg-gray-950 overflow-hidden">
      {/* Radial gradient overlays */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 50%, rgba(88, 28, 135, 0.15), transparent 70%), radial-gradient(circle at 80% 50%, rgba(29, 78, 216, 0.15), transparent 70%)",
        }}
      ></div>

      {/* Ambient light effects */}
      <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-purple-500/10 blur-3xl rounded-full"></div>
      <div className="absolute bottom-[-50%] right-[-50%] w-full h-full bg-blue-500/10 blur-3xl rounded-full"></div>

      {/* Content wrapper */}
      <div className="relative z-10 p-8">
        <div className="grid grid-cols-2 gap-4">
          {/* Example card */}
          {/* <div className="relative bg-black/20 backdrop-blur-sm rounded-3xl p-4 border border-white/10"> */}
          {/* Inner glow effects */}
          {/* <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div> */}
          {/* <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div> */}

          {/* Card content */}
          {/* <div className="relative">{children}</div> */}
          {/* </div> */}
        </div>
      </div>
    </div>
  );
};

export default DarkRadialGradientBackground;
// #1a2028
// 31243b
// #2d3665

// 541d39
