import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

const overpassURL = (lat, lon) =>
  `https://overpass-api.de/api/interpreter?data=[out:json];way[building](around:500,${lat},${lon});out geom;`;

export default function Map2D({ center }) {
  const [buildings, setBuildings] = useState([]);

  useEffect(() => {
    fetch(overpassURL(center[0], center[1]))
      .then(res => res.json())
      .then(data => {
        const shapes = data.elements.map(el => {
          const coords = el.geometry.map(pt => [pt.lat, pt.lon]);
          return coords;
        });
        setBuildings(shapes);
      });
  }, [center]);

  useEffect(() => {
    if (buildings.length > 0) {
      console.log("Bâtiments JSON exportés :", JSON.stringify(buildings));
    }
  }, [buildings]);

  return (
    <MapContainer center={center} zoom={18} style={{ height: "100vh", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {buildings.map((coords, i) => (
        <Polygon key={i} positions={coords} pathOptions={{ color: "#00cc66" }} />
      ))}
    </MapContainer>
  );
}
