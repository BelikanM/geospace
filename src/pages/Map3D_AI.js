// pages/Map3D_AI.js
import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { databases, DATABASE_ID, COLLECTION_ID } from '../appwrite';

function Building3D_AI({ coords }) {
  const [height, setHeight] = useState(5);

  useEffect(() => {
    // Appel à l'API Flask pour obtenir la hauteur prédite
    fetch('http://10.72.46.239:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coords })
    })
      .then(res => res.json())
      .then(data => {
        if (data.height) setHeight(data.height);
      })
      .catch(error => console.error("Erreur appel API Flask:", error));
  }, [coords]);

  // Calcul du centre du polygone
  let avgLat = 0, avgLon = 0;
  coords.forEach(([lat, lon]) => {
    avgLat += lat;
    avgLon += lon;
  });
  avgLat /= coords.length;
  avgLon /= coords.length;

  return (
    <mesh position={[avgLon, height / 2, -avgLat]}>
      <boxBufferGeometry attach="geometry" args={[0.0005, height * 0.0001, 0.0005]} />
      <meshStandardMaterial attach="material" color="#00cc66" />
    </mesh>
  );
}

export default function Map3D_AI() {
  const [buildings, setBuildings] = useState([]);

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID);
        const shapes = response.documents.map(doc => JSON.parse(doc.coords));
        setBuildings(shapes);
      } catch (error) {
        console.error("Erreur récupération bâtiments:", error);
      }
    }
    fetchBuildings();
  }, []);

  return (
    <Canvas camera={{ position: [0, 0.001, 0] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls />
      {buildings.map((coords, i) => (
        <Building3D_AI key={i} coords={coords} />
      ))}
    </Canvas>
  );
}
