import React, { useState, useRef, useEffect } from 'react';
import './Robot.css';

const Robot = () => {
  // États pour la caméra et l'analyse
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  
  // États pour les données des capteurs
  const [gpsData, setGpsData] = useState({ latitude: null, longitude: null });
  const [accelerometerData, setAccelerometerData] = useState({ x: 0, y: 0, z: 0 });
  const [gyroscopeData, setGyroscopeData] = useState({ alpha: 0, beta: 0, gamma: 0 });
  
  // État pour les résultats de l'analyse IA
  const [aiAnalysis, setAiAnalysis] = useState({
    objects: [],
    intention: null,
    trajectory: null,
    height: null
  });
  
  // Références
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Démarrer le flux vidéo
  const startStream = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setIsStreaming(true);
      setError(null);
      
      // Commencer à collecter les données des capteurs
      startSensorCollection();
    } catch (err) {
      setError(`Erreur d'accès à la caméra: ${err.message}`);
      console.error('Erreur d\'accès à la caméra:', err);
    }
  };
  
  // Arrêter le flux vidéo
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
      
      // Arrêter la collecte des données des capteurs
      stopSensorCollection();
    }
  };
  
  // Collecter les données des capteurs
  const startSensorCollection = () => {
    // GPS
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          setGpsData({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (err) => console.error('Erreur GPS:', err),
        { enableHighAccuracy: true }
      );
    }
    
    // Accéléromètre
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleAccelerometer);
    }
    
    // Gyroscope
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleGyroscope);
    }
  };
  
  // Arrêter la collecte des données des capteurs
  const stopSensorCollection = () => {
    if (window.DeviceMotionEvent) {
      window.removeEventListener('devicemotion', handleAccelerometer);
    }
    
    if (window.DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', handleGyroscope);
    }
  };
  
  // Gestionnaires d'événements pour les capteurs
  const handleAccelerometer = (event) => {
    setAccelerometerData({
      x: event.accelerationIncludingGravity?.x?.toFixed(2) || 0,
      y: event.accelerationIncludingGravity?.y?.toFixed(2) || 0,
      z: event.accelerationIncludingGravity?.z?.toFixed(2) || 0
    });
  };
  
  const handleGyroscope = (event) => {
    setGyroscopeData({
      alpha: event.alpha?.toFixed(2) || 0, // Z-axis rotation [0, 360)
      beta: event.beta?.toFixed(2) || 0,   // X-axis rotation [-180, 180)
      gamma: event.gamma?.toFixed(2) || 0  // Y-axis rotation [-90, 90)
    });
  };
  
  // Capturer et analyser une image
  const captureAndAnalyze = async () => {
    if (!isStreaming || isAnalyzing) return;
    
    setIsAnalyzing(true);
    
    try {
      // Capturer l'image depuis la vidéo
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convertir l'image en blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      });
      
      // Préparer les données à envoyer
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
      
      // Ajouter les données des capteurs
      formData.append('gps', JSON.stringify(gpsData));
      formData.append('accelerometer', JSON.stringify(accelerometerData));
      formData.append('gyroscope', JSON.stringify(gyroscopeData));
      
      // Envoyer au serveur pour analyse
      const response = await fetch('http://localhost:5007/process/image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Analyse IA:", data);
      
      // Mettre à jour l'état avec les résultats de l'analyse
      setAiAnalysis({
        objects: data.objects || [],
        intention: data.intention || "Non détecté",
        trajectory: data.trajectory || "Non détecté",
        height: data.height || null
      });
      
      setIsAnalyzing(false);
      setError(null);
      
    } catch (err) {
      setError(`Erreur d'analyse: ${err.message}`);
      console.error('Erreur d\'analyse:', err);
      setIsAnalyzing(false);
    }
  };
  
  // Nettoyer les ressources lors du démontage du composant
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      stopSensorCollection();
    };
  }, [stream]);
  
  return (
    <div className="robot-container">
      <h2>Système de Vision Robotique</h2>
      
      <div className="video-container">
        <video 
          ref={videoRef}
          className={`video-feed ${isAnalyzing ? 'analyzing' : ''}`}
          autoPlay
          playsInline
          muted
        />
        {isAnalyzing && (
          <div className="analyzing-overlay">
            Analyse en cours...
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      <div className="control-panel">
        <div className="button-group">
          {!isStreaming ? (
            <button 
              className="control-button primary" 
              onClick={startStream}
              disabled={isAnalyzing}
            >
              Démarrer la caméra
            </button>
          ) : (
            <button 
              className="control-button active" 
              onClick={stopStream}
              disabled={isAnalyzing}
            >
              Arrêter la caméra
            </button>
          )}
          
          <button 
            className="control-button primary" 
            onClick={captureAndAnalyze}
            disabled={!isStreaming || isAnalyzing}
          >
            Analyser la scène
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="sensor-data">
          <div className="data-section">
            <h3>Données des capteurs</h3>
            <div className="sensor-grid">
              <div>
                <h4>GPS</h4>
                <p>Latitude: {gpsData.latitude || 'Non disponible'}</p>
                <p>Longitude: {gpsData.longitude || 'Non disponible'}</p>
              </div>
              
              <div>
                <h4>Accéléromètre</h4>
                <p>X: {accelerometerData.x} m/s²</p>
                <p>Y: {accelerometerData.y} m/s²</p>
                <p>Z: {accelerometerData.z} m/s²</p>
              </div>
              
              <div>
                <h4>Gyroscope</h4>
                <p>Alpha: {gyroscopeData.alpha}°</p>
                <p>Beta: {gyroscopeData.beta}°</p>
                <p>Gamma: {gyroscopeData.gamma}°</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="ai-analysis">
          <h3>Analyse IA</h3>
          
          <div className="analysis-grid">
            <div className="analysis-section">
              <h4>Objets détectés</h4>
              {aiAnalysis.objects.length > 0 ? (
                <ul>
                  {aiAnalysis.objects.map((obj, index) => (
                    <li key={index}>
                      {obj.label} ({(obj.confidence * 100).toFixed(1)}%)
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun objet détecté</p>
              )}
            </div>
            
            <div className="analysis-section">
              <h4>Intention</h4>
              <p>{aiAnalysis.intention || 'Non détectée'}</p>
            </div>
            
            <div className="analysis-section">
              <h4>Trajectoire</h4>
              <p>{aiAnalysis.trajectory || 'Non détectée'}</p>
            </div>
            
            <div className="analysis-section">
              <h4>Hauteur estimée</h4>
              <p>{aiAnalysis.height ? `${aiAnalysis.height} cm` : 'Non détectée'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Robot;

