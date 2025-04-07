import React, { useState } from 'react';
import CameraFeed      from './CameraFeed';
import RealTime3DScene from './RealTime3DScene';
import UrbanAnalysis   from './UrbanAnalysis';
import OverlayHUD      from './OverlayHUD';

export default function Map3D() {
  const [analysisData, setAnalysisData] = useState(null);

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh' }}>
      <CameraFeed onData={setAnalysisData} />
      <RealTime3DScene data={analysisData} />
      <UrbanAnalysis data={analysisData} />
      <OverlayHUD data={analysisData} />
    </div>
  );
}
