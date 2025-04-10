import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { loginUser, createUser, logoutUser, getCurrentUser, saveUserLocation, getUserLocations, loginWithGoogle } from '../appwrite'; // Vérifie l'importation ici
import L from 'leaflet';

const Chat = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [usersNearby, setUsersNearby] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Récupérer la localisation de l'utilisateur dès qu'il est connecté
    const fetchUserLocation = async () => {
      try {
        const user = await getCurrentUser();  // Fonction importée
        setCurrentUser(user);
        if (user) {
          // Récupérer la localisation de l'utilisateur
          const locations = await getUserLocations(user.$id);
          setUserLocation(locations[0]);  // Supposons qu'il y a toujours une localisation
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de la localisation utilisateur', error);
      }
    };
    fetchUserLocation();
  }, []);

  const handleLocationChange = (e) => {
    const latLng = e.latlng;
    setUserLocation({ lat: latLng.lat, lng: latLng.lng });
  };

  const saveLocation = async () => {
    if (userLocation && currentUser) {
      await saveUserLocation(currentUser.$id, userLocation, { neighborhood: 'unknown', weather: {} });
      alert('Localisation sauvegardée');
    }
  };

  const handleLogin = async (email, password) => {
    try {
      await loginUser(email, password);
      alert('Connecté');
    } catch (error) {
      console.error('Erreur de connexion', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      alert('Déconnecté');
    } catch (error) {
      console.error('Erreur de déconnexion', error);
    }
  };

  return (
    <div>
      <h1>Chat Géolocalisé</h1>
      {currentUser ? (
        <div>
          <button onClick={handleLogout}>Se déconnecter</button>
          <MapContainer
            center={userLocation ? [userLocation.lat, userLocation.lng] : [51.505, -0.09]}
            zoom={13}
            style={{ height: "400px", width: "100%" }}
            onClick={handleLocationChange}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]}>
                <Popup>
                  Votre position
                  <br />
                  <button onClick={saveLocation}>Sauvegarder</button>
                </Popup>
              </Marker>
            )}
            {/* Afficher d'autres utilisateurs à proximité */}
            {usersNearby.map((user, index) => (
              <Marker key={index} position={[user.latitude, user.longitude]}>
                <Popup>{user.user_id}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div>
          <button onClick={() => loginWithGoogle()}>Se connecter avec Google</button>
          <button onClick={() => handleLogin('test@test.com', 'password')}>Se connecter avec Email</button>
        </div>
      )}
    </div>
  );
};

export default Chat;
