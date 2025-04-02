import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MdMyLocation, MdLocationCity, MdOutlinePublic, MdTerrain, MdSpeed, MdNetworkWifi, MdClose, MdColorLens, MdLogout } from 'react-icons/md';
import { FaMapMarkerAlt, FaGoogle, FaHistory } from 'react-icons/fa';
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
  max-width: 300px;
  max-height: 80vh;
  overflow-y: auto;
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

const LogoutButton = styled.button`
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1500;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
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

const HistoryContainer = styled.div`
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 10px;
`;

const HistoryItem = styled.div`
  padding: 8px;
  margin-bottom: 5px;
  border-radius: 4px;
  background-color: #f5f5f5;
  font-size: 0.9em;
  cursor: pointer;
  &:hover {
    background-color: #e0e0e0;
  }
`;

const SectionTitle = styled.h4`
  margin: 15px 0 5px 0;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 5px;
  right: 5px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  z-index: 1001;
  &:hover {
    background-color: rgba(0,0,0,0.05);
    border-radius: 50%;
  }
`;

const PopupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  position: relative;
`;

const ColorPickerContainer = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ColorButton = styled.button`
  position: absolute;
  top: 70px;
  left: 10px;
  z-index: 1000;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  &:hover {
    background-color: #f0f0f0;
  }
`;

// Sous-composant pour gérer l'ouverture/fermeture des fenêtres contextuelles
const ContextualWindowController = ({ isOpen, toggleWindow, children, title }) => {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <CloseButton onClick={() => toggleWindow(false)}>
        <MdClose size={20} />
      </CloseButton>
    </div>
  );
};

// Fonction pour créer une icône personnalisée basée sur un composant React et une couleur
const createCustomIcon = (color = "#0066ff") => {
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
      <MdMyLocation size={24} color={color} />
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
function LocationMarker({ onLocationFound, onNewPosition, markerColor, isPopupOpen, togglePopup }) {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const map = useMap();
  const markerRef = useRef(null);

  const locationIcon = createCustomIcon(markerColor);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, altitude, speed, accuracy } = pos.coords;
          const newPosition = { lat: latitude, lng: longitude };
          
          setPosition(newPosition);
          setSpeed(speed !== null ? speed : 'Non disponible');
          setAltitude(altitude !== null ? altitude : 'Non disponible');
          
          if (onLocationFound) {
            onLocationFound(newPosition);
          }
          
          if (onNewPosition) {
            onNewPosition({
              position: newPosition,
              altitude,
              speed,
              accuracy,
              timestamp: new Date().toISOString()
            });
          }
        },
        (error) => {
          console.error('Error tracking location:', error);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 0 
        }
      );
    }
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [map, onLocationFound, onNewPosition]);

  // Effet pour ouvrir ou fermer le popup selon l'état
  useEffect(() => {
    if (markerRef.current) {
      if (isPopupOpen) {
        markerRef.current.openPopup();
      } else {
        markerRef.current.closePopup();
      }
    }
  }, [isPopupOpen]);

  // Mettre à jour l'icône lorsque la couleur change
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(createCustomIcon(markerColor));
    }
  }, [markerColor]);

  return position === null ? null : (
    <Marker 
      position={position} 
      icon={locationIcon}
      ref={markerRef}
      eventHandlers={{
        popupopen: () => {
          if (!isPopupOpen) togglePopup(true);
        },
        popupclose: () => {
          if (isPopupOpen) togglePopup(false);
        }
      }}
    >
      <Popup 
        autoPan={true}
        closeButton={false}
      >
        <div>
          <PopupHeader>
            <h3>Votre position actuelle</h3>
            <CloseButton onClick={() => togglePopup(false)}>
              <MdClose size={20} />
            </CloseButton>
          </PopupHeader>
          <p>Latitude: {position.lat.toFixed(6)}</p>
          <p>Longitude: {position.lng.toFixed(6)}</p>
          {altitude !== null && <p>Altitude: {typeof altitude === 'number' ? `${altitude.toFixed(1)} m` : altitude}</p>}
          {speed !== null && <p>Vitesse: {typeof speed === 'number' ? `${(speed * 3.6).toFixed(1)} km/h` : speed}</p>}
        </div>
      </Popup>
    </Marker>
  );
}

