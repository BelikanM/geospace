import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import { MdPerson, MdPhone, MdClose, MdEmail, MdGroup, MdDelete, MdEdit, MdSave, MdCancel } from 'react-icons/md';
import { databases, DATABASE_ID, account } from './appwrite';
import { ID, Query } from 'appwrite';

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

const AdminButton = styled.button`
  position: absolute;
  top: 180px;
  left: 10px;
  z-index: 1000;
  background-color: #ff9800;
  color: white;
  border: 1px solid #e68a00;
  border-radius: 5px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  &:hover {
    background-color: #e68a00;
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
  max-width: 350px;
  max-height: 80vh;
  overflow-y: auto;
  display: ${props => props.visible ? 'block' : 'none'};
`;

const ActionButton = styled.button`
  background-color: ${props => props.color || '#f0f0f0'};
  color: ${props => props.textColor || 'black'};
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  margin-left: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  &:hover {
    opacity: 0.8;
  }
`;

const UserActions = styled.div`
  display: flex;
  margin-top: 5px;
  justify-content: flex-end;
`;

const EditForm = styled.div`
  margin-top: 10px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 5px;
`;

const FormField = styled.div`
  margin-bottom: 10px;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
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

// ID de la collection utilisateurs
const USERS_COLLECTION_ID = '67ec0ff5002cafd109d7';

const AdminUsersMap = () => {
  const [users, setUsers] = useState([]);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [openPopupId, setOpenPopupId] = useState(null);
  const userIcon = createUserIcon();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  // Vérifier si l'utilisateur courant est l'administrateur
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const user = await account.get();
        setCurrentUser(user);
        setIsAdmin(user.email === 'nyundumathryme@gmail.com');
      } catch (error) {
        console.error('Utilisateur non connecté:', error);
      }
    };

    getCurrentUser();
  }, []);

  // Récupérer les utilisateurs de la collection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID
        );
        
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
    if (showAdminPanel) setShowAdminPanel(false);
  };

  const toggleAdminPanel = () => {
    if (isAdmin) {
      setShowAdminPanel(!showAdminPanel);
      if (showUsersPanel) setShowUsersPanel(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!isAdmin) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        await databases.deleteDocument(DATABASE_ID, USERS_COLLECTION_ID, userId);
        setUsers(users.filter(user => user.$id !== userId));
        alert('Utilisateur supprimé avec succès');
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'utilisateur');
      }
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user.$id);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveUser = async (userId) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        userId,
        {
          name: editFormData.name,
          email: editFormData.email,
          phone: editFormData.phone
        }
      );
      
      // Mettre à jour l'état local
      setUsers(users.map(user => 
        user.$id === userId 
          ? { ...user, name: editFormData.name, email: editFormData.email, phone: editFormData.phone }
          : user
      ));
      
      setEditingUser(null);
      alert('Utilisateur mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour de l\'utilisateur');
    }
  };

  return (
    <>
      {/* Bouton pour afficher/masquer le panneau des utilisateurs */}
      <UserButton onClick={toggleUsersPanel}>
        <MdGroup size={18} />
        {showUsersPanel ? 'Masquer les utilisateurs' : 'Afficher les utilisateurs'}
      </UserButton>
      
      {/* Bouton Admin - visible uniquement pour l'administrateur */}
      {isAdmin && (
        <AdminButton onClick={toggleAdminPanel}>
          <MdPerson size={18} />
          {showAdminPanel ? 'Masquer panel admin' : 'Panel administration'}
        </AdminButton>
      )}
      
      {/* Panneau d'affichage standard des utilisateurs */}
      <UsersPanel visible={showUsersPanel}>
        <PopupHeader>
          <h3>Utilisateurs ({users.length})</h3>
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
      
      {/* Panneau d'administration - visible uniquement pour l'administrateur */}
      <UsersPanel visible={showAdminPanel}>
        <PopupHeader>
          <h3>Administration des utilisateurs ({users.length})</h3>
          <CloseButton onClick={() => setShowAdminPanel(false)}>
            <MdClose size={20} />
          </CloseButton>
        </PopupHeader>
        
        {users.length === 0 ? (
          <p>Aucun utilisateur trouvé</p>
        ) : (
          users.map(user => (
            <div key={user.$id} style={{ marginBottom: '15px', padding: '10px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              {editingUser === user.$id ? (
                <EditForm>
                  <FormField>
                    <label>Nom:</label>
                    <Input 
                      type="text" 
                      name="name" 
                      value={editFormData.name} 
                      onChange={handleInputChange} 
                    />
                  </FormField>
                  <FormField>
                    <label>Email:</label>
                    <Input 
                      type="email" 
                      name="email" 
                      value={editFormData.email} 
                      onChange={handleInputChange} 
                    />
                  </FormField>
                  <FormField>
                    <label>Téléphone:</label>
                    <Input 
                      type="tel" 
                      name="phone" 
                      value={editFormData.phone} 
                      onChange={handleInputChange} 
                    />
                  </FormField>
                  <FormActions>
                    <ActionButton 
                      onClick={() => handleCancelEdit()}
                      color="#f44336"
                      textColor="white"
                    >
                      <MdCancel size={16} /> Annuler
                    </ActionButton>
                    <ActionButton 
                      onClick={() => handleSaveUser(user.$id)}
                      color="#4CAF50"
                      textColor="white"
                    >
                      <MdSave size={16} /> Enregistrer
                    </ActionButton>
                  </FormActions>
                </EditForm>
              ) : (
                <>
                  <UserInfo>
                    <MdPerson size={16} color="#FF4136" />
                    <span><strong>Nom:</strong> {user.name || 'Non renseigné'}</span>
                  </UserInfo>
                  <UserInfo>
                    <MdEmail size={16} color="#2ECC40" />
                    <span><strong>Email:</strong> {user.email || 'Non renseigné'}</span>
                  </UserInfo>
                  <UserInfo>
                    <MdPhone size={16} color="#0074D9" />
                    <span><strong>Téléphone:</strong> {user.phone || 'Non renseigné'}</span>
                  </UserInfo>
                  <p><strong>Dernière position:</strong> {new Date(user.timestamp || user.$createdAt).toLocaleString()}</p>
                  <p><strong>Coordonnées:</strong> {user.latitude}, {user.longitude}</p>
                  
                  <UserActions>
                    <ActionButton 
                      onClick={() => toggleUserPopup(user.$id)}
                    >
                      Voir sur carte
                    </ActionButton>
                    <ActionButton 
                      onClick={() => handleEditClick(user)}
                      color="#2196F3"
                      textColor="white"
                    >
                      <MdEdit size={16} /> Modifier
                    </ActionButton>
                    <ActionButton 
                      onClick={() => handleDeleteUser(user.$id)}
                      color="#f44336"
                      textColor="white"
                    >
                      <MdDelete size={16} /> Supprimer
                    </ActionButton>
                  </UserActions>
                </>
              )}
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
                <h3>{user.name || 'Utilisateur'}</h3>
                <CloseButton onClick={() => setOpenPopupId(null)}>
                  <MdClose size={20} />
                </CloseButton>
              </PopupHeader>
              <UserInfo>
                <MdPerson size={16} color="#FF4136" />
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
              
              {/* Actions d'administration dans le popup (visible uniquement pour l'admin) */}
              {isAdmin && (
                <UserActions>
                  <ActionButton 
                    onClick={() => handleEditClick(user)}
                    color="#2196F3"
                    textColor="white"
                  >
                    <MdEdit size={16} /> Modifier
                  </ActionButton>
                  <ActionButton 
                    onClick={() => handleDeleteUser(user.$id)}
                    color="#f44336"
                    textColor="white"
                  >
                    <MdDelete size={16} /> Supprimer
                  </ActionButton>
                </UserActions>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default AdminUsersMap;


