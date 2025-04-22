import React, { useState } from "react";
import Map2D from "./Map2D";
import Map3D from "./Map3D";
import Audio from "./pages/audio"; // Import du composant Audio

export default function CARTOGRAPHIE() {
  const [center, setCenter] = useState([5.3599517, -4.0082563]); // Abidjan
  const [mode, setMode] = useState("2D");
  const [showAudio, setShowAudio] = useState(false);

  // Si on veut afficher Audio, on le montre et on cache la carte
  if (showAudio) {
    return <Audio onBack={() => setShowAudio(false)} />;
  }

  // Sinon on affiche la carte normalement
  return (
    <div style={{ position: "relative", height: "100vh" }}>
      {mode === "2D" ? <Map2D center={center} /> : <Map3D />}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          gap: "10px",
        }}
      >
        {/* Bouton pour basculer entre 2D et 3D */}
        <button
          onClick={() => setMode(mode === "2D" ? "3D" : "2D")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#00cc66",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          Passer en {mode === "2D" ? "3D (RA)" : "2D"}
        </button>

        {/* Bouton pour afficher le composant Audio */}
        <button
          onClick={() => setShowAudio(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#3366ff",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          Audio Trace
        </button>
      </div>
    </div>
  );
}

