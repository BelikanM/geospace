// pages/CARTOGRAPHIE.js
import React, { useState } from "react";
import Map2D from "./Map2D";

export default function CARTOGRAPHIE() {
  const [center, setCenter] = useState([5.3599517, -4.0082563]); // Exemple : Abidjan

  return (
    <div style={{ position: "relative" }}>
      <Map2D center={center} />
      <div style={{ 
        position: "absolute", 
        bottom: 20, 
        left: "50%", 
        transform: "translateX(-50%)",
        zIndex: 1000 
      }}>
        <button
          style={{
            padding: "10px 20px",
            backgroundColor: "#00cc66",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
          }}
        >
          Passer en 2D
        </button>
      </div>
    </div>
  );
}

