import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MdMyLocation, MdLocationCity, MdOutlinePublic, MdTerrain, MdSpeed, MdNetworkWifi, 
         MdClose, MdColorLens, MdLogout, MdPeople, MdPersonAdd, MdSearch, MdFilterList } from 'react-icons/md';
import { FaMapMarkerAlt, FaGoogle, FaHistory, FaUser, FaUserFriends } from 'react-icons/fa';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import axios from 'axios';
import { Client, Account, Databases, Query, ID } from 'appwrite';

// Appwrite configuration
const AppwriteConfig = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || '67bb24ad002378e79e38',
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID || '67bb32ca00157be0d0a2',
  usersCollectionId: process.env.REACT_APP_APPWRITE_USERS_COLLECTION_ID || '67ec0ff5002cafd109d7',
  locationsCollectionId: process.env.REACT_APP_APPWRITE_LOCATIONS_COLLECTION_ID || '67ec1023001e909ee0a3'
};

// Initialize Appwrite
const client = new Client();
client
  .setEndpoint(AppwriteConfig.endpoint)
  .setProject(AppwriteConfig.projectId);

const account = new Account(client);
const databases = new Databases(client);

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

const UsersPanel = styled.div`
  position: absolute;
  top: 10px;
  left: 70px;
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

const UserItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 5px;
  border-radius: 4px;
  background-color: ${props => props.isCurrentUser ? '#e6f7ff' : '#f5f5f5'};
  font-size: 0.9em;
  cursor: pointer;
  &:hover {
    background-color: ${props => props.isCurrentUser ? '#cceeff' : '#e0e0e0'};
  }
`;

const UserAvatar = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #ddd;
  background-image: ${props => props.photoURL ? `url(${props.photoURL})` : 'none'};
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const OnlineIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.isOnline ? '#4caf50' : '#9e9e9e'};
  margin-left: auto;
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

const UsersButton = styled.button`
  position: absolute;
  top: 70px;
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
  top: 130px;
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

// Nouveaux composants pour la barre de recherche et le filtre
const SearchContainer = styled.div`
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  width: 70%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SearchInputContainer = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0 10px;
  background-color: #f9f9f9;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 10px;
  border: none;
  outline: none;
  background: transparent;
`;

const SearchResults = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border-radius: 5px;
  background-color: white;
  box-shadow: ${props => props.isVisible ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'};
  display: ${props => props.isVisible ? 'block' : 'none'};
`;

const SearchResultItem = styled.div`
  padding: 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  &:hover {
    background-color: #f5f5f5;
  }
  &:last-child {
    border-bottom: none;
  }
`;

const FilterContainer = styled.div`
  display: ${props => props.isVisible ? 'flex' : 'none'};
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
`;

const FilterButton = styled.button`
  background-color: ${props => props.active ? '#0066ff' : '#f5f5f5'};
  color: ${props => props.active ? 'white' : 'black'};
  border: 1px solid #ddd;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
  &:hover {
    background-color: ${props => props.active ? '#0055dd' : '#e5e5e5'};
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
const createCustomIcon = (color = "#0066ff", isUser = false, photoURL = null) => {
  let iconHtml;
  if (isUser && photoURL) {
    // Utiliser la photo de profil pour les autres utilisateurs
    iconHtml = renderToString(
      <div style={{ 
        borderRadius: '50%', 
        overflow: 'hidden',
        boxShadow: '0 0 5px rgba(0,0,0,0.3)',
        width: '34px',
        height: '34px'
      }}>
        <img src={photoURL} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  } else {
    // Icône par défaut
    iconHtml = renderToString(
      <div style={{ 
        background: 'white', 
        borderRadius: '50%', 
        padding: '5px', 
        boxShadow: '0 0 5px rgba(0,0,0,0.3)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {isUser ? <FaUser size={24} color={color} /> : <MdMyLocation size={24} color={color} />}
      </div>
    );
  }

  return L.divIcon({
    html: iconHtml,
    className: 'custom-location-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

// Composant de recherche et zoom sur la carte
function SearchAndFilter({ map, onLocationSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    online: false,
    offline: false,
    nearMe: false
  });

  // Effectuer la recherche de lieux
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const fetchLocations = async () => {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&limit=5`
        );
        setSearchResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error("Erreur lors de la recherche:", error);
        setSearchResults([]);
      }
    };

    // Imposer un délai pour éviter trop de requêtes pendant la frappe
    const timeoutId = setTimeout(() => {
      fetchLocations();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleLocationSelect = (location) => {
    const { lat, lon, display_name } = location;
    if (map && lat && lon) {
      map.setView([lat, lon], 14);
      if (onLocationSelect) {
        onLocationSelect({
          lat: parseFloat(lat),
          lng: parseFloat(lon),
          name: display_name
        });
      }
    }
    setShowResults(false);
    setSearchQuery('');
  };

  const toggleFilter = (filterName) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  return (
    <SearchContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SearchInputContainer>
          <MdSearch size={20} color="#666" />
          <SearchInput
            type="text"
            placeholder="Rechercher une zone, un quartier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searchQuery && (
            <MdClose 
              size={18} 
              color="#666" 
              style={{ cursor: 'pointer' }} 
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
            />
          )}
        </SearchInputContainer>
        <Button 
          onClick={() => setShowFilters(!showFilters)} 
          style={{ marginLeft: '10px', padding: '10px' }}
        >
          <MdFilterList size={20} color={showFilters ? '#0066ff' : '#666'} />
        </Button>
      </div>

      <SearchResults isVisible={showResults && searchResults.length > 0}>
        {searchResults.map((result, index) => (
          <SearchResultItem 
            key={index} 
            onClick={() => handleLocationSelect(result)}
          >
            <div style={{ fontWeight: 'bold' }}>
              {result.display_name.split(',')[0]}
            </div>
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              {result.display_name}
            </div>
          </SearchResultItem>
        ))}
      </SearchResults>

      <FilterContainer isVisible={showFilters}>
        <FilterButton 
          active={activeFilters.online}
          onClick={() => toggleFilter('online')}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4caf50' }}></div>
          En ligne
        </FilterButton>
        <FilterButton 
          active={activeFilters.offline}
          onClick={() => toggleFilter('offline')}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9e9e9e' }}></div>
          Hors ligne
        </FilterButton>
        <FilterButton 
          active={activeFilters.nearMe}
          onClick={() => toggleFilter('nearMe')}
        >
          <MdMyLocation size={14} />
          Près de moi
        </FilterButton>
      </FilterContainer>
    </SearchContainer>
  );
}

