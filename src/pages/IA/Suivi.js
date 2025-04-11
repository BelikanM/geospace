// src/pages/IA/Suivi.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5006';

function Suivi() {
  const map = useMap();
  const [gpsData, setGpsData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const heatmapLayerRef = useRef(null);

  // Collecter les données GPS
  useEffect(() => {
    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setGpsData(prevData => [...prevData, [latitude, longitude]]);
        },
        (err) => console.error("Erreur de géolocalisation:", err),
        { enableHighAccuracy: true }
      );
    }, 60000); // Collecter la position toutes les minutes

    return () => clearInterval(interval);
  }, []);

  // Envoyer les données au serveur pour analyse lorsqu'on a accumulé 10 points
  useEffect(() => {
    if (gpsData.length >= 10 && !isLoading) {
      analyzeData();
    }
  }, [gpsData]);

  // Analyser les données
  const analyzeData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/train`, {
        gps_data: gpsData
      });
      
      if (response.data) {
        console.log("Modèle entraîné avec succès:", response.data);
        // Obtenir des prédictions ou des clusters
        await getPredictions();
      }
    } catch (err) {
      console.error("Erreur lors de l'entraînement du modèle:", err);
      setError("Impossible d'analyser les données. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  // Obtenir des prédictions
  const getPredictions = async () => {
    try {
      // Ici, on pourrait appeler une autre API pour obtenir des prédictions
      // Pour l'exemple, nous générons des points d'intérêt fictifs
      const centerLat = gpsData[gpsData.length - 1][0];
      const centerLng = gpsData[gpsData.length - 1][1];
      
      const fakePredictions = [
        {
          name: "Lieu intéressant 1",
          location: [centerLat + 0.005, centerLng + 0.005],
          interest: 0.8,
          description: "Lieu très fréquenté"
        },
        {
          name: "Lieu intéressant 2",
          location: [centerLat - 0.003, centerLng + 0.002],
          interest: 0.6,
          description: "Activité culturelle"
        },
        {
          name: "Zone à éviter",
          location: [centerLat + 0.002, centerLng - 0.004],
          interest: 0.2,
          description: "Zone peu fréquentée"
        }
      ];
      
      setPredictions(fakePredictions);
      visualizePredictions(fakePredictions);
    } catch (err) {
      console.error("Erreur lors de l'obtention des prédictions:", err);
      setError("Impossible d'obtenir des prédictions.");
    }
  };

  // Visualiser les prédictions sur la carte
  const visualizePredictions = (preds) => {
    // Supprimer l'ancienne carte de chaleur si elle existe
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
    }

    // Créer les points pour la carte de chaleur
    const heatPoints = gpsData.map(point => [point[0], point[1], 0.5]);
    
    // Ajouter les prédictions à la carte de chaleur
    preds.forEach(pred => {
      // L'intensité dépend de l'intérêt
      heatPoints.push([...pred.location, pred.interest]);
      
      // Ajouter un marqueur pour chaque prédiction
      const icon = new L.DivIcon({
        html: `<div style="
          background-color: ${pred.interest > 0.7 ? 'green' : pred.interest > 0.4 ? 'orange' : 'red'};
          width: 24px;
          height: 24px;
          border-radius: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          font-weight: bold;
        ">${Math.floor(pred.interest * 10)}</div>`,
        className: 'prediction-marker',
        iconSize: [24, 24]
      });
      
      L.marker(pred.location, { icon })
        .bindPopup(`
          <strong>${pred.name}</strong><br>
          Intérêt: ${(pred.interest * 100).toFixed(0)}%<br>
          ${pred.description}
        `)
        .addTo(map);
    });

    // Créer et afficher la carte de chaleur
    if (window.L && window.L.heatLayer) {
      heatmapLayerRef.current = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.4: 'blue', 0.65: 'lime', 0.85: 'yellow', 1.0: 'red' }
      }).addTo(map);
    }
  };

  // Fonction pour téléverser un PDF pour analyse
  const uploadPdf = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/upload-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.zones_to_avoid) {
        console.log("Zones à éviter:", response.data.zones_to_avoid);
        // Marquer les zones sur la carte
        response.data.zones_to_avoid.forEach((zone, index) => {
          // Pour l'exemple, nous positionnons les zones aléatoirement autour de la position actuelle
          const centerLat = gpsData.length > 0 ? gpsData[gpsData.length - 1][0] : map.getCenter().lat;
          const centerLng = gpsData.length > 0 ? gpsData[gpsData.length - 1][1] : map.getCenter().lng;
          
          const randomOffset = () => (Math.random() - 0.5) * 0.01;
          const position = [centerLat + randomOffset(), centerLng + randomOffset()];
          
          L.circle(position, {
            radius: 200,
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.3
          }).bindPopup(`Zone à éviter: ${zone}`).addTo(map);
        });
      }
    } catch (err) {
      console.error("Erreur lors du téléversement du PDF:", err);
      setError("Impossible d'analyser le PDF. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  // Composant visible
  return (
    <div style={{ 
      position: 'absolute', 
      bottom: '20px', 
      left: '20px', 
      zIndex: 1000, 
      backgroundColor: 'white', 
      padding: '10px', 
      borderRadius: '5px', 
      boxShadow: '0 2px 5px rgba(0,0,0,0.3)' 
    }}>
      <h3>Analyse de Données</h3>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div>
        Points GPS collectés: {gpsData.length}
        {isLoading && <span> (Chargement...)</span>}
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              uploadPdf(e.target.files[0]);
            }
          }}
        />
        <small>Téléverser un PDF pour analyse de zones</small>
      </div>
      
      {predictions.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <h4>Prédictions ({predictions.length})</h4>
          <ul style={{ maxHeight: '150px', overflowY: 'auto', padding: '0 0 0 20px', margin: '5px 0' }}>
            {predictions.map((pred, idx) => (
              <li key={idx}>
                {pred.name} ({(pred.interest * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Suivi;

