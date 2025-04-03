import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MdMyLocation, MdLocationCity, MdOutlinePublic, MdTerrain, MdSpeed, MdNetworkWifi, MdClose, MdColorLens, MdLogout, MdPeople, MdPersonAdd } from 'react-icons/md';
import { FaMapMarkerAlt, FaGoogle, FaHistory, FaUser, FaUserFriends } from 'react-icons/fa';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import axios from 'axios';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, onSnapshot } from 'firebase/firestore';

// Initialisation de Firebase
// Note: Vous devrez configurer votre propre app Firebase et ajouter les clés appropriées
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  // Ajoutez votre configuration Firebase ici
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
            
            // Si l'utilisateur est connecté, mettre à jour sa position dans Firestore
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

  // Fonction pour mettre à jour la position de l'utilisateur dans Firestore
  const updateUserLocation = async (positionData) => {
    try {
      // Vérifier si l'utilisateur existe déjà dans la collection "users"
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "==", currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // L'utilisateur existe, mettre à jour sa position
        const userDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "users", userDoc.id), {
          location: {
            latitude: positionData.position.lat,
            longitude: positionData.position.lng,
            altitude: positionData.altitude,
            speed: positionData.speed,
            accuracy: positionData.accuracy,
            lastUpdated: new Date().toISOString()
          },
          isOnline: true
        });
      } else {
        // L'utilisateur n'existe pas encore, l'ajouter
        await addDoc(collection(db, "users"), {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "Utilisateur",
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          location: {
            latitude: positionData.position.lat,
            longitude: positionData.position.lng,
            altitude: positionData.altitude,
            speed: positionData.speed,
            accuracy: positionData.accuracy,
            lastUpdated: new Date().toISOString()
          },
          isOnline: true,
          createdAt: new Date().toISOString()
        });
      }
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
          {currentUser && <p>Connecté en tant que: {currentUser.displayName || currentUser.email}</p>}
        </div>
      </Popup>
    </Marker>
  );
}

// Composant pour afficher un utilisateur sur la carte
function UserMarker({ user, currentUserId }) {
  const isCurrentUser = user.uid === currentUserId;
  const markerRef = useRef(null);
  const markerColor = isCurrentUser ? "#0066ff" : "#FF4136";
  
  // Ne pas afficher de marqueur pour l'utilisateur actuel (déjà affiché par LocationMarker)
  if (isCurrentUser) return null;
  
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
  
  // Surveiller l'état de l'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        
        // Ajout ou mise à jour de l'utilisateur dans Firestore
        const addUserToFirestore = async () => {
          try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("uid", "==", user.uid));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
              // Première connexion, ajouter l'utilisateur
              await addDoc(collection(db, "users"), {
                uid: user.uid,
                displayName: user.displayName || "Utilisateur",
                email: user.email,
                photoURL: user.photoURL,
                isOnline: true,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
              });
            } else {
              // Connexion d'un utilisateur existant, mettre à jour son statut
              const userDoc = querySnapshot.docs[0];
              await updateDoc(doc(db, "users", userDoc.id), {
                lastLogin: new Date().toISOString(),
                isOnline: true,
                photoURL: user.photoURL, // Mettre à jour la photo au cas où elle a changé
                displayName: user.displayName // Mettre à jour le nom au cas où il a changé
              });
            }
          } catch (error) {
            console.error("Erreur lors de l'ajout/mise à jour de l'utilisateur:", error);
          }
        };
        
        addUserToFirestore();
        setPermissionRequested(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });
    
    // Nettoyer l'écouteur lors du démontage du composant
    return () => unsubscribe();
  }, []);
  
  // Surveiller la collection des utilisateurs pour les mises à jour en temps réel
  useEffect(() => {
    if (isAuthenticated) {
      const usersRef = collection(db, "users");
      const unsubscribe = onSnapshot(usersRef, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(user => user.location); // Ne garder que les utilisateurs avec une position
        
        setOnlineUsers(usersData);
      });
      
      return () => unsubscribe();
    }
  }, [isAuthenticated]);
  
  // Mettre à jour le statut hors ligne au départ
  useEffect(() => {
    const updateUserStatus = async () => {
      if (currentUser) {
        try {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("uid", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            
            // Mettre à jour le statut en ligne
            await updateDoc(doc(db, "users", userDoc.id), {
              isOnline: true
            });
            
            // Configurer la mise à jour du statut hors ligne lors de la fermeture
            window.addEventListener('beforeunload', async () => {
              await updateDoc(doc(db, "users", userDoc.id), {
                isOnline: false,
                lastSeen: new Date().toISOString()
              });
            });
          }
        } catch (error) {
          console.error("Erreur lors de la mise à jour du statut:", error);
        }
      }
    };
    
    updateUserStatus();
  }, [currentUser]);
  
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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // L'utilisateur est maintenant connecté
      setCurrentUser(result.user);
      setIsAuthenticated(true);
      // Après l'authentification, demander la permission de localisation
      setPermissionRequested(true);
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
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, "users", userDoc.id), {
            isOnline: false,
            lastSeen: new Date().toISOString()
          });
        }
      }
      
      await signOut(auth);
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
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker 
            onLocationFound={(latLng) => console.log("Position trouvée sur la carte", latLng)} 
            onNewPosition={(posData) => console.log("Nouvelle position détectée", posData)}
            markerColor={markerColor}
            isPopupOpen={isPopupOpen}
            togglePopup={togglePopup}
            currentUser={currentUser}
          />
          {onlineUsers.map(user => (
            <UserMarker 
              key={user.uid} 
              user={user} 
              currentUserId={currentUser?.uid || ''}
            />
          ))}
        </MapContainer>
      </MapWrapper>

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
            <UserItem key={user.uid} isCurrentUser={user.uid === currentUser.uid} onClick={() => console.log(user)}>
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