// Composant pour suivre la position actuelle
function LocationMarker({ onLocationFound, onNewPosition, markerColor, isPopupOpen, togglePopup, currentUser }) {
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
            const positionData = {
              position: newPosition,
              altitude,
              speed,
              accuracy,
              timestamp: new Date().toISOString()
            };
            onNewPosition(positionData);
            
            // Si l'utilisateur est connecté, mettre à jour sa position dans Appwrite
            if (currentUser) {
              updateUserLocation(positionData);
            }
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
  }, [map, onLocationFound, onNewPosition, currentUser]);

  // Fonction pour mettre à jour la position de l'utilisateur dans Appwrite
  const updateUserLocation = async (positionData) => {
    try {
      // Vérifier si l'utilisateur existe déjà dans la collection "users"
      const response = await databases.listDocuments(
        AppwriteConfig.databaseId,
        AppwriteConfig.usersCollectionId,
        [
          Query.equal("userId", currentUser.$id)
        ]
      );
      
      const userData = {
        userId: currentUser.$id,
        displayName: currentUser.name || "Utilisateur",
        email: currentUser.email,
        location: {
          latitude: positionData.position.lat,
          longitude: positionData.position.lng,
          altitude: positionData.altitude,
          speed: positionData.speed,
          accuracy: positionData.accuracy,
          lastUpdated: new Date().toISOString()
        },
        isOnline: true
      };
      
      if (response.documents.length > 0) {
        // L'utilisateur existe, mettre à jour sa position
        await databases.updateDocument(
          AppwriteConfig.databaseId,
          AppwriteConfig.usersCollectionId,
          response.documents[0].$id,
          userData
        );
      } else {
        // L'utilisateur n'existe pas encore, l'ajouter
        await databases.createDocument(
          AppwriteConfig.databaseId,
          AppwriteConfig.usersCollectionId,
          ID.unique(),
          {
            ...userData,
            createdAt: new Date().toISOString()
          }
        );
      }
      
      // Enregistrer également l'historique de position
      await databases.createDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.locationsCollectionId,
        ID.unique(),
        {
          userId: currentUser.$id,
          latitude: positionData.position.lat,
          longitude: positionData.position.lng,
          altitude: positionData.altitude,
          speed: positionData.speed,
          accuracy: positionData.accuracy,
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la position:", error);
    }
  };

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
          {currentUser && <p>Connecté en tant que: {currentUser.name || currentUser.email}</p>}
        </div>
      </Popup>
    </Marker>
  );
}

