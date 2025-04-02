import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MdMyLocation, MdLocationCity, MdOutlinePublic } from 'react-icons/md';
import { FaMapMarkerAlt, FaGoogle } from 'react-icons/fa';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import axios from 'axios';

// Styles pour la page
const GeoSpaceContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const MapWrapper = styled.div`
  flex: 1;
  width: 100%;
  
  .leaflet-container {
    height: 100%;
    width: 100%;
  }
`;

const ControlPanel = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  gap: 10px;
`;

const Button = styled.button`
  padding: 10px 15px;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
  }
`;

const InfoPanel = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  background-color: white;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  max-width: 250px;
`;

const LocationInfo = styled.div`
  margin: 5px 0;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const AuthOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;

const AuthContainer = styled.div`
  background-color: white;
  padding: 30px;
  border-radius: 10px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
`;

const GoogleButton = styled.button`
  background-color: #4285F4;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 5px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 20px auto;
  cursor: pointer;
  &:hover {
    background-color: #3367D6;
  }
`;

const PermissionOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1900;
`;

const PermissionContainer = styled.div`
  background-color: white;
  padding: 30px;
  border-radius: 10px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
`;

// Fonction pour créer une icône personnalisée basée sur un composant React
const createCustomIcon = () => {
  const iconHtml = renderToString(
    <div style={{ 
      background: 'white', 
      borderRadius: '50%', 
      padding: '5px', 
      boxShadow: '0 0 5px rgba(0,0,0,0.3)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <MdMyLocation size={24} color="#0066ff" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-location-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

// Composant pour suivre la position actuelle
function LocationMarker({ onLocationFound }) {
  const [position, setPosition] = useState(null);
  const map = useMap();

  const locationIcon = createCustomIcon();

  useEffect(() => {
    map.locate({ watch: true, setView: false, maxZoom: 16, enableHighAccuracy: true });

    map.on('locationfound', (e) => {
      setPosition(e.latlng);
      if (onLocationFound) {
        onLocationFound(e.latlng);
      }
    });

    return () => {
      map.stopLocate();
      map.off('locationfound');
    };
  }, [map, onLocationFound]);

  return position === null ? null : (
    <Marker position={position} icon={locationIcon}>
      <Popup>Vous êtes ici</Popup>
    </Marker>
  );
}

function GeoSpace() {
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522]); // Paris par défaut
  const [zoom, setZoom] = useState(13);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [locationInfo, setLocationInfo] = useState({
    neighborhood: '',
    city: '',
    country: ''
  });

  // Fonction pour l'authentification Google
  const handleGoogleAuth = () => {
    // Ici, vous devriez implémenter l'authentification Google réelle
    // Pour l'exemple, on simule l'authentification
    console.log("Tentative d'authentification Google");
    setTimeout(() => {
      setIsAuthenticated(true);
      // Après l'authentification, demander la permission de localisation
      setPermissionRequested(true);
    }, 1000);
  };

  // Fonction pour demander l'accès à la géolocalisation
  const requestLocationPermission = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setZoom(16);
          setPermissionRequested(false);
          // Récupérer les informations de localisation
          fetchLocationDetails(latitude, longitude);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Impossible d\'obtenir votre position. Veuillez vérifier les permissions.');
          setPermissionRequested(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
      setPermissionRequested(false);
    }
  };

  // Fonction pour récupérer les détails de localisation (quartier, ville, pays)
  const fetchLocationDetails = async (latitude, longitude) => {
    try {
      // Utilisation de l'API Nominatim OpenStreetMap pour le geocoding inverse
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      
      const address = response.data.address;
      
      setLocationInfo({
        neighborhood: address.suburb || address.neighbourhood || address.residential || 'Non disponible',
        city: address.city || address.town || address.village || 'Non disponible',
        country: address.country || 'Non disponible'
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de localisation:', error);
      setLocationInfo({
        neighborhood: 'Non disponible',
        city: 'Non disponible',
        country: 'Non disponible'
      });
    }
  };

  // Fonction pour centrer sur la position actuelle
  const centerOnLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setZoom(16);
          fetchLocationDetails(latitude, longitude);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Impossible d\'obtenir votre position. Veuillez vérifier les permissions.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
  };

  const handleLocationFound = (latlng) => {
    fetchLocationDetails(latlng.lat, latlng.lng);
  };

  if (!isAuthenticated) {
    return (
      <AuthOverlay>
        <AuthContainer>
          <h2>Bienvenue sur GeoSpace</h2>
          <p>Connectez-vous avec Google pour accéder à la carte et aux fonctionnalités de localisation.</p>
          <GoogleButton onClick={handleGoogleAuth}>
            <FaGoogle size={20} />
            Se connecter avec Google
          </GoogleButton>
        </AuthContainer>
      </AuthOverlay>
    );
  }

  return (
    <GeoSpaceContainer>
      {permissionRequested && (
        <PermissionOverlay>
          <PermissionContainer>
            <h2>Autorisation de localisation</h2>
            <p>Pour profiter pleinement de l'application, nous avons besoin d'accéder à votre position géographique.</p>
            <p>Cela nous permettra de vous localiser sur la carte et de vous fournir des informations sur votre quartier.</p>
            <Button onClick={requestLocationPermission} style={{ margin: '20px auto', padding: '12px 20px' }}>
              <MdMyLocation size={20} style={{ marginRight: '5px' }} />
              Autoriser l'accès à ma position
            </Button>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Vous pouvez modifier cette autorisation à tout moment dans les paramètres de votre navigateur.
            </p>
          </PermissionContainer>
        </PermissionOverlay>
      )}
      
      <MapWrapper>
        <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationFound={handleLocationFound} />
          <MapController center={mapCenter} zoom={zoom} />
        </MapContainer>

        <InfoPanel>
          <h3>Votre localisation</h3>
          <LocationInfo>
            <FaMapMarkerAlt size={16} color="#FF4136" />
            <span>Quartier: {locationInfo.neighborhood}</span>
          </LocationInfo>
          <LocationInfo>
            <MdLocationCity size={16} color="#0074D9" />
            <span>Ville: {locationInfo.city}</span>
          </LocationInfo>
          <LocationInfo>
            <MdOutlinePublic size={16} color="#2ECC40" />
            <span>Pays: {locationInfo.country}</span>
          </LocationInfo>
        </InfoPanel>

        <ControlPanel>
          <Button onClick={centerOnLocation}>
            <MdMyLocation size={20} style={{ marginRight: '5px' }} />
            Ma position
          </Button>
        </ControlPanel>
      </MapWrapper>
    </GeoSpaceContainer>
  );
}

// Composant pour contrôler la vue de la carte
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  
  return null;
}

export default GeoSpace;

