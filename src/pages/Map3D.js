// src/pages/Map.js
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Suivi from './IA/Suivi';
import { saveUserLocation, getCurrentUser } from './IA/Appwrite';
import MapCustomizer from './IA/MapCustomizer';

// Correction de l'icône par défaut de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Composant qui suit la position de l'utilisateur
function LocationMarker() {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locationInfo, setLocationInfo] = useState({});
  const [user, setUser] = useState(null);
  const map = useMap();
  const locationCircleRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    // Récupérer l'utilisateur actuel
    const fetchUser = async () => {
      const userData = await getCurrentUser();
      setUser(userData);
    };
    fetchUser();

    // Configurer le suivi de la position
    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const newPosition = { lat: latitude, lng: longitude };
          
          setPosition(newPosition);
          setAccuracy(accuracy);
          map.flyTo(newPosition, map.getZoom());
          
          // Récupérer les informations de localité
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              const info = {
                neighborhood: data.address?.neighbourhood || data.address?.suburb || 'Inconnu',
                city: data.address?.city || data.address?.town || 'Inconnu',
                country: data.address?.country || 'Inconnu'
              };
              setLocationInfo(info);
              
              // Sauvegarder la position si un utilisateur est connecté
              if (user && user.$id) {
                saveUserLocation(user.$id, newPosition, info);
              }
            })
            .catch(err => console.error("Erreur lors de la récupération des informations de localité:", err));
        },
        (err) => {
          console.error("Erreur de géolocalisation:", err);
          alert(`Erreur de géolocalisation: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      alert("La géolocalisation n'est pas prise en charge par ce navigateur.");
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [map, user]);

  // Mettre à jour le cercle de précision
  useEffect(() => {
    if (position && accuracy) {
      if (locationCircleRef.current) {
        locationCircleRef.current.remove();
      }
      
      locationCircleRef.current = L.circle(position, {
        radius: accuracy,
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.2
      }).addTo(map);
    }
    
    return () => {
      if (locationCircleRef.current) {
        locationCircleRef.current.remove();
      }
    };
  }, [position, accuracy, map]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        <div>
          <h3>Votre position</h3>
          <p>Latitude: {position.lat.toFixed(6)}</p>
          <p>Longitude: {position.lng.toFixed(6)}</p>
          <p>Précision: {accuracy ? `${Math.round(accuracy)} mètres` : 'Inconnue'}</p>
          <p>Quartier: {locationInfo.neighborhood}</p>
          <p>Ville: {locationInfo.city}</p>
          <p>Pays: {locationInfo.country}</p>
        </div>
      </Popup>
    </Marker>
  );
}

function Map() {
  const [mapCenter] = useState({ lat: 48.8566, lng: 2.3522 }); // Paris par défaut
  const [mapZoom] = useState(13);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customMarkers, setCustomMarkers] = useState([]);
  const [customPolygons, setCustomPolygons] = useState([]);

  const addMarker = (marker) => {
    setCustomMarkers(prev => [...prev, marker]);
  };

  const addPolygon = (polygon) => {
    setCustomPolygons(prev => [...prev, polygon]);
  };

  const toggleCustomizer = () => {
    setShowCustomizer(!showCustomizer);
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />

        {/* Afficher les marqueurs personnalisés */}
        {customMarkers.map((marker, index) => (
          <Marker 
            key={`marker-${index}`} 
            position={marker.position}
            icon={marker.icon || new L.Icon.Default()}
          >
            <Popup>
              <div>
                <h3>{marker.name || 'Marqueur personnalisé'}</h3>
                <p>{marker.description || 'Aucune description'}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Afficher les polygones personnalisés */}
        {customPolygons.map((polygon, index) => (
          <L.Polygon 
            key={`polygon-${index}`}
            positions={polygon.positions}
            color={polygon.color || 'blue'}
            fillColor={polygon.fillColor || '#3388ff'}
            fillOpacity={polygon.fillOpacity ||.2}
          >
            <Popup>
              <div>
                <h3>{polygon.name || 'Zone personnalisée'}</h3>
                <p>{polygon.description || 'Aucune description'}</p>
              </div>
            </Popup>
          </L.Polygon>
        ))}

        <Suivi />
      </MapContainer>

      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
        <button 
          onClick={toggleCustomizer}
          style={{
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showCustomizer ? 'Masquer' : 'Personnaliser la carte'}
        </button>
      </div>

      {showCustomizer && (
        <MapCustomizer 
          onAddMarker={addMarker}
          onAddPolygon={addPolygon}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}

export default Map;

