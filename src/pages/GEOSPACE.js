import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MdMyLocation, MdLocationCity, MdOutlinePublic, MdTerrain, MdSpeed, MdNetworkWifi, MdClose, MdColorLens, MdLogout, MdSearch, MdPerson } from 'react-icons/md';
import { FaMapMarkerAlt, FaGoogle, FaHistory, FaUsers, FaCity, FaMapMarked } from 'react-icons/fa';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import axios from 'axios';
import UsersMap from './UsersMap'; // Importer le nouveau composant
import { loginWithGoogle, getCurrentUser, logoutUser, saveUserLocation } from './appwrite'; // Utiliser les fonctions d'authentification d'Appwrite

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

// Boutons de contrôle repositionnés horizontalement
const ControlPanel = styled.div`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: row; // Assure que les boutons sont en ligne
  gap: 10px;
  justify-content: center; // Centre les boutons horizontalement
`;

const SearchBar = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 90%;
  max-width: 600px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  padding: 10px;
  display: flex;
  flex-direction: column;
`;

const SearchInput = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: ${props => props.showResults ? "10px" : "0"};

  input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    outline: none;
    &:focus {
      border-color: #0066ff;
    }
  }

  button {
    background-color: #0066ff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    margin-left: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    &:hover {
      background-color: #0052cc;
    }
  }
`;

// Disposition horizontale pour les catégories de recherche
const SearchCategories = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
  justify-content: center;
`;

const CategoryButton = styled.button`
  background-color: ${props => props.active ? "#0066ff" : "#f0f0f0"};
  color: ${props => props.active ? "white" : "#333"};
  border: none;
  border-radius: 15px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &:hover {
    background-color: ${props => props.active ? "#0052cc" : "#e0e0e0"};
  }
`;

const SearchResults = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid #eee;
`;

const SearchResultItem = styled.div`
  padding: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  
  &:hover {
    background-color: #f5f5f5;
  }
  
  .icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .details {
    flex: 1;
  }
  
  .name {
    font-weight: bold;
  }
  
  .description {
    font-size: 12px;
    color: #666;
  }
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

// Position des panneaux latéraux
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

// Boutons de contrôle sur les côtés
const SideControlsLeft = styled.div`
  position: absolute;
  left: 10px;
  top: 70px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

// Déplacé le sélecteur de couleur dans la barre latérale
const ColorPickerContainer = styled.div`
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
`;

