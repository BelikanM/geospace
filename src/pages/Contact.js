import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import styled from 'styled-components';
import { 
  MdPerson, MdPhone, MdClose, MdEmail, MdGroup, MdDelete, MdEdit, 
  MdSave, MdCancel, MdBlock, MdLock, MdCheck, MdPersonAdd, 
  MdVerifiedUser, MdWarning, MdAccessTime, MdRefresh
} from 'react-icons/md';
import { FcGoogle } from 'react-icons/fc';
import { databases, DATABASE_ID, account } from './appwrite';
import { ID, Query, Permission, Role } from 'appwrite';

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

const ProfileButton = styled.button`
  position: absolute;
  top: 80px;
  left: 10px;
  z-index: 1000;
  background-color: #4CAF50;
  color: white;
  border: 1px solid #3e8e41;
  border-radius: 5px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  &:hover {
    background-color: #3e8e41;
  }
`;

const SignInButton = styled.button`
  position: absolute;
  top: 30px;
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
  ${props => props.disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      opacity: 0.5;
    }
  `}
`;

const UserActions = styled.div`
  display: flex;
  margin-top: 5px;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 5px;
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

const UserStatus = styled.span`
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 12px;
  margin-left: 5px;
  background-color: ${props => props.blocked ? '#f44336' : '#4CAF50'};
  color: white;
`;

const TabContainer = styled.div`
  margin-bottom: 15px;
`;

const TabButton = styled.button`
  padding: 8px 15px;
  border: none;
  background-color: ${props => props.active ? '#4CAF50' : '#f0f0f0'};
  color: ${props => props.active ? 'white' : 'black'};
  cursor: pointer;
  border-radius: 3px;
  margin-right: 5px;
  
  &:hover {
    background-color: ${props => props.active ? '#3e8e41' : '#e0e0e0'};
  }
`;

const UserCard = styled.div`
  background-color: #f5f5f5;
  border-radius: 5px;
  padding: 12px;
  margin-bottom: 10px;
  border-left: 4px solid ${props => props.blocked ? '#f44336' : '#4CAF50'};
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 3px;
`;

const ProfilePanel = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1010;
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 0 15px rgba(0,0,0,0.3);
  max-width: 450px;
  width: 90%;
  display: ${props => props.visible ? 'block' : 'none'};
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  z-index: 1005;
  display: ${props => props.visible ? 'block' : 'none'};
`;

const ErrorMessage = styled.div`
  color: #f44336;
  font-size: 12px;
  margin-top: 5px;
`;

const SuccessMessage = styled.div`
  color: #4CAF50;
  font-size: 14px;
  margin: 10px 0;
  padding: 5px;
  background-color: #e8f5e9;
  border-radius: 3px;
  text-align: center;
