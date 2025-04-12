import React, { useEffect, useState, useRef } from 'react';

const RobotCamera = () => {
  // États
  const [currentCamera, setCurrentCamera] = useState('back'); // 'back' ou 'front'
  const [status, setStatus] = useState({ message: 'Initialisation...', type: 'info' });
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const analyzingRef = useRef(false);
  
  // Configuration
  const API_URL = 'http://localhost:5007';
  
  // Position GPS simulée ou réelle
  const [gpsPosition, setGpsPosition] = useState({
    lastLat: 48.8566,  // Paris par défaut
    lastLng: 2.3522
  });
  
  // Résultats
  const [detectionResults, setDetectionResults] = useState({ objects: [], analysis: {} });
  const [sensorData, setSensorData] = useState({});

  useEffect(() => {
    // Initialiser la caméra au chargement
    initCamera();
    
    // Nettoyer à la fermeture 
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Initialiser la caméra
  const initCamera = async () => {
    try {
      const constraints = {
        video: { 
          facingMode: currentCamera === 'front' ? 'user' : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Attendre que la vidéo soit prête
      await new Promise(resolve => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            resolve();
          };
        }
      });
      
      // Configurer le canvas avec les dimensions de la vidéo
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }
      
      // Démarrer l'analyse en continu
      startContinuousAnalysis();
      
      updateStatus('Caméra active', 'success');
    } catch (err) {
      updateStatus(`Erreur de caméra: ${err.message}`, 'error');
      console.error('Erreur lors de l\'accès à la caméra:', err);
    }
  };

  // Fonction pour basculer entre les caméras avant/arrière
  const switchCamera = async () => {
    // Arrêter la caméra actuelle
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    
    // Basculer la caméra
    const newCamera = currentCamera === 'back' ? 'front' : 'back';
    setCurrentCamera(newCamera);
    
    // Informer le backend du changement
    try {
      await fetch(`${API_URL}/switch/camera`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ camera: newCamera })
      });
    } catch (err) {
      console.warn('Erreur lors du changement de caméra sur le backend:', err);
    }
    
    // Redémarrer la caméra
    await initCamera();
  };

  // Capturer une image depuis la vidéo
  const captureFrame = () => {
    if (!canvasRef.current || !videoRef.current) return null;
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    
    return new Promise(resolve => {
      canvasRef.current.toBlob(blob => {
        resolve(blob);
      }, 'image/jpeg', 0.85);
    });
  };

  // Collecter les données des capteurs
  const collectSensorData = async () => {
    const accelerometer = getAccelerometerData();
    const gyroscope = getGyroscopeData();
    const gps = await getGPSData();
    
    const sensorData = { accelerometer, gyroscope, gps };
    setSensorData(sensorData);
    return sensorData;
  };

  // Récupérer les données de l'accéléromètre
  const getAccelerometerData = () => {
    // Simuler des données ou utiliser des capteurs réels si disponibles
    return {
      x: Math.random() * 2 - 1,  // -1 à 1
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
      timestamp: Date.now()
    };
  };

  // Récupérer les données du gyroscope
  const getGyroscopeData = () => {
    // Simuler des données ou utiliser des capteurs réels si disponibles
    return {
      alpha: Math.random() * 360,  // 0 à 360 degrés
      beta: Math.random() * 180 - 90,  // -90 à 90 degrés
      gamma: Math.random() * 180 - 90,  // -90 à 90 degrés
      timestamp: Date.now()
    };
  };

  // Récupérer les données GPS
  const getGPSData = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newPosition = {
              lastLat: position.coords.latitude,
              lastLng: position.coords.longitude
            };
            setGpsPosition(newPosition);
            
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            });
          },
          (error) => {
            console.warn('Erreur GPS:', error.message);
            // Simuler un petit déplacement pour les tests
            const newLat = gpsPosition.lastLat + (Math.random() - 0.5) * 0.001;
            const newLng = gpsPosition.lastLng + (Math.random() - 0.5) * 0.001;
            
            setGpsPosition({
              lastLat: newLat,
              lastLng: newLng
            });
            
            resolve({
              latitude: newLat,
              longitude: newLng,
              accuracy: 50,
              timestamp: Date.now()
            });
          },
          { maximumAge: 5000, timeout: 3000 }
        );
      } else {
        // Simuler des données GPS si non disponible
        const newLat = gpsPosition.lastLat + (Math.random() - 0.5) * 0.001;
        const newLng = gpsPosition.lastLng + (Math.random() - 0.5) * 0.001;
        
        setGpsPosition({
          lastLat: newLat,
          lastLng: newLng
        });
        
        resolve({
          latitude: newLat,
          longitude: newLng,
          accuracy: 100,
          timestamp: Date.now()
        });
      }
    });
  };

  // Analyser une image capturée
  const analyzeFrame = async () => {
    if (analyzingRef.current) return; // Éviter les analyses simultanées
    analyzingRef.current = true;
    
    try {
      updateStatus('Analyse en cours...', 'processing');
      
      // Capturer l'image
      const imageBlob = await captureFrame();
      if (!imageBlob) {
        throw new Error('Impossible de capturer l\'image');
      }
      
      // Collecter les données des capteurs
      const sensors = await collectSensorData();
      
      // Préparer les données pour l'envoi
      const formData = new FormData();
      formData.append('image', imageBlob, 'capture.jpg');
      formData.append('camera', currentCamera);
      
      // Ajouter les données des capteurs
      for (const [sensorType, data] of Object.entries(sensors)) {
        formData.append(sensorType, JSON.stringify(data));
      }
      
      // Envoyer au serveur pour analyse
      const response = await fetch(`${API_URL}/process/image`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Afficher les résultats
      setDetectionResults(result);
      drawDetectionBoxes(result.objects);
      updateStatus('Analyse terminée', 'success');
      
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      updateStatus(`Erreur: ${error.message}`, 'error');
    } finally {
      analyzingRef.current = false;
    }
  };

  // Démarrer l'analyse en continu (toutes les 500ms)
  const startContinuousAnalysis = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    
    // Analyser à un intervalle régulier
    streamIntervalRef.current = setInterval(analyzeFrame, 500);
  };

  // Dessiner les cadres de détection sur l'image
  const drawDetectionBoxes = (objects) => {
    if (!objects || !Array.isArray(objects) || !canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    // Effacer le canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    // Redessiner l'image de la vidéo
    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Dessiner les cadres pour chaque objet détecté
    objects.forEach(obj => {
      if (obj.box) {
        const { xmin, ymin, xmax, ymax } = obj.box;
        
        // Dessiner le rectangle
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
        
        // Afficher le label
        ctx.fillStyle = '#00FF00';
        ctx.font = '16px Arial';
        ctx.fillText(`${obj.label} ${(obj.confidence * 100).toFixed(0)}%`, xmin, ymin - 5);
      }
    });
  };

  // Mettre à jour l'indicateur de statut
  const updateStatus = (message, type = 'info') => {
    setStatus({ message, type });
  };

  return (
    <div className="robot-camera-container">
      <div className="camera-section">
        <div className="video-container">
          <video 
            ref={videoRef} 
            id="camera-feed" 
            autoPlay 
            playsInline
            muted
          />
          <canvas 
            ref={canvasRef} 
            id="capture-canvas" 
          />
        </div>
        
        <div className={`status-indicator ${status.type}`} id="status-indicator">
          {status.message}
        </div>
        
        <button 
          className="switch-camera-btn" 
          id="switch-camera"
          onClick={switchCamera}
        >
          Changer de caméra
        </button>
      </div>
      
      <div className="results-section">
        <div className="detection-results" id="detection-results">
          <h3>Objets détectés:</h3>
          {detectionResults.objects && detectionResults.objects.length > 0 ? (
            <ul>
              {detectionResults.objects.map((obj, index) => (
                <li key={index}>
                  {obj.label} (confiance: {(obj.confidence * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun objet détecté</p>
          )}
          
          <h3>Analyse:</h3>
          <p>Intention: {detectionResults.intention || 'Inconnue'}</p>
          <p>Trajectoire: {detectionResults.trajectory || 'Inconnue'}</p>
          {detectionResults.height && (
            <p>Hauteur estimée: {detectionResults.height} cm</p>
          )}
          {detectionResults.speed !== undefined && (
            <p>Vitesse: {detectionResults.speed.toFixed(1)} km/h</p>
          )}
        </div>
        
        <div className="sensor-data" id="sensor-data">
          <h3>Capteurs:</h3>
          {detectionResults.sensor_data && (
            <ul>
              {detectionResults.sensor_data.gps && (
                <li>
                  GPS: {detectionResults.sensor_data.gps.latitude.toFixed(6)}, 
                  {detectionResults.sensor_data.gps.longitude.toFixed(6)}
                </li>
              )}
              
              {detectionResults.sensor_data.accelerometer && (
                <li>
                  Accéléromètre: X={detectionResults.sensor_data.accelerometer.x.toFixed(2)}, 
                  Y={detectionResults.sensor_data.accelerometer.y.toFixed(2)}, 
                  Z={detectionResults.sensor_data.accelerometer.z.toFixed(2)}
                </li>
              )}
              
              {detectionResults.sensor_data.gyroscope && (
                <li>
                  Gyroscope: α={detectionResults.sensor_data.gyroscope.alpha.toFixed(1)}°, 
                  β={detectionResults.sensor_data.gyroscope.beta.toFixed(1)}°, 
                  γ={detectionResults.sensor_data.gyroscope.gamma.toFixed(1)}°
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .robot-camera-container {
          display: flex;
          flex-direction: column;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Arial', sans-serif;
        }
        
        .camera-section {
          margin-bottom: 20px;
        }
        
        .video-container {
          position: relative;
          width: 100%;
          height: 0;
          padding-bottom: 75%; /* 4:3 aspect ratio */
          border: 2px solid #444;
          border-radius: 8px;
          overflow: hidden;
          background-color: #000;
        }
        
        #camera-feed, #capture-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        #capture-canvas {
          z-index: 10;
          pointer-events: none;
        }
        
        .status-indicator {
          padding: 10px;
          margin: 10px 0;
          border-radius: 5px;
          font-weight: bold;
          text-align: center;
        }
        
        .info {
          background-color: #e0f7fa;
          color: #006064;
        }
        
        .success {
          background-color: #e8f5e9;
          color: #1b5e20;
        }
        
        .error {
          background-color: #ffebee;
          color: #b71c1c;
        }
        
        .processing {
          background-color: #fffde7;
          color: #f57f17;
        }
        
        .switch-camera-btn {
          width: 100%;
          padding: 12px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .switch-camera-btn:hover {
          background-color: #0d8aee;
        }
        
        .results-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        @media (min-width: 768px) {
          .results-section {
            flex-direction: row;
          }
          
          .detection-results, .sensor-data {
            width: 50%;
          }
        }
        
        .detection-results, .sensor-data {
          padding: 15px;
          border-radius: 8px;
          background-color: #f5f5f5;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        h3 {
          margin-top: 0;
          color: #333;
          border-bottom: 1px solid #ddd;
          padding-bottom: 8px;
        }
        
        ul {
          padding-left: 20px;
        }
        
        li {
          margin-bottom: 5px;
        }
      `}</style>
    </div>
  );
};

export default RobotCamera;