// Composant pour afficher un utilisateur sur la carte
function UserMarker({ user, currentUserId, filterSettings }) {
  const isCurrentUser = user.userId === currentUserId;
  const markerRef = useRef(null);
  const markerColor = isCurrentUser ? "#0066ff" : "#FF4136";
  
  // Ne pas afficher de marqueur pour l'utilisateur actuel (déjà affiché par LocationMarker)
  if (isCurrentUser) return null;
  
  // Filtrage des utilisateurs selon les paramètres
  if (filterSettings) {
    // Filtre en ligne/hors ligne
    if (filterSettings.online && !user.isOnline) return null;
    if (filterSettings.offline && user.isOnline) return null;
    
    // Filtre "près de moi" - nécessite de calculer la distance
    if (filterSettings.nearMe && filterSettings.userPosition) {
      const distance = calculateDistance(
        filterSettings.userPosition.lat,
        filterSettings.userPosition.lng,
        user.location.latitude,
        user.location.longitude
      );
      // Considérer "près de moi" comme étant à moins de 5 km
      if (distance > 5) return null;
    }
  }
  
  const position = [user.location.latitude, user.location.longitude];
  const userIcon = createCustomIcon(markerColor, true, user.photoURL);
  
  return (
    <Marker 
      position={position} 
      icon={userIcon}
      ref={markerRef}
    >
      <Popup 
        autoPan={true}
        closeButton={true}
      >
        <div>
          <PopupHeader>
            <h3>{user.displayName || "Utilisateur"}</h3>
          </PopupHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName} 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                backgroundColor: '#ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FaUser size={20} color="#666" />
              </div>
            )}
            <div>
              <div>{user.displayName || "Utilisateur"}</div>
              <div style={{ fontSize: '0.8em', color: '#666' }}>
                {user.isOnline ? "En ligne" : "Hors ligne"}
              </div>
            </div>
          </div>
          <p>Latitude: {user.location.latitude.toFixed(6)}</p>
          <p>Longitude: {user.location.longitude.toFixed(6)}</p>
          {user.location.altitude && <p>Altitude: {user.location.altitude.toFixed(1)} m</p>}
        </div>
      </Popup>
    </Marker>
  );
}

// Fonction pour calculer la distance entre deux points géographiques
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convertir degrés en radians
function toRad(degrees) {
  return degrees * Math.PI / 180;
}

// Composant pour accéder à la carte depuis les sous-composants enfants
function MapController({ children, onMapReady }) {
  const map = useMap();
  
  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return <>{children}</>;
}

