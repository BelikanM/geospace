import React, { useState, useEffect } from 'react';
import { Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import { MdPerson, MdPhone, MdClose, MdEmail, MdGroup } from 'react-icons/md';
import { databases, DATABASE_ID, account } from './appwrite';
import { ID, Query } from 'appwrite';

// Styles
const PopupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  position: relative;
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

const UserInfo = styled.div`
  margin: 5px 0;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const UserButton = styled.button`
  position: absolute;
  top: 130px;
  left: 10px;
  z-index: 1000;
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

const RefreshButton = styled.button`
  margin-top: 10px;
  padding: 5px 10px;
  background-color: #0074D9;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  &:hover {
    background-color: #005fa3;
  }
`;

const UsersPanel = styled.div`
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background-color: white;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  max-width: 300px;
  max-height: 80vh;
  overflow-y: auto;
  display: ${props => props.visible ? 'block' : 'none'};
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 5px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 3px;
`;

// Création d'une icône principale pour l'utilisateur
const createUserIcon = (color = "#FF4136") => {
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
      <MdPerson size={24} color={color} />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-user-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

// Création d'une icône avatar pour les positions historiques
const createAvatarIcon = (avatarUrl, hostName, color) => {
  let content;
  if (avatarUrl) {
    content = `<div style="display:flex; flex-direction: column; align-items: center;">
      <img src="${avatarUrl}" alt="${hostName}" style="width:24px; height:24px; border-radius:50%; border:2px solid ${color};" />
      <span style="font-size:10px; color:${color};">${hostName}</span>
    </div>`;
  } else {
    // Fallback avec une icône SVG simple
    content = `<div style="display:flex; flex-direction: column; align-items: center;">
      <svg width="24" height="24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
      <span style="font-size:10px; color:${color};">${hostName}</span>
    </div>`;
  }
  return L.divIcon({
    html: content,
    className: 'custom-avatar-icon',
    iconSize: [30, 40],
    iconAnchor: [15, 40]
  });
};

const USERS_COLLECTION_ID = '67ec0ff5002cafd109d7';

const UsersMap = () => {
  const [users, setUsers] = useState([]);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [openPopupId, setOpenPopupId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Stocker l'historique des positions pour chaque utilisateur
  const [trajectories, setTrajectories] = useState({});

  // Récupérer l'utilisateur connecté
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const user = await account.get();
        setCurrentUser(user);
      } catch (error) {
        console.error('Utilisateur non connecté:', error);
      }
    };
    getCurrentUser();
  }, []);

  // Définir la couleur de l'icône en fonction du statut
  const getUserIconColor = (user) => {
    if (currentUser && user.$id === currentUser.$id) {
      return 'green'; // utilisateur courant
    }
    // Considère l'utilisateur en ligne si sa dernière position date de moins de 5 minutes
    const lastUpdate = new Date(user.timestamp || user.$createdAt);
    if ((new Date() - lastUpdate) < 5 * 60 * 1000) {
      return 'blue';
    }
    return 'gray';
  };

  // Fonction de mise à jour de la position (automatique et manuelle)
  const updatePosition = () => {
    if (!currentUser) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await databases.updateDocument(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            currentUser.$id,
            {
              latitude,
              longitude,
              timestamp: new Date().toISOString(),
            }
          );
          console.log('Position mise à jour pour:', currentUser.name);
          // Mise à jour locale de la trajectoire pour l'utilisateur courant
          setTrajectories(prev => {
            const newTrajectories = { ...prev };
            const pos = [latitude, longitude];
            if (!newTrajectories[currentUser.$id]) {
              newTrajectories[currentUser.$id] = [pos];
            } else {
              const lastPos = newTrajectories[currentUser.$id][newTrajectories[currentUser.$id].length - 1];
              if (lastPos[0] !== latitude || lastPos[1] !== longitude) {
                newTrajectories[currentUser.$id] = [...newTrajectories[currentUser.$id], pos];
              }
            }
            return newTrajectories;
          });
        } catch (error) {
          console.error("Erreur lors de la mise à jour de la position:", error);
        }
      },
      (error) => {
        console.error("Erreur géolocalisation:", error);
      },
      { enableHighAccuracy: true }
    );
  };

  // Mise à jour automatique de la position toutes les 30 secondes
  useEffect(() => {
    if (currentUser) {
      updatePosition(); // mise à jour initiale
      const interval = setInterval(updatePosition, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Récupérer les utilisateurs et mettre à jour leurs trajectoires
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID
        );
        // Garder uniquement les utilisateurs ayant une localisation
        const usersWithLocation = response.documents.filter(
          user => user.latitude && user.longitude
        );
        setUsers(usersWithLocation);
        // Mettre à jour localement les trajectoires pour chaque utilisateur
        setTrajectories(prev => {
          const newTrajectories = { ...prev };
          usersWithLocation.forEach(user => {
            const pos = [user.latitude, user.longitude];
            if (!newTrajectories[user.$id]) {
              newTrajectories[user.$id] = [pos];
            } else {
              const lastPos = newTrajectories[user.$id][newTrajectories[user.$id].length - 1];
              if (lastPos[0] !== user.latitude || lastPos[1] !== user.longitude) {
                newTrajectories[user.$id] = [...newTrajectories[user.$id], pos];
              }
            }
          });
          return newTrajectories;
        });
      } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
      }
    };
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtrer les utilisateurs selon la recherche et le statut "en ligne"
  const filteredUsers = users.filter(user => {
    const name = user.name || '';
    const isOnline = (new Date() - new Date(user.timestamp || user.$createdAt)) < 5 * 60 * 1000;
    return name.toLowerCase().includes(searchQuery.toLowerCase()) && isOnline;
  });

  const toggleUserPopup = (userId) => {
    setOpenPopupId(openPopupId === userId ? null : userId);
  };

  const toggleUsersPanel = () => {
    setShowUsersPanel(!showUsersPanel);
  };

  return (
    <>
      {/* Bouton d'affichage/masquage du panneau des utilisateurs */}
      <UserButton onClick={toggleUsersPanel}>
        <MdGroup size={18} />
        {showUsersPanel ? 'Masquer les utilisateurs' : 'Afficher les utilisateurs'}
      </UserButton>

      {/* Panneau latéral avec barre de recherche et liste des utilisateurs */}
      <UsersPanel visible={showUsersPanel}>
        <PopupHeader>
          <h3>Utilisateurs ({filteredUsers.length})</h3>
          <CloseButton onClick={() => setShowUsersPanel(false)}>
            <MdClose size={20} />
          </CloseButton>
        </PopupHeader>

        {/* Barre de recherche */}
        <SearchInput 
          type="text" 
          placeholder="Rechercher un utilisateur…" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Bouton pour mettre à jour manuellement la position */}
        {currentUser && (
          <RefreshButton onClick={updatePosition}>
            Mettre à jour ma position
          </RefreshButton>
        )}

        {filteredUsers.length === 0 ? (
          <p>Aucun utilisateur en ligne trouvé</p>
        ) : (
          filteredUsers.map(user => (
            <div key={user.$id} style={{ marginBottom: '10px', padding: '5px', borderBottom: '1px solid #eee' }}>
              <UserInfo>
                <MdPerson size={16} color={getUserIconColor(user)} />
                <span>{user.name || 'Utilisateur sans nom'}</span>
              </UserInfo>
              {user.phone && (
                <UserInfo>
                  <MdPhone size={16} color="#0074D9" />
                  <span>{user.phone}</span>
                </UserInfo>
              )}
              <button 
                onClick={() => toggleUserPopup(user.$id)}
                style={{ 
                  border: 'none', 
                  background: '#f0f0f0', 
                  padding: '5px 10px', 
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
              >
                Voir sur la carte
              </button>
            </div>
          ))
        )}
      </UsersPanel>

      {/* Affichage des marqueurs, trajets et positions historiques avec avatar */}
      {users.map(user => {
        const color = getUserIconColor(user);
        const icon = createUserIcon(color);
        return (
          <React.Fragment key={user.$id}>
            {/* Marqueur pour la position actuelle */}
            <Marker
              position={[user.latitude, user.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => toggleUserPopup(user.$id)
              }}
            >
              <Popup autoPan={true} closeButton={false} open={openPopupId === user.$id}>
                <div>
                  <PopupHeader>
                    <h3>{user.name || 'Utilisateur'}</h3>
                    <CloseButton onClick={() => setOpenPopupId(null)}>
                      <MdClose size={20} />
                    </CloseButton>
                  </PopupHeader>
                  <UserInfo>
                    <MdPerson size={16} color={color} />
                    <span>Nom: {user.name || 'Non renseigné'}</span>
                  </UserInfo>
                  {user.phone && (
                    <UserInfo>
                      <MdPhone size={16} color="#0074D9" />
                      <span>Téléphone: {user.phone}</span>
                    </UserInfo>
                  )}
                  {user.email && (
                    <UserInfo>
                      <MdEmail size={16} color="#2ECC40" />
                      <span>Email: {user.email}</span>
                    </UserInfo>
                  )}
                  <p>Dernière position: {new Date(user.timestamp || user.$createdAt).toLocaleString()}</p>
                </div>
              </Popup>
            </Marker>

            {/* Polyline pour tracer la trajectoire */}
            {trajectories[user.$id] && trajectories[user.$id].length > 1 && (
              <Polyline positions={trajectories[user.$id]} color={color} />
            )}

            {/* Marqueurs pour chaque position historique (sauf la dernière, déjà affichée) */}
            {trajectories[user.$id] && trajectories[user.$id].map((pos, idx) => {
              if (idx === trajectories[user.$id].length - 1) return null;
              const avatarIcon = createAvatarIcon(user.avatar, user.name || 'Utilisateur', color);
              return (
                <Marker key={`${user.$id}-historique-${idx}`} position={pos} icon={avatarIcon} />
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default UsersMap;
