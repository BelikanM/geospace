import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { Box, useToast } from '@chakra-ui/react';
import { getCurrentUser, upsertUser, getAllUsers } from '../lib/appwrite';
import UserMarker from './UserMarker';
import CurrentUserMarker from './CurrentUserMarker';
import Chat from './Chat';
import { client } from '../lib/appwrite';
import { DATABASE_ID, USERS_COLLECTION_ID } from '../lib/appwrite';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

const defaultCenter = {
  lat: 48.866667,
  lng: 2.333333
};

const Map = () => {
  const [map, setMap] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const toast = useToast();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY
  });

  // Récupérer l'utilisateur courant
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  // Récupérer la position de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserPosition(pos);

          // Mettre à jour la position de l'utilisateur dans la base de données
          if (currentUser) {
            updateUserLocation(pos);
          }
        },
        (error) => {
          console.error('Erreur de géolocalisation:', error);
          toast({
            title: "Erreur de géolocalisation",
            description: "Impossible d'accéder à votre position",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      );
    } else {
      toast({
        title: "Géolocalisation non supportée",
        description: "Votre navigateur ne supporte pas la géolocalisation",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [currentUser, toast]);

  // Mettre à jour la position de l'utilisateur dans la base de données
  const updateUserLocation = async (position) => {
    try {
      if (!currentUser) return;

      await upsertUser(currentUser.$id, {
        name: currentUser.name,
        email: currentUser.email,
        location: {
          latitude: position.lat,
          longitude: position.lng
        }
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la position:', error);
    }
  };

  // Récupérer tous les utilisateurs
  const fetchUsers = useCallback(async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

        // Abonnement aux mises à jour des utilisateurs en temps réel
    const unsubscribe = client.subscribe(`databases.${DATABASE_ID}.collections.${USERS_COLLECTION_ID}.documents`, (response) => {
      if (response.events.includes('databases.*.collections.*.documents.*.create') ||
          response.events.includes('databases.*.collections.*.documents.*.update')) {
        fetchUsers();
      }
    });

    // Nettoyer l'abonnement quand le composant est démonté
    return () => {
      unsubscribe();
    };
  }, [fetchUsers]);

  // Gérer le clic sur la carte
  const onMapClick = () => {
    setSelectedUser(null);
    setIsChatOpen(false);
  };

  // Gérer le clic sur un marqueur d'utilisateur
  const handleUserClick = (user) => {
    setSelectedUser(user);
    setIsChatOpen(true);
  };

  // Fermer le chat
  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  const onLoad = useCallback((map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  return isLoaded ? (
    <Box position="relative" height="100vh" width="100%">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={userPosition || defaultCenter}
        zoom={13}
        onClick={onMapClick}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Afficher le marqueur de l'utilisateur actuel */}
        {userPosition && currentUser && (
          <CurrentUserMarker
            position={userPosition}
            user={currentUser}
          />
        )}

        {/* Afficher les marqueurs des autres utilisateurs */}
        {users
          .filter(user => user.$id !== currentUser?.$id)
          .map(user => (
            user.location && (
              <UserMarker
                key={user.$id}
                position={{
                  lat: user.location.latitude,
                  lng: user.location.longitude
                }}
                user={user}
                onClick={() => handleUserClick(user)}
                isSelected={selectedUser && selectedUser.$id === user.$id}
              />
            )
          ))
        }
      </GoogleMap>

      {/* Afficher le chat quand un utilisateur est sélectionné */}
      {isChatOpen && selectedUser && (
        <Chat
          currentUser={currentUser}
          selectedUser={selectedUser}
          onClose={handleCloseChat}
        />
      )}
    </Box>
  ) : (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      width="100%"
      bg="gray.100"
    >
      Chargement de la carte...
    </Box>
  );
};

export default Map;

