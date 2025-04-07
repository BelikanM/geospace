// src/pages/RealTime3DScene.js
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { latLonToMeters } from './utils';

export default function RealTime3DScene({ data }) {
  return (
    <Canvas
      style={{ position:'absolute', top:0, left:0, zIndex:2 }}
      camera={{ position: [0, 50, 100], fov: 60 }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} />
      <GroundPlane />
      {data?.density_heatmap?.map((pt, i) => (
        <HeatPoint key={i} point={pt} center={data.location} />
      ))}
      <OrbitControls />
      <Stats />
    </Canvas>
  );
}

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
      {/* <planeBufferGeometry args={[500, 500]} /> → remplacer par : */}
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#444" />
    </mesh>
  );
}

function HeatPoint({ point, center }) {
  const [lat, lon, val] = point;
  const [x, z] = latLonToMeters(center[0], center[1], lat, lon);
  const height = val * 5;
  return (
    <mesh position={[x, height/2, z]} castShadow>
      {/* <boxBufferGeometry args={[5, height, 5]} /> → remplacer par : */}
      <boxGeometry args={[5, height, 5]} />
      <meshStandardMaterial
        color={`rgb(${val*25}, ${255 - val*25}, 0)`}
      />
    </mesh>
  );
}
