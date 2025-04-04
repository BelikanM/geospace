// pages/Map2D.js
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { databases, DATABASE_ID, COLLECTION_ID, ID } from './appwrite';

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
        // Enregistrer chaque bâtiment dans Appwrite
        shapes.forEach(shape => saveBuilding(shape));
      })
      .catch(error => console.error("Erreur récupération bâtiments:", error));
  }, [center]);

  const saveBuilding = async (coords) => {
    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        {
          coords: JSON.stringify(coords),
          timestamp: new Date().toISOString()
        }
      );
      console.log("Bâtiment enregistré :", coords);
    } catch (error) {
      console.error("Erreur enregistrement bâtiment :", error);
    }
  };

  return (
    <MapContainer center={center} zoom={18} style={{ height: "100vh", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {buildings.map((coords, i) => (
        <Polygon key={i} positions={coords} pathOptions={{ color: "#00cc66" }} />
      ))}
    </MapContainer>
  );
}
