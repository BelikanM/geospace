import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './Vid.css';

const Vid = () => {
  const [detections, setDetections] = useState([]);
  const [processedImage, setProcessedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Configuration de l'API
  const API_URL = 'http://localhost:5009/api/detect';
  
  useEffect(() => {
    // Demander l'accès à la webcam au chargement du composant
    const getMediaStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError('Erreur d\'accès à la caméra: ' + err.message);
      }
    };
    
    getMediaStream();
    
    // Nettoyer le stream quand le composant est démonté
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Fonction pour capturer une image de la vidéo
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Définir les dimensions du canvas pour correspondre à la vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dessiner le frame de la vidéo sur le canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Retourner l'image en base64
    return canvas.toDataURL('image/jpeg');
  };
  
  // Fonction pour envoyer l'image à l'API et obtenir les détections
  const processImage = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const imageBase64 = captureImage();
      if (!imageBase64) {
        throw new Error('Impossible de capturer l\'image');
      }
      
      // Envoyer l'image à l'API
      const response = await axios.post(API_URL, {
        image: imageBase64
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      // Traiter la réponse
      if (response.data.status === 'success') {
        setDetections(response.data.detections);
        setProcessedImage(response.data.processedImage);
      } else {
        throw new Error('Erreur lors du traitement de l\'image');
      }
    } catch (err) {
      setError('Erreur: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Fonction pour activer la détection continue
  const startContinuousDetection = () => {
    const intervalId = setInterval(async () => {
      if (!isProcessing) {
        await processImage();
      }
    }, 1000); // Intervalle d'une seconde
    
    return () => clearInterval(intervalId);
  };
  
  return (
    <div className="vid-container">
      <h2>Détection d'objets en temps réel</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="video-section">
        {/* Vidéo de la caméra (caché ou visible selon votre préférence) */}
        <video 
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ display: processedImage ? 'none' : 'block' }}
        />
        
        {/* Canvas pour capturer les images (invisible) */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Image traitée avec les détections */}
        {processedImage && (
          <img 
            src={processedImage} 
            alt="Détections" 
            className="processed-image"
          />
        )}
      </div>
      
      <div className="controls">
        <button 
          onClick={processImage}
          disabled={isProcessing || !stream}
        >
          {isProcessing ? 'Traitement...' : 'Détecter des objets'}
        </button>
        
        <button 
          onClick={startContinuousDetection}
          disabled={isProcessing || !stream}
        >
          Détection continue
        </button>
      </div>
      
      {detections.length > 0 && (
        <div className="detections-list">
          <h3>Objets détectés ({detections.length})</h3>
          <ul>
            {detections.map((det, index) => (
              <li key={index}>
                {det.label} - Confiance: {(det.confidence * 100).toFixed(2)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Vid;