function GeoSpace() {
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522]); // Paris par défaut
  const [zoom, setZoom] = useState(13);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
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
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [leafletMap, setLeafletMap] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [filterSettings, setFilterSettings] = useState({
    online: false,
    offline: false,
    nearMe: false,
    userPosition: null
  });
  
  // Vérifier l'état de l'authentification au démarrage
  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const user = await account.get();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setPermissionRequested(true);
          
          // Mettre à jour le statut de l'utilisateur dans la base de données
          updateUserStatus(user.$id, true);
        }
      } catch (error) {
        console.log('Not authenticated yet');
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    };
    
    checkCurrentUser();
    
    // Créer un intervalle pour récupérer les utilisateurs
    const interval = setInterval(fetchOnlineUsers, 10000); // Toutes les 10 secondes
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Mettre à jour les filtres quand la position de l'utilisateur change
  useEffect(() => {
    if (userPosition) {
      setFilterSettings(prev => ({
        ...prev,
        userPosition
      }));
    }
  }, [userPosition]);
  
  // Fonction pour récupérer les utilisateurs en ligne
  const fetchOnlineUsers = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await databases.listDocuments(
        AppwriteConfig.databaseId,
        AppwriteConfig.usersCollectionId,
        [
          Query.isNotNull("location")
        ]
      );
      
      setOnlineUsers(response.documents);
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs:", error);
    }
  };
  
  // Mettre à jour le statut de l'utilisateur dans la base de données
  const updateUserStatus = async (userId, isOnline) => {
    try {
      // Vérifier si l'utilisateur existe déjà
      const response = await databases.listDocuments(
        AppwriteConfig.databaseId,
        AppwriteConfig.usersCollectionId,
        [
          Query.equal("userId", userId)
        ]
      );
      
      if (response.documents.length > 0) {
        // L'utilisateur existe, mettre à jour
        await databases.updateDocument(
          AppwriteConfig.databaseId,
          AppwriteConfig.usersCollectionId,
          response.documents[0].$id,
          {
            isOnline: isOnline,
            lastSeen: new Date().toISOString()
          }
        );
      } else if (isOnline && currentUser) {
        // L'utilisateur n'existe pas et se connecte, le créer
        await databases.createDocument(
          AppwriteConfig.databaseId,
          AppwriteConfig.usersCollectionId,
          ID.unique(),
          {
            userId: userId,
            displayName: currentUser.name || "Utilisateur",
            email: currentUser.email,
            isOnline: true,
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
          }
        );
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
    }
  };
  
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

  // Mettre à jour la liste des utilisateurs en ligne quand l'état d'authentification change
  useEffect(() => {
    if (isAuthenticated) {
      fetchOnlineUsers();
      
      // Configurer l'événement beforeunload pour mettre à jour le statut
      const handleBeforeUnload = () => {
        if (currentUser) {
          updateUserStatus(currentUser.$id, false);
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (currentUser) {
          updateUserStatus(currentUser.$id, false);
        }
      };
    }
  }, [isAuthenticated, currentUser]);

  // Fonction pour l'authentification Google
  const handleGoogleAuth = () => {
    try {
      const redirectUrl = window.location.origin;
      account.createOAuth2Session('google', redirectUrl, redirectUrl);
    } catch (error) {
      console.error("Erreur d'authentification Google:", error);
      alert("Échec de la connexion. Veuillez réessayer.");
    }
  };
  
  // Fonction pour se déconnecter
  const handleLogout = async () => {
    try {
      // Mettre à jour le statut en ligne avant la déconnexion
      if (currentUser) {
        await updateUserStatus(currentUser.$id, false);
      }
      
      await account.deleteSession('current');
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  // Fonction pour
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
          setUserPosition({ lat: latitude, lng: longitude });
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

  // Fonction pour afficher ou fermer le popup
  const togglePopup = (state) => {
    setIsPopupOpen(typeof state === 'boolean' ? state : !isPopupOpen);
  };

  // Fonction pour basculer l'affichage du panneau d'information utilisateur
  const toggleInfoPanel = (state) => {
    setShowInfoPanel(typeof state === 'boolean' ? state : !showInfoPanel);
  };

  // Fonction pour afficher ou masquer le panneau des utilisateurs en ligne
  const toggleUsersPanel = (state) => {
    setShowUsersPanel(typeof state === 'boolean' ? state : !showUsersPanel);
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
            <p>Nous avons besoin d'accéder à votre position géographique pour une expérience optimale.</p>
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

      <LogoutButton onClick={handleLogout}>
        <MdLogout size={18} />
        Déconnexion
      </LogoutButton>

      <UsersButton onClick={() => toggleUsersPanel()}>
        <MdPeople size={18} />
        {showUsersPanel ? 'Masquer les utilisateurs' : 'Afficher les utilisateurs'}
      </UsersButton>

      <MapWrapper>
        <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={true}>
          <MapController onMapReady={setLeafletMap}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker 
              onLocationFound={(latLng) => console.log("Position trouvée sur la carte", latLng)} 
              onNewPosition={(posData) => {
                console.log("Nouvelle position détectée", posData);
                setUserPosition(posData.position);
              }}
              markerColor={markerColor}
              isPopupOpen={isPopupOpen}
              togglePopup={togglePopup}
              currentUser={currentUser}
            />
            {onlineUsers.map(user => (
              <UserMarker 
                key={user.userId} 
                user={user} 
                currentUserId={currentUser?.$id || ''}
                filterSettings={filterSettings}
              />
            ))}
          </MapController>
        </MapContainer>
      </MapWrapper>

      <SearchAndFilter 
        map={leafletMap} 
        onLocationSelect={setMapCenter}
      />

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
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {['#0066ff', '#FF4136', '#2ECC40', '#FF851B', '#B10DC9', '#111111', '#85144b'].map(color => (
                  <div 
                    key={color}
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
            </div>
          </ContextualWindowController>
        </ColorPickerContainer>
      )}

      {showInfoPanel && (
        <InfoPanel>
          <ContextualWindowController
            isOpen={showInfoPanel}
            toggleWindow={toggleInfoPanel}
          >
            <h3>Votre localisation</h3>
            <p>Quartier : {locationInfo.neighborhood}</p>
            <p>Ville : {locationInfo.city}</p>
            <p>Pays : {locationInfo.country}</p>
            <p>Latitude : {locationInfo.latitude}</p>
            <p>Longitude : {locationInfo.longitude}</p>
          </ContextualWindowController>
        </InfoPanel>
      )}

      {showUsersPanel && (
        <UsersPanel>
          <h3>Utilisateurs connectés</h3>
          {onlineUsers.map(user => (
            <UserItem 
              key={user.userId} 
              isCurrentUser={user.userId === currentUser?.$id}
              onClick={() => console.log(user)}
            >
              <UserAvatar photoURL={user.photoURL}>
                {!user.photoURL && <FaUser />}
              </UserAvatar>
              <span>{user.displayName || "Utilisateur inconnu"}</span>
              <OnlineIndicator isOnline={user.isOnline} />
            </UserItem>
          ))}
        </UsersPanel>
      )}

      <ControlPanel>
        <Button onClick={() => setMapCenter([48.8566, 2.3522])}>
          <MdMyLocation size={20} /> Centrer Paris
        </Button>
      </ControlPanel>
    </GeoSpaceContainer>
  );
}

export default GeoSpace;

