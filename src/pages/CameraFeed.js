import React, { useRef, useEffect } from 'react';
import { analyzeLocation } from './utils';

export default function CameraFeed({ onData }) {
  const videoRef  = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    let intervalId;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // préparer le canvas à la taille vidéo
        canvasRef.current.width  = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;

        // toutes les 1s, capturer et analyser
        intervalId = setInterval(captureAndAnalyze, 1000);
      } catch (err) {
        console.error('Erreur caméra:', err);
      }
    }

    async function captureAndAnalyze() {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const ctx    = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // récupérer la géoloc
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const location = [pos.coords.latitude, pos.coords.longitude];
        try {
          const result = await analyzeLocation(location);
          onData(result);
        } catch (e) {
          console.error('Analyse IA échouée:', e);
        }
      });
    }

    startCamera();
    return () => {
      clearInterval(intervalId);
      // stopper la caméra
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [onData]);

  return (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100vw', height: '100vh',
          objectFit: 'cover',
          zIndex: 1
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
}
