import React, { useState, useRef, useEffect } from 'react';

// Style CSS intégré dans le même fichier
const styles = `
.person-analyzer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Arial', sans-serif;
  color: #333;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.person-analyzer h2 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e1e4e8;
}

.error-message {
  background-color: #ffe0e0;
  border-left: 4px solid #e74c3c;
  color: #c0392b;
  padding: 12px 15px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.camera-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f0f2f5;
  border-radius: 6px;
}

.camera-selector {
  margin-right: 15px;
  flex: 1;
}

.camera-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #2c3e50;
}

.camera-selector select {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: white;
  font-size: 14px;
  box-sizing: border-box;
}

.camera-buttons {
  display: flex;
  gap: 10px;
  flex: 1;
}

.camera-buttons button {
  padding: 12px 18px;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #3498db;
  color: white;
}

.camera-buttons button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.camera-buttons button:hover:not(:disabled) {
  background-color: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.camera-buttons .analyze-button {
  background-color: #2ecc71;
}

.camera-buttons .analyze-button:hover:not(:disabled) {
  background-color: #27ae60;
}

.video-container {
  position: relative;
  margin-bottom: 30px;
  border-radius: 8px;
  overflow: hidden;
  background-color: #000;
  width: 100%;
  aspect-ratio: 16/9;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-container .hidden,
canvas.hidden {
  display: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  z-index: 10;
}

.loading-spinner {
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-top: 5px solid #ffffff;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.analysis-results {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.analysis-results h3 {
  color: #2c3e50;
  margin-top: 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #3498db;
}

.result-section {
  margin-bottom: 25px;
}

.result-section h4 {
  color: #2980b9;
  margin-bottom: 10px;
  font-size: 18px;
}

.result-section ul {
  margin: 0;
  padding-left: 20px;
}

.result-section li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.result-section strong {
  color: #16a085;
}

@media (max-width: 768px) {
  .camera-controls {
    flex-direction: column;
    gap: 15px;
  }
  
  .camera-selector, 
  .camera-buttons {
    width: 100%;
  }
  
  .camera-buttons {
    flex-direction: column;
  }
}
`;

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
    <>
      {/* Injecter les styles CSS */}
      <style>{styles}</style>
      
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
    </>
  );
};

export default PersonAnalyzer;