const ColorButton = styled(Button)`
  width: 100%;
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

// Fonction pour créer une icône personnalisée basée sur un composant React, une couleur et un nom d'utilisateur
const createCustomIcon = (color = "#0066ff", username = null) => {
  const iconHtml = renderToString(
    <div style={{ 
      background: 'white', 
      borderRadius: '50%', 
      padding: '5px', 
      boxShadow: '0 0 5px rgba(0,0,0,0.3)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <MdMyLocation size={24} color={color} />
      {username && (
        <div style={{
          fontSize: '10px',
          fontWeight: 'bold',
          marginTop: '2px',
          textAlign: 'center',
          maxWidth: '50px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {username}
        </div>
      )}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-location-icon',
    iconSize: [40, 45], // Ajusté pour accommoder le nom d'utilisateur
    iconAnchor: [20, 22]
  });
};

// Composant pour suivre la position actuelle
function LocationMarker({ onLocationFound, onNewPosition, markerColor, isPopupOpen, togglePopup, username }) {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const map = useMap();
  const markerRef = useRef(null);

  const locationIcon = createCustomIcon(markerColor, username);
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

  // Mettre à jour l'icône lorsque la couleur ou le username change
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(createCustomIcon(markerColor, username));
    }
  }, [markerColor, username]);

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
            <h3>{username || 'Votre position actuelle'}</h3>
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
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
  
  // États pour la barre de recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'cities', 'users', 'regions'
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'utilisateur:', error);
      }
    };
    
    checkCurrentUser();
  }, []);
  
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
  const handleGoogleAuth = async () => {
    try {
      loginWithGoogle(); // Utiliser la fonction d'authentification d'Appwrite
    } catch (error) {
      console.error("Erreur lors de l'authentification Google:", error);
      alert("Erreur lors de la connexion. Veuillez réessayer.");
    }
  };
  
  // Fonction pour se déconnecter
  const handleLogout = async () => {
    try {
      await logoutUser();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
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
          
          // Sauvegarder la position dans Appwrite si l'utilisateur est connecté
          if (currentUser) {
            saveUserLocation(
              currentUser.$id, 
              { lat: latitude, lng: longitude },
              { neighborhood: locationInfo.neighborhood, city: locationInfo.city }
            ).catch(error => console.error('Erreur lors de la sauvegarde de la position:', error));
          }
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
          
          // Sauvegarder la position dans Appwrite si l'utilisateur est connecté
          if (currentUser) {
            saveUserLocation(
              currentUser.$id, 
              { lat: latitude, lng: longitude },
              { neighborhood: locationInfo.neighborhood, city: locationInfo.city }
            ).catch(error => console.error('Erreur lors de la sauvegarde de la position:', error));
          }
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
      
      // Sauvegarder dans Appwrite si l'utilisateur est connecté
      if (currentUser) {
        saveUserLocation(
          currentUser.$id, 
          newHistoryItem.position,
          { 
            neighborhood: locationInfo.neighborhood, 
            city: locationInfo.city,
            timestamp: newHistoryItem.timestamp
          }
        ).catch(error => console.error('Erreur lors de la sauvegarde de la position:', error));
      }
      
      return updatedHistory;
    });
  };

  // Fonction pour rechercher des lieux ou des utilisateurs
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      // Rechercher des lieux via Nominatim
      let results = [];
      
      if (activeCategory === 'all' || activeCategory === 'cities' || activeCategory === 'regions') {
        const nominatimResponse = await axios.get(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1`
        );
        
        const places = nominatimResponse.data.map(item => {
          let type = 'Lieu';
          let icon = <FaMapMarked />;
          
          if (item.type === 'city' || item.type === 'town' || item.type === 'village' || 
              (item.address && (item.address.city || item.address.town || item.address.village))) {
            type = 'Ville';
            icon = <FaCity />;
          } else if (item.type === 'administrative' || item.type === 'state' || item.type === 'region' || 
                    (item.address && item.address.state)) {
            type = 'Région';
            icon = <MdTerrain />;
          }
          
          return {
            id: item.place_id,
            name: item.display_name.split(',')[0],
            description: item.display_name,
            type: type,
            icon: icon,
            position: {
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            }
          };
        });
        
        // Filtrer selon la catégorie sélectionnée
        if (activeCategory === 'cities') {
          results = [...results, ...places.filter(place => place.type === 'Ville')];
        } else if (activeCategory === 'regions') {
          results = [...results, ...places.filter(place => place.type === 'Région')];
        } else {
          results = [...results, ...places];
        }
      }
      
      // Ici vous pourriez ajouter la recherche d'utilisateurs si vous avez une API pour cela
      if (activeCategory === 'all' || activeCategory === 'users') {
        // Exemple: recherche d'utilisateurs fictive
        const userResults = [
          {
            id: 'user1',
            name: 'John Doe',
            description: 'Utilisateur actif',
            type: 'Utilisateur',
            icon: <MdPerson />,
            position: { lat: 48.85, lng: 2.35 }
          },
          // Ajoutez d'autres utilisateurs si nécessaire
        ].filter(user => 
          searchQuery.toLowerCase() === '' || 
          user.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        results = [...results, ...userResults];
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Gérer le clic sur un résultat de recherche
  const handleResultClick = (result) => {
    setMapCenter([result.position.lat, result.position.lng]);
    setZoom(14); // Zoom adapté pour voir la zone
    setShowSearchResults(false);
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

  //  moteur de recherche n'est pas connecté, afficher l'écran d'authentification
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

      <SideControlsLeft>
        <Button onClick={centerOnLocation}>
          <MdMyLocation size={20} style={{ marginRight: '5px' }} />
          Ma position
        </Button>
        <ColorButton onClick={() => setShowColorPicker(!showColorPicker)}>
          <MdColorLens size={18} />
          Couleur du marqueur
        </ColorButton>
        <Button onClick={() => toggleInfoPanel()}>
          {showInfoPanel ? 'Masquer les infos' : 'Afficher les infos'}
        </Button>
        <Button onClick={() => togglePopup()}>
          {isPopupOpen ? 'Fermer le popup' : 'Ouvrir le popup'}
        </Button>
      </SideControlsLeft>
      
      <MapWrapper>
        <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={true}>
          {/* Couche de carte OpenStreetMap */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Marqueur de localisation actuelle avec le nom d'utilisateur */}
          <LocationMarker 
            onLocationFound={handleLocationFound} 
            onNewPosition={handleNewPosition}
            markerColor={markerColor}
            isPopupOpen={isPopupOpen}
            togglePopup={togglePopup}
            username={currentUser ? currentUser.name : null}
          />
          <MapController center={mapCenter} zoom={zoom} />

          {/* Composant pour afficher les utilisateurs inscrits sur la carte */}
          <UsersMap />
        </MapContainer>

        {/* Sélecteur pour choisir une couleur de marqueur */}
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
      </MapWrapper>

      {/* Panneau d'informations sur la localisation */}
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

            {/* Historique des positions */}
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

      {/* Barre de recherche située dans le footer */}
      <SearchBar>
        <SearchCategories>
          <CategoryButton
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          >
            <MdSearch /> Tous
          </CategoryButton>
          <CategoryButton
            active={activeCategory === 'cities'}
            onClick={() => setActiveCategory('cities')}
          >
            <FaCity /> Villes
          </CategoryButton>
          <CategoryButton
            active={activeCategory === 'regions'}
            onClick={() => setActiveCategory('regions')}
          >
            <MdTerrain /> Régions
          </CategoryButton>
          <CategoryButton
            active={activeCategory === 'users'}
            onClick={() => setActiveCategory('users')}
          >
            <FaUsers /> Utilisateurs
          </CategoryButton>
        </SearchCategories>
        <SearchInput showResults={showSearchResults}>
          <input
            type="text"
            placeholder="Rechercher des villes, quartiers, régions, ou utilisateurs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button onClick={handleSearch} disabled={isSearching}>
            <MdSearch size={20} />
            {isSearching ? 'Recherche...' : 'Rechercher'}
          </button>
        </SearchInput>
        {showSearchResults && (
          <SearchResults>
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <SearchResultItem
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                >
                  <div className="icon">{result.icon}</div>
                  <div className="details">
                    <div className="name">{result.name}</div>
                    <div className="description">{result.description}</div>
                  </div>
                </SearchResultItem>
              ))
            ) : (
              <p>Aucun résultat trouvé.</p>
            )}
          </SearchResults>
        )}
      </SearchBar>
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