function GeoSpace() {
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522]); // Paris par défaut
  const [zoom, setZoom] = useState(13);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Vérifier si l'utilisateur est déjà connecté lors du chargement initial
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [markerColor, setMarkerColor] = useState("#0066ff");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [locationInfo, setLocationInfo] = useState({
    neighborhood: '',
    city: '',
    country: '',
    latitude: '',
    longitude: '',
    altitude: '',
    speed: '',
    ip: '',
    accuracy: ''
  });
  const [locationHistory, setLocationHistory] = useState([]);
  const [userIp, setUserIp] = useState('');
  
  // Récupérer l'adresse IP de l'utilisateur au démarrage
  useEffect(() => {
    const fetchUserIp = async () => {
      try {
        const response = await axios.get('https://api.ipify.org?format=json');
        setUserIp(response.data.ip);
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'adresse IP:', error);
        setUserIp('Non disponible');
      }
    };
    
    fetchUserIp();
  }, []);

  // Fonction pour l'authentification Google
  const handleGoogleAuth = () => {
    // Ici, vous devriez implémenter l'authentification Google réelle
    // Pour l'exemple, on simule l'authentification
    console.log("Tentative d'authentification Google");
    setTimeout(() => {
      setIsAuthenticated(true);
      // Sauvegarder l'état d'authentification dans localStorage
      localStorage.setItem('isAuthenticated', 'true');
      // Après l'authentification, demander la permission de localisation
      setPermissionRequested(true);
    }, 1000);
  };
  
  // Fonction pour se déconnecter
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
  };

  // Fonction pour demander l'accès à la géolocalisation
  const requestLocationPermission = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, altitude, speed, accuracy } = position.coords;
          setMapCenter([latitude, longitude]);
          setZoom(16);
          setPermissionRequested(false);
          setIsPopupOpen(true); // Ouvrir le popup après obtention de la position
          // Récupérer les informations de localisation
          fetchLocationDetails(latitude, longitude, altitude, speed, accuracy);
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

  // Fonction pour récupérer les détails de localisation
  const fetchLocationDetails = async (latitude, longitude, altitude, speed, accuracy) => {
    try {
      // Utilisation de l'API Nominatim OpenStreetMap pour le geocoding inverse
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      
      const address = response.data.address;
      
      setLocationInfo({
        neighborhood: address.suburb || address.neighbourhood || address.residential || 'Non disponible',
        city: address.city || address.town || address.village || 'Non disponible',
        country: address.country || 'Non disponible',
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        altitude: altitude !== null ? `${altitude.toFixed(1)} m` : 'Non disponible',
        speed: speed !== null ? `${(speed * 3.6).toFixed(1)} km/h` : 'Non disponible',
        ip: userIp,
        accuracy: accuracy ? `${accuracy.toFixed(1)} m` : 'Non disponible'
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de localisation:', error);
      setLocationInfo({
        neighborhood: 'Non disponible',
        city: 'Non disponible',
        country: 'Non disponible',
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        altitude: altitude !== null ? `${altitude.toFixed(1)} m` : 'Non disponible',
        speed: speed !== null ? `${(speed * 3.6).toFixed(1)} km/h` : 'Non disponible',
        ip: userIp,
        accuracy: accuracy ? `${accuracy.toFixed(1)} m` : 'Non disponible'
      });
    }
  };

  // Fonction pour centrer sur la position actuelle
  const centerOnLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, altitude, speed, accuracy } = position.coords;
          setMapCenter([latitude, longitude]);
          setZoom(16);
          setIsPopupOpen(true); // Ouvrir le popup quand on centre sur la position
          fetchLocationDetails(latitude, longitude, altitude, speed, accuracy);
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { altitude, speed, accuracy } = position.coords;
          fetchLocationDetails(latlng.lat, latlng.lng, altitude, speed, accuracy);
        },
        (error) => {
          console.error('Error getting location details:', error);
          fetchLocationDetails(latlng.lat, latlng.lng, null, null, null);
        },
        { enableHighAccuracy: true }
      );
    } else {
      fetchLocationDetails(latlng.lat, latlng.lng, null, null, null);
    }
  };

  // Fonction pour enregistrer une nouvelle position
  const handleNewPosition = (positionData) => {
    // Ajouter la nouvelle position à l'historique
    const newHistoryItem = {
      ...positionData,
      id: Date.now(), // Utiliser un timestamp comme identifiant unique
    };
    
    setLocationHistory(prevHistory => {
      // Limiter l'historique aux 20 dernières positions
      const updatedHistory = [newHistoryItem, ...prevHistory].slice(0, 20);
      
      // Ici, vous pourriez enregistrer l'historique dans une collection de base de données
      // saveToDatabase(newHistoryItem);
      
      return updatedHistory;
    });
  };

  // Fonction pour centrer la carte sur une position de l'historique
  const goToHistoricalPosition = (position) => {
    setMapCenter([position.position.lat, position.position.lng]);
    setZoom(16);
  };
  
  // Formater l'heure pour l'affichage dans l'historique
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Fonction pour basculer l'état du popup
  const togglePopup = (state) => {
    setIsPopupOpen(typeof state === 'boolean' ? state : !isPopupOpen);
  };
  
  // Fonction pour basculer l'affichage du panneau d'information
  const toggleInfoPanel = (state) => {
    setShowInfoPanel(typeof state === 'boolean' ? state : !showInfoPanel);
  };

  // Liste de couleurs prédéfinies pour les marqueurs
  const predefinedColors = [
    "#0066ff", // Bleu (par défaut)
    "#FF4136", // Rouge
    "#2ECC40", // Vert
    "#FF851B", // Orange
    "#B10DC9", // Violet
    "#111111", // Noir
    "#85144b"  // Bordeaux
  ];

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
      
      {/* Bouton de déconnexion affiché uniquement lorsque l'utilisateur est connecté */}
      <LogoutButton onClick={handleLogout}>
        <MdLogout size={18} />
        Déconnexion
      </LogoutButton>
      
      <MapWrapper>
        <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker 
            onLocationFound={handleLocationFound} 
            onNewPosition={handleNewPosition}
            markerColor={markerColor}
            isPopupOpen={isPopupOpen}
            togglePopup={togglePopup}
          />
          <MapController center={mapCenter} zoom={zoom} />
        </MapContainer>

        <ColorButton onClick={() => setShowColorPicker(!showColorPicker)}>
          <MdColorLens size={18} />
          Couleur du marqueur
        </ColorButton>

        {showColorPicker && (
          <ColorPickerContainer>
            <ContextualWindowController 
              isOpen={showColorPicker} 
              toggleWindow={setShowColorPicker}
              title="Couleur du marqueur"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Couleur du marqueur</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {predefinedColors.map((color, index) => (
                  <div 
                    key={index}
                    style={{
                      backgroundColor: color,
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: markerColor === color ? '2px solid black' : '2px solid transparent'
                    }}
                    onClick={() => setMarkerColor(color)}
                  />
                ))}
              </div>
              <input 
                type="color" 
                value={markerColor}
                onChange={(e) => setMarkerColor(e.target.value)}
                style={{ width: '100%' }}
              />
            </ContextualWindowController>
          </ColorPickerContainer>
        )}

        {showInfoPanel && (
          <InfoPanel>
            <ContextualWindowController
              isOpen={showInfoPanel}
              toggleWindow={toggleInfoPanel}
              title="Votre localisation"
            >
              <h3>Votre localisation</h3>
              
              <SectionTitle>Informations géographiques</SectionTitle>
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
              
              <SectionTitle>Données techniques</SectionTitle>
              <LocationInfo>
                <MdMyLocation size={16} color={markerColor} />
                <span>Latitude: {locationInfo.latitude}</span>
              </LocationInfo>
              <LocationInfo>
                <MdMyLocation size={16} color={markerColor} />
                <span>Longitude: {locationInfo.longitude}</span>
              </LocationInfo>
              <LocationInfo>
                <MdTerrain size={16} color="#B10DC9" />
                <span>Altitude: {locationInfo.altitude}</span>
              </LocationInfo>
              <LocationInfo>
                <MdSpeed size={16} color="#FF851B" />
                <span>Vitesse: {locationInfo.speed}</span>
              </LocationInfo>
              <LocationInfo>
                <MdNetworkWifi size={16} color="#85144b" />
                <span>Précision: {locationInfo.accuracy}</span>
              </LocationInfo>
              <LocationInfo>
                <MdNetworkWifi size={16} color="#3D9970" />
                <span>Adresse IP: {locationInfo.ip}</span>
              </LocationInfo>

              {locationHistory.length > 0 && (
                <HistoryContainer>
                  <SectionTitle>
                    <FaHistory size={16} color="#AAAAAA" />
                    Historique des positions
                  </SectionTitle>
                  {locationHistory.map((item, index) => (
                    <HistoryItem 
                      key={item.id} 
                      onClick={() => goToHistoricalPosition(item)}
                    >
                      {formatTime(item.timestamp)} - 
                      Lat: {item.position.lat.toFixed(4)}, 
                      Lng: {item.position.lng.toFixed(4)}
                    </HistoryItem>
                  ))}
                </HistoryContainer>
              )}
            </ContextualWindowController>
          </InfoPanel>
        )}

        <ControlPanel>
          <Button onClick={centerOnLocation}>
            <MdMyLocation size={20} style={{ marginRight: '5px' }} />
            Ma position
          </Button>
          <Button onClick={() => togglePopup()}>
            {isPopupOpen ? 'Fermer le popup' : 'Ouvrir le popup'}
          </Button>
          <Button onClick={() => toggleInfoPanel()}>
            {showInfoPanel ? 'Masquer les infos' : 'Afficher les infos'}
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

