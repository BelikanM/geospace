// pages/CARTOGRAPHIE.js
import React, { useState } from "react";
import Map2D from "./Map2D";
import Map3D from "./Map3D";
import Map3D_AI from "./Map3D_AI";

export default function CARTOGRAPHIE() {
  const [mode, setMode] = useState("2D");  // "2D", "3D" ou "3D_AI"
  const [center, setCenter] = useState([5.3599517, -4.0082563]); // Exemple : Abidjan

  return (
    <div>
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000 }}>
        <button
          onClick={() => setMode("2D")}
          style={{
            padding: "10px 20px",
            marginRight: 5,
            backgroundColor: "#00cc66",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Passer en 2D
        </button>
        <button
          onClick={() => setMode("3D")}
          style={{
            padding: "10px 20px",
            marginRight: 5,
            backgroundColor: "#00cc66",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Passer en 3D
        </button>
        <button
          onClick={() => setMode("3D_AI")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#00cc66",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Mode IA
        </button>
      </div>
      {mode === "2D" && <Map2D center={center} />}
      {mode === "3D" && <Map3D />}
      {mode === "3D_AI" && <Map3D_AI />}
    </div>
  );
}
