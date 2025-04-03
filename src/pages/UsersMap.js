import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import { MdPerson, MdPhone, MdClose, MdEmail, MdGroup } from 'react-icons/md';
import { databases, DATABASE_ID } from './appwrite';

// Styles pour le composant
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

// Création d'une icône personnalisée pour les utilisateurs
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

// Collection pour les utilisateurs (à configurer dans Appwrite)
const USERS_COLLECTION_ID = '67ec0ff5002cafd109d7'; // À remplacer par votre collection ID

const UsersMap = () => {
  const [users, setUsers] = useState([]);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [openPopupId, setOpenPopupId] = useState(null);
  const userIcon = createUserIcon();

  // Récupérer tous les utilisateurs depuis Appwrite
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID
        );
        
        // Filtrer les utilisateurs qui ont des coordonnées géographiques
        const usersWithLocation = response.documents.filter(
          user => user.latitude && user.longitude
        );
        
        setUsers(usersWithLocation);
      } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
      }
    };

    fetchUsers();
    
    // Rafraîchir la liste des utilisateurs toutes les 30 secondes
    const interval = setInterval(fetchUsers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const toggleUserPopup = (userId) => {
    if (openPopupId === userId) {
      setOpenPopupId(null);
    } else {
      setOpenPopupId(userId);
    }
  };

  const toggleUsersPanel = () => {
    setShowUsersPanel(!showUsersPanel);
  };

  return (
    <>
      {/* Bouton pour afficher/masquer le panneau des utilisateurs */}
      <UserButton onClick={toggleUsersPanel}>
        <MdGroup size={18} />
        {showUsersPanel ? 'Masquer les utilisateurs' : 'Afficher les utilisateurs'}
      </UserButton>
      
      {/* Panneau d'affichage de la liste des utilisateurs */}
      <UsersPanel visible={showUsersPanel}>
        <PopupHeader>
          <h3>Utilisateurs inscrits</h3>
          <CloseButton onClick={() => setShowUsersPanel(false)}>
            <MdClose size={20} />
          </CloseButton>
        </PopupHeader>
        
        {users.length === 0 ? (
          <p>Aucun utilisateur trouvé</p>
        ) : (
          users.map(user => (
            <div key={user.$id} style={{ marginBottom: '10px', padding: '5px', borderBottom: '1px solid #eee' }}>
              <UserInfo>
                <MdPerson size={16} color="#FF4136" />
                <span>{user.name}</span>
              </UserInfo>
              <UserInfo>
                <MdPhone size={16} color="#0074D9" />
                <span>{user.phone || 'Non renseigné'}</span>
              </UserInfo>
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
      
      {/* Marqueurs pour chaque utilisateur sur la carte */}
      {users.map(user => (
        <Marker
          key={user.$id}
          position={[user.latitude, user.longitude]}
          icon={userIcon}
          eventHandlers={{
            click: () => toggleUserPopup(user.$id)
          }}
        >
          <Popup
            autoPan={true}
            closeButton={false}
            open={openPopupId === user.$id}
          >
            <div>
              <PopupHeader>
                <h3>{user.name}</h3>
                <CloseButton onClick={() => setOpenPopupId(null)}>
                  <MdClose size={20} />
                </CloseButton>
              </PopupHeader>
              <UserInfo>
                <MdPerson size={16} color="#FF4136" />
                <span>Nom: {user.name}</span>
              </UserInfo>
              <UserInfo>
                <MdPhone size={16} color="#0074D9" />
                <span>Téléphone: {user.phone || 'Non renseigné'}</span>
              </UserInfo>
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
      ))}
    </>
  );
};

export default UsersMap;


