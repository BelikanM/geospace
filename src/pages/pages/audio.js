

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  getCurrentUser,
  saveUserLocation,
  getUserLocations,
  ID
} from './appwrite';

// Correction pour les icônes Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
});

// Configuration des couleurs pour différents types de bruit
const sourceColors = {
  'Personne': '#FF5733', // Orange-rouge
  'Objet': '#33A8FF',    // Bleu
  'Animal': '#33FF57',   // Vert
  'Vent': '#D6FF33',     // Jaune-vert
  'Autre': '#A133FF'     // Violet
};

const RecenterAutomatically = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
};

const Audio = () => {
  const [locations, setLocations] = useState([]);
  const [userLocations, setUserLocations] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  // Récupérer la position de l'utilisateur et ses données au chargement
  useEffect(() => {
    // Obtenir la géolocalisation de l'utilisateur
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserPosition([latitude, longitude]);
      },
      (err) => {
        console.error("Erreur de géolocalisation:", err);
        setError("Impossible d'obtenir votre position. Veuillez activer la géolocalisation.");
        // Position par défaut (Paris)
        setUserPosition([48.8566, 2.3522]); 
      }
    );

    // Charger l'utilisateur actuel
    const loadUserData = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
          // Charger les emplacements enregistrés de l'utilisateur
          const userLocationsData = await getUserLocations(userData.$id);
          if (userLocationsData && userLocationsData.documents) {
            setUserLocations(userLocationsData.documents.map(doc => ({
              id: doc.$id,
              position: [doc.latitude, doc.longitude],
              neighborhood: doc.neighborhood || 'Inconnu',
              timestamp: new Date(doc.timestamp),
              weather: doc.weather || {},
              sourceType: doc.sourceType,
              confidence: doc.confidence,
              distance: doc.distance
            })));
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données utilisateur:", error);
      }
    };

    loadUserData();

    // Nettoyer le flux audio lorsqu'on quitte le composant
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
        setRecording(audioFile);
        analyzeAudio(audioFile);
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erreur lors du démarrage de l'enregistrement:", err);
      setError("Impossible d'accéder au microphone. Vérifiez vos permissions.");
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    }
  };

  const analyzeAudio = async (audioFile) => {
    if (!userPosition) {
      setError("Position utilisateur non disponible. Veuillez activer la géolocalisation.");
      return;
    }

    setIsLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', audioFile);

    try {
      const response = await axios.post('http://localhost:4500/api/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
      });

      const { detected_noises } = response.data;
      
      if (!detected_noises || detected_noises.length === 0) {
        setError("Aucun bruit détecté dans l'enregistrement audio.");
        setIsLoading(false);
        return;
      }

      // Convertir les détections en emplacements sur la carte
      const newLocations = detected_noises.map((noise, index) => {
        // Calculer la position basée sur l'angle et la distance
        const angle = noise.angle * (Math.PI / 180); // Convertir en radians
        const distance = noise.distance / 111000; // Conversion approximative en degrés (1 degré ~ 111km)
        
        // Calculer le nouvel emplacement basé sur l'angle et la distance
        const lat = userPosition[0] + distance * Math.cos(angle);
        const lng = userPosition[1] + distance * Math.sin(angle);
        
        // Créer l'objet location
        return {
          id: ID.unique(),
          position: [lat, lng],
          sourceType: noise.source_type,
          confidence: noise.confidence,
          distance: noise.distance
        };
      });

      setLocations(newLocations);

      // Enregistrer les emplacements dans Appwrite si l'utilisateur est connecté
      if (user) {
        for (const location of newLocations) {
          try {
            await saveUserLocation(
              user.$id,
              { lat: location.position[0], lng: location.position[1] },
              { 
                neighborhood: 'Détecté par analyse audio',
                weather: {},
                sourceType: location.sourceType,
                confidence: location.confidence,
                distance: location.distance
              }
            );
          } catch (error) {
            console.error("Erreur lors de l'enregistrement de l'emplacement:", error);
          }
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'analyse audio:", error);
      setError("Erreur lors de l'analyse audio. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      analyzeAudio(file);
    }
  };

  // Enregistrement manuel de la position actuelle
  const handleSaveCurrentPosition = async () => {
    if (!userPosition || !user) return;
    
    try {
      await saveUserLocation(
        user.$id,
        { lat: userPosition[0], lng: userPosition[1] },
        { neighborhood: 'Position manuelle', weather: {} }
      );
      
      // Recharger les positions après l'enregistrement
      const userLocationsData = await getUserLocations(user.$id);
      if (userLocationsData && userLocationsData.documents) {
        setUserLocations(userLocationsData.documents.map(doc => ({
          id: doc.$id,
          position: [doc.latitude, doc.longitude],
          neighborhood: doc.neighborhood || 'Inconnu',
          timestamp: new Date(doc.timestamp),
          weather: doc.weather || {},
          sourceType: doc.sourceType,
          confidence: doc.confidence,
          distance: doc.distance
        })));
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la position:", error);
      setError("Erreur lors de l'enregistrement de votre position.");
    }
  };

  return (
    <div className="audio-container">
      <h1>Analyseur de Son</h1>
      
      <div className="controls">
        <div className="record-controls">
          {!isRecording ? (
            <button 
              className="record-btn" 
              onClick={startRecording}
              disabled={isLoading}
            >
              <span className="record-icon"></span>
              Enregistrer un son
            </button>
          ) : (
            <button 
              className="stop-btn" 
              onClick={stopRecording}
            >
              <span className="stop-icon"></span>
              Arrêter l'enregistrement
            </button>
          )}
        </div>
        
        <div className="file-upload">
          <label htmlFor="audio-file" className="upload-btn">
            {isLoading ? 'Analyse en cours...' : 'Télécharger un fichier audio'}
          </label>
          <input 
            id="audio-file" 
            type="file" 
            accept="audio/*" 
            onChange={handleFileChange} 
            disabled={isLoading || isRecording}
            style={{ display: 'none' }}
          />
        </div>
        
        {user && (
          <button 
            className="save-position-btn" 
            onClick={handleSaveCurrentPosition}
            disabled={!userPosition}
          >
            Enregistrer ma position actuelle
          </button>
        )}
        
        {!user && (
          <p className="login-reminder">Connectez-vous pour enregistrer vos positions.</p>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="map-container">
        {userPosition && (
          <MapContainer 
            center={userPosition} 
            zoom={15} 
            style={{ height: '600px', width: '100%', borderRadius: '8px' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            />
            
            {/* Position de l'utilisateur */}
            <Marker position={userPosition}>
              <Popup>
                Votre position actuelle
              </Popup>
            </Marker>
            
            {/* Positions des bruits détectés */}
            {locations.map((loc) => (
              <CircleMarker 
                key={loc.id} 
                center={loc.position} 
                pathOptions={{ 
                  fillColor: sourceColors[loc.sourceType] || '#777',
                  color: sourceColors[loc.sourceType] || '#777',
                  fillOpacity: 0.6,
                  radius: 10 + (loc.confidence * 10) // Taille basée sur la confiance
                }}
              >
                <Popup>
                  <div>
                    <h3>{loc.sourceType}</h3>
                    <p>Confiance: {Math.round(loc.confidence * 100)}%</p>
                    <p>Distance estimée: {Math.round(loc.distance)}m</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            
            {/* Positions historiques de l'utilisateur */}
            {userLocations.map((loc) => (
              <CircleMarker
                key={loc.id}
                center={loc.position}
                pathOptions={{
                  fillColor: loc.sourceType ? sourceColors[loc.sourceType] : '#00A0FF',
                  color: loc.sourceType ? sourceColors[loc.sourceType] : '#0080FF',
                  fillOpacity: 0.4,
                  radius: loc.sourceType ? (5 + (loc.confidence * 5)) : 5
                }}
              >
                <Popup>
                  <div>
                    <h3>{loc.neighborhood}</h3>
                    <p>Enregistré le: {loc.timestamp.toLocaleString()}</p>
                    {loc.sourceType && (
                      <>
                        <p>Type de source: {loc.sourceType}</p>
                        <p>Confiance: {Math.round((loc.confidence || 0) * 100)}%</p>
                        <p>Distance: {Math.round(loc.distance || 0)}m</p>
                      </>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            
            <RecenterAutomatically position={userPosition} />
          </MapContainer>
        )}
      </div>
      
      <div className="legend">
        <h3>Légende</h3>
        <div className="legend-items">
          {Object.entries(sourceColors).map(([source, color]) => (
            <div key={source} className="legend-item">
              <span className="color-dot" style={{ backgroundColor: color }}></span>
              <span>{source}</span>
            </div>
          ))}
          <div className="legend-item">
            <span className="color-dot" style={{ backgroundColor: '#00A0FF' }}></span>
            <span>Positions sauvegardées</span>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .audio-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 30px;
        }
        .controls {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .upload-btn, .save-position-btn, .record-btn, .stop-btn {
          background-color: #4285F4;
          color: white;
          padding: 12px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .upload-btn:hover, .save-position-btn:hover, .record-btn:hover {
          background-color: #3367D6;
        }
        .upload-btn:disabled, .save-position-btn:disabled, .record-btn:disabled {
          background-color: #a5a5a5;
          cursor: not-allowed;
        }
        .stop-btn {
          background-color: #f44336;
        }
        .stop-btn:hover {
          background-color: #d32f2f;
        }
        .record-icon, .stop-icon {
          display: inline-block;
          width: 12px;
          height: 12px;
          margin-right: 8px;
        }
        .record-icon {
          background-color: red;
          border-radius: 50%;
        }
        .stop-icon {
          background-color: white;
        }
        .error-message {
          color: #D32F2F;
          padding: 10px;
          margin-bottom: 20px;
          background-color: #FFEBEE;
          border-radius: 4px;
          text-align: center;
        }
        .map-container {
          margin-bottom: 30px;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .legend {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .legend h3 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #333;
        }
        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        .legend-item {
          display: flex;
          align-items: center;
        }
        .color-dot {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          margin-right: 7px;
        }
        .login-reminder {
          color: #666;
          font-style: italic;
        }
        .record-controls {
          display: flex;
          gap: 10px;
        }
        
        @media (max-width: 768px) {
          .controls {
            flex-direction: column;
            align-items: stretch;
          }
          .upload-btn, .save-position-btn, .record-btn, .stop-btn {
            margin-bottom: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default Audio;


