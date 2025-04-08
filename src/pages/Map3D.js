// src/pages/Map3D.js
import React, { useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const Map3D = () => {
  const webcamRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(captureAndSend, 3000); // capture toutes les 3 sec
    return () => clearInterval(interval);
  }, []);

  const captureAndSend = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      try {
        const response = await axios.post('http://localhost:5005/analyze', {
          image: imageSrc,
        });
        console.log('Analyse IA:', response.data.description);
      } catch (err) {
        console.error('Erreur envoi image :', err.message);
      }
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Map3D - Vision RPG Réalité Augmentée</h1>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "environment" }}
        className="rounded-xl shadow-md w-full max-w-md"
      />
    </div>
  );
};

export default Map3D;