`;

// Création d'une icône personnalisée pour les utilisateurs
const createUserIcon = (color = "#FF4136", blocked = false) => {
  const iconHtml = renderToString(
    <div style={{ 
      background: 'white', 
      borderRadius: '50%', 
      padding: '5px', 
      boxShadow: '0 0 5px rgba(0,0,0,0.3)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative'
    }}>
      <MdPerson size={24} color={blocked ? "#888" : color} />
      {blocked && (
        <div style={{
          position: 'absolute',
          top: -3,
          right: -3,
          background: '#f44336',
          borderRadius: '50%',
          width: '14px',
          height: '14px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <MdBlock size={10} color="white" />
        </div>
      )}
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
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [openPopupId, setOpenPopupId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Vérifier si l'utilisateur courant est l'administrateur
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await account.get();
        setCurrentUser(user);
        setIsLoggedIn(true);
        // Vérifier si c'est un admin (soit par email ou par un champ role dans la base)
        setIsAdmin(user.email === 'nyundumathryme@gmail.com');
        
        // Récupérer les informations supplémentaires de l'utilisateur depuis la base de données
        try {
          const response = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.equal('userId', user.$id)]
          );
          
          if (response.documents.length > 0) {
            const userDoc = response.documents[0];
            // Mettre à jour l'objet currentUser avec les infos supplémentaires
            setCurrentUser(prevUser => ({
              ...prevUser,
              name: userDoc.name || prevUser.name,
              phone: userDoc.phone || '',
              blocked: userDoc.blocked || false,
              profileCompleted: userDoc.profileCompleted || false
            }));
            
            // Si l'utilisateur est bloqué, on le déconnecte
            if (userDoc.blocked) {
              alert('Votre compte a été bloqué. Veuillez contacter l\'administrateur.');
              handleLogout();
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des infos utilisateur:', error);
        }
      } catch (error) {
        console.error('Utilisateur non connecté:', error);
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
    };

    checkSession();
  }, []);

  // Récupérer les utilisateurs de la collection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID
        );
        
        const usersWithLocation = response.documents.filter(
          user => user.latitude && user.longitude
        );
        
        setUsers(usersWithLocation);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        setLoading(false);
      }
    };

    fetchUsers();
    
    // Rafraîchir la liste des utilisateurs toutes les 30 secondes
    const interval = setInterval(fetchUsers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Filtrer les utilisateurs en fonction de l'onglet actif et du terme de recherche
  const filteredUsers = users.filter(user => {
    // Filtrer par statut (bloqué/actif)
    if (activeTab === 'blocked' && !user.blocked) return false;
    if (activeTab === 'active' && user.blocked) return false;
    
    // Filtrer par terme de recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (user.name && user.name.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.phone && user.phone.toLowerCase().includes(term))
      );
    }
    
    return true;
  });

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

  const toggleProfilePanel = () => {
    if (isLoggedIn) {
      setShowProfilePanel(!showProfilePanel);
      // Réinitialiser les formulaires
      if (!showProfilePanel) {
        setEditFormData({
          name: currentUser.name || '',
          email: currentUser.email || '',
          phone: currentUser.phone || ''
        });
        setPasswordFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setChangingPassword(false);
        setPasswordErrors({});
        setSuccessMessage('');
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!isAdmin) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        await databases.deleteDocument(DATABASE_ID, USERS_COLLECTION_ID, userId);
        setUsers(users.filter(user => user.$id !== userId));
        setOpenPopupId(null); // Fermer le popup si ouvert
        alert('Utilisateur supprimé avec succès');
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'utilisateur');
      }
    }
  };

  const handleBlockUser = async (userId, currentStatus) => {
    if (!isAdmin) return;
    
    const action = currentStatus ? 'débloquer' : 'bloquer';
    if (window.confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
      try {
        await databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          userId,
          { blocked: !currentStatus }
        );
        
        // Mettre à jour l'état local
        setUsers(users.map(user => 
          user.$id === userId 
            ? { ...user, blocked: !currentStatus }
            : user
        ));
        
        alert(`Utilisateur ${action} avec succès`);
      } catch (error) {
        console.error(`Erreur lors du ${action}:`, error);
        alert(`Erreur lors du ${action} de l'utilisateur`);
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
    setChangingPassword(false);
    setPasswordErrors({});
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setChangingPassword(false);
    setPasswordErrors({});
    setSuccessMessage('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Réinitialiser les erreurs pour ce champ
    setPasswordErrors(prev => ({
      ...prev,
      [name]: null
    }));
  };

  const validatePasswordForm = () => {
    const errors = {};
    
    if (!passwordFormData.currentPassword) {
      errors.currentPassword = 'Mot de passe actuel requis';
    }
    
    if (!passwordFormData.newPassword) {
      errors.newPassword = 'Nouveau mot de passe requis';
    } else if (passwordFormData.newPassword.length < 8) {
      errors.newPassword = 'Le nouveau mot de passe doit contenir au moins 8 caractères';
    }
    
    if (!passwordFormData.confirmPassword) {
      errors.confirmPassword = 'Confirmation requise';
    } else if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    return errors;
  };

  const handleChangePassword = async (userId) => {
    // Valider le formulaire
    const errors = validatePasswordForm();
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    try {
      // Pour l'utilisateur courant, utiliser l'API Appwrite pour changer le mot de passe
      if (userId === currentUser.$id) {
        await account.updatePassword(
          passwordFormData.newPassword,
          passwordFormData.currentPassword
        );
      } else if (isAdmin) {
        // Pour d'autres utilisateurs (admin uniquement), utiliser une fonction personnalisée
        // Ceci est une simulation car Appwrite ne permet pas directement à un admin de changer 
        // le mot de passe d'un autre utilisateur sans Cloud Functions
        
        // En réalité, vous devriez implémenter une fonction cloud pour gérer cela
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Mot de passe modifié pour l'utilisateur ${userId}`);
      }
      
      // Réinitialiser le formulaire
      setPasswordFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setSuccessMessage('Mot de passe modifié avec succès');
      setChangingPassword(false);
      setPasswordErrors({});
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      setPasswordErrors({
        general: error.message || 'Erreur lors du changement de mot de passe'
      });
    }
  };

  const handleSaveUser = async (userId) => {
    try {
      const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        profileCompleted: true
      };
      
      await databases.updateDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        userId,
        updateData
      );
      
      // Mettre à jour l'état local
      setUsers(users.map(user => 
        user.$id === userId 
          ? { ...user, ...updateData }
          : user
      ));
      
      // Si c'est l'utilisateur courant, mettre à jour ses informations
      if (currentUser && userId === currentUser.$id) {
        setCurrentUser(prev => ({
          ...prev,
          ...updateData
        }));
      }
      
      setEditingUser(null);
      setSuccessMessage('Profil mis à jour avec succès');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour de l\'utilisateur');
    }
  };

  const handleSaveCurrentUserProfile = async () => {
    try {
      // Vérifier si l'utilisateur existe déjà dans la base de données
      const response = await databases.listDocuments(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        [Query.equal('userId', currentUser.$id)]
      );
      
      const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        userId: currentUser.$id,
        profileCompleted: true
      };
      
      if (response.documents.length > 0) {
        // Mettre à jour le document existant
        await databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          response.documents[0].$id,
          updateData
        );
      } else {
        // Créer un nouveau document
        await databases.createDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          ID.unique(),
          {
            ...updateData,
            latitude: 0,  // Valeurs par défaut
            longitude: 0
          },
          [
            Permission.read(Role.any()),
            Permission.update(Role.user(currentUser.$id)),
            Permission.delete(Role.user(currentUser.$id))
          ]
        );
      }
      
      // Mettre à jour l'utilisateur courant
      setCurrentUser(prev => ({
        ...prev,
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        profileCompleted: true
      }));
      
      setSuccessMessage('Profil mis à jour avec succès');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      alert('Erreur lors de la mise à jour du profil');
    }
  };

  // Gestion de la connexion Google
  const handleGoogleSignIn = () => {
    // Initialiser l'API Google Sign-In (ce code suppose que vous avez déjà chargé la bibliothèque Google)
    if (window.gapi) {
      window.gapi.load('auth2', function() {
        window.gapi.auth2.init({
          client_id: 'VOTRE_CLIENT_ID.apps.googleusercontent.com'
        }).then(function(auth2) {
          auth2.signIn().then(function(googleUser) {
            const profile = googleUser.getBasicProfile();
            const id_token = googleUser.getAuthResponse().id_token;
            
            // Ici, vous devriez utiliser Appwrite pour créer une session OAuth
            // En production, cette partie serait gérée par Appwrite en utilisant account.createOAuth2Session
            console.log('Google Sign-In successful', profile.getName());
            
            // Simulation de connexion réussie
            setIsLoggedIn(true);
            setCurrentUser({
              $id: 'google-' + profile.getId(),
              name: profile.getName(),
              email: profile.getEmail(),
              profilePic: profile.getImageUrl()
            });
          });
        });
      });
    } else {
      alert('L\'API Google n\'est pas chargée. Vérifiez votre configuration.');
    }
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession('current');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setIsAdmin(false);
      // Fermer tous les panneaux
      setShowProfilePanel(false);
      setShowAdminPanel(false);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const refreshUsersList = async () => {
    try {
      setLoading(true);
      const response = await databases.listDocuments(
        DATABASE_ID,
        USERS_COLLECTION_ID
      );
      
      const usersWithLocation = response.documents.filter(
        user => user.latitude && user.longitude
      );
      
      setUsers(usersWithLocation);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement de la liste:', error);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bouton de connexion/profil utilisateur connecté */}
      {isLoggedIn ? (
        <ProfileButton onClick={toggleProfilePanel}>
          <MdPerson size={18} />
          {currentUser?.name || 'Mon profil'}
        </ProfileButton>
      ) : (
        <SignInButton onClick={handleGoogleSignIn}>
          <FcGoogle size={18} />
          Se connecter avec Google
        </SignInButton>
      )}
      
      {/* Bouton pour afficher/masquer le panneau des utilisateurs */}
      <UserButton onClick={toggleUsersPanel} disabled={!isLoggedIn}>
        <MdGroup size={18} />
        {showUsersPanel ? 'Masquer les utilisateurs' : 'Afficher les utilisateurs'}
      </UserButton>
      
      {/* Bouton Admin - visible uniquement pour l'administrateur */}
      {isAdmin && (
        <AdminButton onClick={toggleAdminPanel}>
          <MdVerifiedUser size={18} />
          {showAdminPanel ? 'Masquer panel admin' : 'Panel administration'}
        </AdminButton>
      )}
      
      {/* Overlay pour les modales */}
      <Overlay visible={showProfilePanel} onClick={toggleProfilePanel} />
      
      {/* Panneau de profil utilisateur */}
      <ProfilePanel visible={showProfilePanel} onClick={e => e.stopPropagation()}>
        <PopupHeader>
          <h3>{isAdmin ? 'Profil Administrateur' : 'Mon Profil'}</h3>
          <CloseButton onClick={toggleProfilePanel}>
            <MdClose size={20} />
          </CloseButton>
        </PopupHeader>
        
        {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}
        
        {!changingPassword ? (
          <>
            <EditForm>
              <FormField>
                <label>Nom:</label>
                <Input 
                  type="text" 
                  name="name" 
                  value={editFormData.name} 
                  onChange={handleInputChange} 
                  placeholder="Votre nom"
                />
              </FormField>
              <FormField>
                <label>Email:</label>
                <Input 
                  type="email" 
                  name="email" 
                  value={editFormData.email}
                  onChange={handleInputChange}
                  placeholder="Votre email" 
                  disabled={true} // Email souvent non modifiable avec auth Google
                />
              </FormField>
              <FormField>
                <label>Téléphone:</label>
                <Input 
                  type="tel" 
                  name="phone" 
                  value={editFormData.phone} 
                  onChange={handleInputChange}
                  placeholder="Votre numéro de téléphone" 
                />
              </FormField>
              <FormActions>
                <ActionButton 
                  onClick={() => setChangingPassword(true)}
                  color="#2196F3"
                  textColor="white"
                >
                  <MdLock size={16} /> Changer mot de passe
                </ActionButton>
                <ActionButton 
                  onClick={handleSaveCurrentUserProfile}
                  color="#4CAF50"
                  textColor="white"
                >
                  <MdSave size={16} /> Enregistrer
                </ActionButton>
              </FormActions>
            </EditForm>
            
            <hr style={{ margin: '20px 0' }} />
            
            <ActionButton 
              onClick={handleLogout}
              color="#f44336"
              textColor="white"
              style={{ width: '100%' }}
            >
              <MdClose size={16} /> Se déconnecter
            </ActionButton>
          </>
        ) : (
          <>
                        <EditForm>
              <FormField>
                <label>Mot de passe actuel:</label>
                <Input 
                  type="password" 
                  name="currentPassword" 
                  value={passwordFormData.currentPassword} 
                  onChange={handlePasswordInputChange} 
                  placeholder="Mot de passe actuel"
                />
                {passwordErrors.currentPassword && (
                  <ErrorMessage>{passwordErrors.currentPassword}</ErrorMessage>
                )}
              </FormField>
              <FormField>
                <label>Nouveau mot de passe:</label>
                <Input 
                  type="password" 
                  name="newPassword" 
                  value={passwordFormData.newPassword} 
                  onChange={handlePasswordInputChange} 
                  placeholder="Nouveau mot de passe"
                />
                {passwordErrors.newPassword && (
                  <ErrorMessage>{passwordErrors.newPassword}</ErrorMessage>
                )}
              </FormField>
              <FormField>
                <label>Confirmer le nouveau mot de passe:</label>
                <Input 
                  type="password" 
                  name="confirmPassword" 
                  value={passwordFormData.confirmPassword} 
                  onChange={handlePasswordInputChange} 
                  placeholder="Confirmer le mot de passe"
                />
                {passwordErrors.confirmPassword && (
                  <ErrorMessage>{passwordErrors.confirmPassword}</ErrorMessage>
                )}
              </FormField>
              {passwordErrors.general && (
                <ErrorMessage>{passwordErrors.general}</ErrorMessage>
              )}
              <FormActions>
                <ActionButton 
                  onClick={() => setChangingPassword(false)}
                  color="#f44336"
                  textColor="white"
                >
                  <MdCancel size={16} /> Annuler
                </ActionButton>
                <ActionButton 
                  onClick={() => handleChangePassword(currentUser.$id)}
                  color="#4CAF50"
                  textColor="white"
                >
                  <MdSave size={16} /> Enregistrer mot de passe
                </ActionButton>
              </FormActions>
            </EditForm>
          </>
        )}
      </ProfilePanel>
      
      {/* Panneau d'affichage standard des utilisateurs */}
      <UsersPanel visible={showUsersPanel}>
        <PopupHeader>
          <h3>Liste des utilisateurs ({filteredUsers.length})</h3>
          <CloseButton onClick={() => setShowUsersPanel(false)}>
            <MdClose size={20} />
          </CloseButton>
        </PopupHeader>
        
        <SearchInput 
          type="text" 
          placeholder="Rechercher un utilisateur..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
        
        <TabContainer>
          <TabButton 
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
          >
            Tous
          </TabButton>
          <TabButton 
            active={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
          >
            Actifs
          </TabButton>
          <TabButton 
            active={activeTab === 'blocked'}
            onClick={() => setActiveTab('blocked')}
          >
            Bloqués
          </TabButton>
        </TabContainer>
        
        {filteredUsers.length === 0 ? (
          <p>Aucun utilisateur trouvé</p>
        ) : (
          filteredUsers.map(user => (
            <UserCard key={user.$id} blocked={user.blocked}>
              <UserInfo>
                <MdPerson size={16} color={user.blocked ? "#888" : "#FF4136"} />
                <span>{user.name || 'Utilisateur sans nom'}</span>
              </UserInfo>
              <UserInfo>
                <MdEmail size={16} color="#2ECC40" />
                <span>{user.email || 'Non renseigné'}</span>
              </UserInfo>
              <UserInfo>
                <MdPhone size={16} color="#0074D9" />
                <span>{user.phone || 'Non renseigné'}</span>
              </UserInfo>
              
              <UserActions>
                {!user.blocked ? (
                  <UserStatus blocked={false}>Actif</UserStatus>
                ) : (
                  <UserStatus blocked={true}>Bloqué</UserStatus>
                )}
                
                <ActionButton 
                  onClick={() => toggleUserPopup(user.$id)}
                  color="#0074D9"
                  textColor="white"
                >
                  <MdAccessTime size={16} /> Voir sur carte
                </ActionButton>
                
                {isAdmin && (
                  <>
                    <ActionButton 
                      onClick={() => handleEditClick(user)}
                      color="#2196F3"
                      textColor="white"
                    >
                      <MdEdit size={16} /> Modifier
                    </ActionButton>
                    <ActionButton 
                      onClick={() => handleBlockUser(user.$id, user.blocked)}
                      color={user.blocked ? "#4CAF50" : "#f44336"}
                      textColor="white"
                    >
                      {user.blocked ? (
                        <>
                          <MdCheck size={16} /> Débloquer
                        </>
                      ) : (
                        <>
                          <MdBlock size={16} /> Bloquer
                        </>
                      )}
                    </ActionButton>
                    <ActionButton 
                      onClick={() => handleDeleteUser(user.$id)}
                      color="#f44336"
                      textColor="white"
                    >
                      <MdDelete size={16} /> Supprimer
                    </ActionButton>
                  </>
                )}
              </UserActions>
            </UserCard>
          ))
        )}
      </UsersPanel>
      
      {/* Panneau d'administration pour l'administrateur */}
      {isAdmin && (
        <UsersPanel visible={showAdminPanel}>
          <PopupHeader>
            <h3>Panel d'administration</h3>
            <ActionButton onClick={refreshUsersList} color="#4CAF50">
              <MdRefresh size={16} /> Rafraîchir utilisateur
            </ActionButton>
            <CloseButton onClick={() => setShowAdminPanel(false)}>
              <MdClose size={20} />
            </CloseButton>
          </PopupHeader>
          
          <SearchInput 
            type="text" 
            placeholder="Rechercher un utilisateur..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          
          {filteredUsers.length === 0 ? (
            <p>Aucun utilisateur trouvé dans cette catégorie.</p>
          ) : (
            filteredUsers.map(user => (
              <UserCard key={user.$id} blocked={user.blocked}>
                <UserInfo>
                  <MdPerson size={16} color={user.blocked ? "#888" : "#FF4136"} />
                  <span>{user.name || 'Utilisateur sans nom'}</span>
                </UserInfo>
                <UserInfo>
                  <MdEmail size={16} color="#2ECC40" />
                  <span>{user.email || 'Non renseigné'}</span>
                </UserInfo>
                <UserInfo>
                  <MdPhone size={16} color="#0074D9" />
                  <span>{user.phone || 'Non renseigné'}</span>
                </UserInfo>
                
                <UserActions>
                  <UserStatus blocked={user.blocked}>
                    {user.blocked ? 'Bloqué' : 'Actif'}
                  </UserStatus>
                  
                  <ActionButton 
                    onClick={() => handleEditClick(user)}
                    color="#2196F3"
                    textColor="white"
                  >
                    <MdEdit size={16} /> Modifier
                  </ActionButton>
                  
                  <ActionButton 
                    onClick={() => handleBlockUser(user.$id, user.blocked)}
                    color={user.blocked ? "#4CAF50" : "#f44336"}
                    textColor="white"
                  >
                    {user.blocked ? (
                      <>
                        <MdCheck size={16} /> Débloquer
                      </>
                    ) : (
                      <>
                        <MdBlock size={16} /> Bloquer
                      </>
                    )}
                  </ActionButton>
                  
                  <ActionButton 
                    onClick={() => handleDeleteUser(user.$id)}
                    color="#f44336"
                    textColor="white"
                  >
                    <MdDelete size={16} /> Supprimer
                  </ActionButton>
                </UserActions>
              </UserCard>
            ))
          )}
        </UsersPanel>
      )}
    </>
  );
};

export default AdminUsersMap;

