import React, { useState, useRef, useEffect } from 'react';
import './PersonAnalyzer.css';

const PersonAnalyzer = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const apiUrl = 'http://localhost:9000/analyze';

  // Chercher les périphériques de caméra disponibles
  useEffect(() => {
    const getAvailableCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Erreur d'accès aux périphériques :", err);
        setError("Impossible d'accéder aux caméras. Veuillez vérifier les permissions.");
      }
    };

    getAvailableCameras();
  }, []);

  // Démarrer la caméra
  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }

      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      mediaStreamRef.current = stream;
      setIsCapturing(true);
      setError(null);
    } catch (err) {
      console.error("Erreur d'accès à la caméra :", err);
      setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
    }
  };

  // Arrêter la caméra
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  };

  // Capturer une image et l'envoyer pour analyse
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Définir la taille du canvas pour correspondre à la vidéo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dessiner l'image de la vidéo sur le canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convertir le canvas en une image base64
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Envoyer l'image à l'API pour analyse
      setIsLoading(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);
      setIsLoading(false);
    } catch (err) {
      console.error("Erreur lors de l'analyse :", err);
      setError("Échec de l'analyse. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  // Afficher les résultats d'analyse
  const renderAnalysisResults = () => {
    if (!analysisResult) return null;

    const { people_count, people, environment } = analysisResult.analysis;

    return (
      <div className="analysis-results">
        <h3>Résultats de l'analyse</h3>
        
        <div className="result-section">
          <h4>1. Comptage de personnes</h4>
          <p><strong>{people_count}</strong> personne(s) détectée(s)</p>
        </div>

        <div className="result-section">
          <h4>2. Analyse des émotions</h4>
          <ul>
            {people.emotions.map(item => (
              <li key={`emotion-${item.id}`}>
                Personne {item.id + 1}: <strong>{item.emotion}</strong> 
                (confiance: {(item.confidence * 100).toFixed(1)}%)
              </li>
            ))}
          </ul>
        </div>

        <div className="result-section">
          <h4>3. Analyse des postures</h4>
          <ul>
            {people.postures.map(item => (
              <li key={`posture-${item.id}`}>
                Personne {item.id + 1}: <strong>{item.posture}</strong>
                (confiance: {(item.confidence * 100).toFixed(1)}%)
              </li>
            ))}
          </ul>
        </div>

        <div className="result-section">
          <h4>4. Analyse de l'environnement</h4>
          <ul>
            {environment.objects.map(item => (
              <li key={`object-${item.id}`}>
                <strong>{item.class}</strong> 
                (confiance: {(item.confidence * 100).toFixed(1)}%)
                <ul>
                  <li>Position: x={item.position.x}, y={item.position.y}</li>
                  <li>Dimensions: {item.position.width}×{item.position.height}</li>
                  <li>
                    Attributs: {Object.entries(item.attributes).map(([key, value]) => 
                      `${key}=${value}`
                    ).join(', ')}
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="person-analyzer">
      <h2>Analyseur d'Images avec IA</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="camera-controls">
        <div className="camera-selector">
          <label htmlFor="camera-select">Sélectionner une caméra:</label>
          <select 
            id="camera-select" 
            value={selectedCamera} 
            onChange={(e) => setSelectedCamera(e.target.value)}
            disabled={isCapturing}
          >
            {cameraDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Caméra ${cameraDevices.indexOf(device) + 1}`}
              </option>
            ))}
          </select>
        </div>
        
        <div className="camera-buttons">
          {!isCapturing ? (
            <button onClick={startCamera} disabled={cameraDevices.length === 0}>
              Activer la caméra
            </button>
          ) : (
            <button onClick={stopCamera}>
              Désactiver la caméra
            </button>
          )}
          
          <button 
            onClick={captureAndAnalyze} 
            disabled={!isCapturing || isLoading}
            className="analyze-button"
          >
            {isLoading ? 'Analyse en cours...' : 'Capturer et analyser'}
          </button>
        </div>
      </div>
      
      <div className="video-container">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline
          className={isCapturing ? '' : 'hidden'}
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Analyse en cours...</p>
          </div>
        )}
      </div>
      
      {renderAnalysisResults()}
    </div>
  );
};

export default PersonAnalyzer;


