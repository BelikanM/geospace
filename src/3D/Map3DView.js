// src/3D/Map3D.js
import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export const Map3D = () => {
  const [buildings, setBuildings] = useState([]);

  // Exemple de données de Map2D (tu peux connecter à ton JSON réel)
  const mockData = [
    [
      [5.3621, 10.3861],
      [5.3622, 10.3861],
      [5.3622, 10.3862],
      [5.3621, 10.3862],
    ],
    // Tu peux en ajouter d'autres ici
  ];

  useEffect(() => {
    setBuildings(mockData); // Remplace par ton vrai fetch si besoin
  }, []);

  const latlngToXYZ = (lat, lng) => {
    const scale = 100000;
    return [(lng - 10.386) * scale, 0, (lat - 5.362) * scale];
  };

  return (
    <Canvas camera={{ position: [0, 300, 400], fov: 45 }}>
      <ambientLight />
      <directionalLight position={[100, 100, 50]} intensity={1} />
      <OrbitControls />

      {/* Sol */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#d0f0c0" />
      </mesh>

      {/* Bâtiments */}
      {buildings.map((polygon, idx) => {
        const shape = new THREE.Shape();
        polygon.forEach(([lat, lng], i) => {
          const [x, , z] = latlngToXYZ(lat, lng);
          if (i === 0) shape.moveTo(x, z);
          else shape.lineTo(x, z);
        });

        const extrudeSettings = {
          steps: 1,
          depth: Math.random() * 100 + 20, // Hauteur aléatoire entre 20 et 120
          bevelEnabled: false,
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        return (
          <mesh key={idx} geometry={geometry} position={[0, 0, 0]}>
            <meshStandardMaterial color="#00cc66" />
          </mesh>
        );
      })}
    </Canvas>
  );
};
