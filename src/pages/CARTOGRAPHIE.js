import React, { useState } from "react";
import Map2D from "./Map2D";
import Map3D from "./Map3D";

export default function CARTOGRAPHIE() {
  const [is3D, setIs3D] = useState(false);
  const [center, setCenter] = useState([5.3599517, -4.0082563]); // Par exemple Abidjan

  return (
    <div>
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000 }}>
        <button
          onClick={() => setIs3D(!is3D)}
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
          {is3D ? "Passer en 2D" : "Passer en 3D"}
        </button>
      </div>
      {is3D ? <Map3D /> : <Map2D center={center} />}
    </div>
  );
}
