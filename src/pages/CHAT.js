import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Button, TextField, Avatar, IconButton, Box, Typography, Paper, 
  List, ListItem, ListItemAvatar, ListItemText, Drawer, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Tooltip, Badge, Grid, Card, CardContent, Tabs, Tab, InputBase, Chip
} from '@mui/material';
import {
  Search, Send, Mic, Photo, AttachFile, Close, EmojiEmotions,
  ArrowBack, MoreVert, Place, PersonAdd, Notifications, 
  Refresh, FilterList, MyLocation, PhotoCamera, AccountCircle
} from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import {
  client, account, databases, storage, DATABASE_ID, COLLECTION_ID, 
  BUCKET_ID, ID, Query, loginUser, createUser, getCurrentUser, 
  logout, loginWithGoogle, saveUserLocation, getUserLocations
} from './appwrite';

// Ajout d'une collection pour les messages
const MESSAGES_COLLECTION_ID = '67ec0ff5002cafd109d8';
// Ajout d'une collection pour les utilisateurs
const USERS_COLLECTION_ID = '67ec0ff5002cafd109d9';

// Configuration de styles
const styles = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column'
  },
  mapContainer: {
    width: '100%',
    height: 'calc(100vh - 60px)',
    position: 'relative',
    zIndex: 1
  },
  chatWindow: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 320,
    maxHeight: 500,
    zIndex: 1000,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#1976d2',
    color: 'white'
  },
  chatBody: {
    height: 350,
    overflowY: 'auto',
    padding: '10px',
    backgroundColor: '#f5f5f5'
  },
  messageInput: {
    padding: '10px',
    backgroundColor: 'white',
    display: 'flex',
    alignItems: 'center'
  },
  messageForm: {
    display: 'flex',
    width: '100%'
  },
  inputField: {
    flexGrow: 1,
    marginRight: 10
  },
  userList: {
    width: 280,
    padding: 0
  },
  userListItem: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f0f0f0'
    }
  },
  message: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 16,
    maxWidth: '80%',
    wordBreak: 'break-word'
  },
  sentMessage: {
    backgroundColor: '#1976d2',
    color: 'white',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    borderBottomRightRadius: 4
  },
  receivedMessage: {
    backgroundColor: 'white',
    color: 'black',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4
  },
  loginCard: {
    maxWidth: 400,
    margin: '100px auto',
    padding: 20
  },
  avatarSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginTop: 20
  },
  profileOverview: {
    position: 'absolute',
    top: 70,
    left: 10,
    zIndex: 999,
    width: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
  }
};

// Avatars disponibles (emojis)
const avatarOptions = [
  '😀', '😎', '🤖', '👽', '👻', '🐱', '🐶', '🦊', '🦁', '🐯', '🐷', '🐼', '🐨', '🦄'
];

// Main MetaverseChat Component
const MetaverseChat = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocations, setUserLocations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userListOpen, setUserListOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('😀');
  const [showProfileOverview, setShowProfileOverview] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  
  const mediaInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          // Récupérer les informations utilisateur depuis la collection utilisateurs
          try {
            const userData = await databases.listDocuments(
              DATABASE_ID,
              USERS_COLLECTION_ID,
              [Query.equal('user_id', currentUser.$id)]
            );
            
            if (userData.documents.length > 0) {
              setUser({
                ...currentUser,
                avatar: userData.documents[0].avatar || '😀',
                lastLocation: userData.documents[0].lastLocation || null
              });
            } else {
              // Créer un profil utilisateur s'il n'existe pas
              const newUserProfile = await databases.createDocument(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                ID.unique(),
                {
                  user_id: currentUser.$id,
                  name: currentUser.name,
                  email: currentUser.email,
                  avatar: '😀'
                }
              );
              
              setUser({
                ...currentUser,
                avatar: '😀',
                lastLocation: null
              });
            }
          } catch (error) {
            console.error("Erreur lors de la récupération du profil:", error);
            setUser(currentUser);
          }
          
          // Démarrer la géolocalisation
          startLocationTracking();
          
          // Charger les utilisateurs
          loadAllUsers();
        }
        setLoading(false);
      } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
        setLoading(false);
      }
    };
    
    checkUser();
    
    // Setup real-time subscription for messages if Appwrite supports it
    const unsubscribeMessages = setupRealTimeMessages();
    const unsubscribeLocations = setupRealTimeLocations();
    
    return () => {
      unsubscribeMessages && unsubscribeMessages();
      unsubscribeLocations && unsubscribeLocations();
      
      // Nettoyer les écouteurs de géolocalisation
      if (navigator.geolocation && window.watchPositionId) {
        navigator.geolocation.clearWatch(window.watchPositionId);
      }
    };
  }, []);

  // Mettre en place l'écoute des messages en temps réel
  const setupRealTimeMessages = () => {
    // Cette fonction est une simulation puisque nous n'avons pas accès au SDK Realtime d'Appwrite ici
    // En production, utilisez client.subscribe('collections.[DATABASE_ID].[COLLECTION_ID].documents', callback)
    
    // Simulation de rafraîchissement périodique des messages
    const interval = setInterval(() => {
      if (selectedUser) {
        loadMessages(selectedUser.id);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  };
  
  // Mettre en place l'écoute des positions en temps réel
  const setupRealTimeLocations = () => {
    // Simulation de rafraîchissement périodique des positions
    const interval = setInterval(() => {
      loadAllUserLocations();
    }, 5000);
    
    return () => clearInterval(interval);
  };

  // Défilement automatique vers le bas dans le chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Se concentrer sur la recherche quand la liste des utilisateurs s'ouvre
  useEffect(() => {
    if (userListOpen) {
      loadAllUsers();
    }
  }, [userListOpen]);

  // Démarrer le suivi de la localisation
  const startLocationTracking = () => {
    if (navigator.geolocation) {
      window.watchPositionId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const locationInfo = await getLocationInfo(latitude, longitude);
          
          if (user) {
            try {
              // Enregistrer la position
              await saveUserLocation(user.$id, { lat: latitude, lng: longitude }, locationInfo);
              
              // Mettre à jour le profil utilisateur avec la dernière position
              const userProfiles = await databases.listDocuments(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                [Query.equal('user_id', user.$id)]
              );
              
              if (userProfiles.documents.length > 0) {
                await databases.updateDocument(
                  DATABASE_ID,
                  USERS_COLLECTION_ID,
                  userProfiles.documents[0].$id,
                  {
                    lastLocation: { latitude, longitude },
                    lastSeen: new Date().toISOString()
                  }
                );
              }
              
              // Recharger les positions de tous les utilisateurs
              loadAllUserLocations();
            } catch (error) {
              console.error("Erreur lors de l'enregistrement de la position:", error);
            }
          }
        },
        (error) => {
          console.error("Erreur de géolocalisation:", error);
        },
        { 
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        }
      );
    } else {
      alert("La géolocalisation n'est pas prise en charge par votre navigateur.");
    }
  };

  // Obtenir des informations sur la localisation (simulé)
  const getLocationInfo = async (latitude, longitude) => {
    // En production, utilisez un service comme Google Places API, Mapbox ou OpenStreetMap
    return {
      neighborhood: "Quartier inconnu",
      weather: { temperature: "N/A", condition: "N/A" }
    };
  };

  // Charger les positions de tous les utilisateurs
  const loadAllUserLocations = async () => {
    try {
      // Récupérer tous les profils utilisateurs avec leurs dernières positions
      const userProfiles = await databases.listDocuments(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        []
      );
      
      const locations = [];
      
      for (const profile of userProfiles.documents) {
        if (profile.lastLocation) {
          locations.push({
            id: profile.user_id,
            name: profile.name,
            avatar: profile.avatar || '😀',
            position: {
              lat: profile.lastLocation.latitude,
              lng: profile.lastLocation.longitude
            },
            lastSeen: profile.lastSeen
          });
        }
      }
      
      setUserLocations(locations);
    } catch (error) {
      console.error("Erreur lors du chargement des positions:", error);
    }
  };

  // Charger tous les utilisateurs pour la recherche
  const loadAllUsers = async () => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        []
      );
      
      const users = response.documents.map(doc => ({
        id: doc.user_id,
        name: doc.name,
        email: doc.email,
        avatar: doc.avatar || '😀',
        lastSeen: doc.lastSeen || null
      }));
      
      setAllUsers(users);
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error);
    }
  };

  // Charger les messages pour un utilisateur
  const loadMessages = async (userId) => {
    if (!user) return;
    
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        [
          Query.orderAsc('timestamp'),
          Query.or(
            Query.and(
              Query.equal('sender_id', user.$id),
              Query.equal('receiver_id', userId)
            ),
            Query.and(
              Query.equal('sender_id', userId),
              Query.equal('receiver_id', user.$id)
            )
          )
        ]
      );
      
      const formattedMessages = response.documents.map(doc => ({
        id: doc.$id,
        senderId: doc.sender_id,
        receiverId: doc.receiver_id,
        content: doc.content,
        type: doc.type || 'text',
        mediaUrl: doc.media_url || null,
        timestamp: new Date(doc.timestamp),
        isMine: doc.sender_id === user.$id
      }));
      
      setMessages(formattedMessages);
      setHasNewMessage(false);
    } catch (error) {
      console.error("Erreur lors du chargement des messages:", error);
    }
  };

  // Envoyer un message
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!selectedUser || (!message.trim() && !uploadFile && !audioBlob)) return;
    
    try {
      setIsSendingMedia(true);
      let mediaUrl = null;
      let messageType = 'text';
      
      // Traiter le média si présent
      if (uploadFile) {
        const fileExt = uploadFile.name.split('.').pop();
        const fileId = ID.unique();
        const fileName = `${fileId}.${fileExt}`;
        
        const uploadResponse = await storage.createFile(
          BUCKET_ID,
          fileId,
          uploadFile
        );
        
        mediaUrl = storage.getFileView(BUCKET_ID, fileId);
        messageType = uploadFile.type.startsWith('image/') ? 'image' : 'file';
      } else if (audioBlob) {
        const fileId = ID.unique();
        const audioFile = new File([audioBlob], `${fileId}.webm`, { 
          type: 'audio/webm' 
        });
        
        const uploadResponse = await storage.createFile(
          BUCKET_ID,
          fileId,
          audioFile
        );
        
        mediaUrl = storage.getFileView(BUCKET_ID, fileId);
        messageType = 'audio';
      }
      
      // Créer le message
      const newMessage = {
        sender_id: user.$id,
        receiver_id: selectedUser.id,
        content: message.trim(),
        type: messageType,
        media_url: mediaUrl,
        timestamp: new Date().toISOString()
      };
      
      const response = await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        ID.unique(),
        newMessage
      );
      
      // Ajouter le message à l'état local pour un affichage immédiat
      setMessages([...messages, {
        id: response.$id,
        senderId: newMessage.sender_id,
        receiverId: newMessage.receiver_id,
        content: newMessage.content,
        type: newMessage.type,
        mediaUrl: newMessage.media_url,
        timestamp: new Date(newMessage.timestamp),
        isMine: true
      }]);
      
      // Réinitialiser le formulaire
      setMessage('');
      setUploadFile(null);
      setMediaPreview(null);
      setAudioBlob(null);
      setIsSendingMedia(false);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      setIsSendingMedia(false);
    }
  };

  // Commencer à enregistrer de l'audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Arrêter les pistes
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement audio:", error);
      alert("Impossible d'accéder au microphone. Vérifiez les permissions.");
    }
  };

  // Arrêter l'enregistrement audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Annuler l'enregistrement
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioBlob(null);
    }
  };

  // Gérer le chargement de média
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadFile(file);
    
    // Créer une prévisualisation pour les images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(file.name);
    }
  };

  // Annuler le média sélectionné
  const cancelMedia = () => {
    setUploadFile(null);
    setMediaPreview(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };

  // Sélectionner un utilisateur pour le chat
  const selectUserForChat = (user) => {
    setSelectedUser(user);
    loadMessages(user.id);
    setChatOpen(true);
    setUserListOpen(false);
  };

  // S'inscrire avec Google
  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  // Se connecter avec email/mot de passe
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await loginUser(loginEmail, loginPassword);
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        // Récupérer le profil utilisateur
        const userData = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          [Query.equal('user_id', currentUser.$id)]
        );
        
        if (userData.documents.length > 0) {
          setUser({
            ...currentUser,
            avatar: userData.documents[0].avatar || '😀'
          });
        } else {
          // Créer un profil si nécessaire
          await databases.createDocument(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            ID.unique(),
            {
              user_id: currentUser.$id,
              name: currentUser.name,
              email: currentUser.email,
              avatar: '😀',
              lastSeen: new Date().toISOString()
            }
          );
          
          setUser({
            ...currentUser,
            avatar: '😀'
          });
        }
        
        startLocationTracking();
        loadAllUsers();
      }
    } catch (error) {
      console.error("Erreur de connexion:", error);
      alert("Échec de connexion. Vérifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  // S'inscrire avec email/mot de passe
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Créer l'utilisateur Appwrite
      const newUser = await createUser(signupEmail, signupPassword, signupName);
      
      if (newUser) {
        // Créer le profil utilisateur
        await databases.createDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          ID.unique(),
          {
            user_id: newUser.$id,
            name: signupName,
            email: signupEmail,
            avatar: selectedAvatar,
            lastSeen: new Date().toISOString()
          }
        );
        
        // Connecter automatiquement
        await loginUser(signupEmail, signupPassword);
        const currentUser = await getCurrentUser();
        
        if (currentUser) {
          setUser({
            ...currentUser,
            avatar: selectedAvatar
          });
          
          startLocationTracking();
          loadAllUsers();
        }
      }
    } catch (error) {
      console.error("Erreur d'inscription:", error);
      alert("Échec d'inscription. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Se déconnecter
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setUserLocations([]);
      setMessages([]);
      setSelectedUser(null);
      setChatOpen(false);
      
      if (navigator.geolocation && window.watchPositionId) {
        navigator.geolocation.clearWatch(window.watchPositionId);
      }
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  // Filtrer les utilisateurs par la recherche
  const filteredUsers = allUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mettre à jour l'avatar
  const updateAvatar = async (newAvatar) => {
    if (!user) return;
    
    try {
      // Trouver le document utilisateur
      const userData = await databases.listDocuments(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        [Query.equal('user_id', user.$id)]
      );
      
      if (userData.documents.length > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          userData.documents[0].$id,
          { avatar: newAvatar }
        );
        
        setUser({
          ...user,
          avatar: newAvatar
        });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'avatar:", error);
    }
  };

  // Si chargement
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Si non connecté
  if (!user) {
    return (
      <Card sx={styles.loginCard}>
        <CardContent>
          <Typography variant="h5" align="center" gutterBottom>
            {isSignup ? "Créer un compte" : "Connexion"}
          </Typography>
          
          {isSignup ? (
            <Box component="form" onSubmit={handleSignup}>
              <TextField
                label="Nom"
                variant="outlined"
                fullWidth
                margin="normal"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                required
              />
              <TextField
                label="Email"
                type="email"
                variant="outlined"
                fullWidth
                margin="normal"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
              />
              <TextField
                label="Mot de passe"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
              />
              
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Choisissez votre avatar:
              </Typography>
              
              <Box sx={styles.avatarSelector}>
                {avatarOptions.map((avatar, index) => (
                  <Tooltip title={`Avatar ${index + 1}`} key={index}>
                    <IconButton 
                      onClick={() => setSelectedAvatar(avatar)}
                      sx={{
                        fontSize: '28px',
                        backgroundColor: selectedAvatar === avatar ? '#e3f2fd' : 'transparent',
                        border: selectedAvatar === avatar ? '2px solid #1976d2' : 'none'
                      }}
                    >
                      {avatar}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
              
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                fullWidth 
                sx={{ mt: 3 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : "S'inscrire"}
              </Button>
              
              <Button
                variant="text"
                color="primary"
                fullWidth
                sx={{ mt: 1 }}
                onClick={() => setIsSignup(false)}
              >
                Déjà inscrit? Se connecter
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleLogin}>
              <TextField
                label="Email"
                type="email"
                variant="outlined"
                fullWidth
                margin="normal"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
              <TextField
                label="Mot de passe"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
              
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                fullWidth 
                sx={{ mt: 3 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : "Se connecter"}
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
                startIcon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google" />}
                onClick={handleGoogleLogin}
              >
                Continuer avec Google
              </Button>
              
              <Button
                variant="text"
                color="primary"
                fullWidth
                sx={{ mt: 1 }}
                onClick={() => setIsSignup(true)}
              >
                Pas de compte? S'inscrire
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={styles.root}>
      {/* AppBar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        p: 1, 
        bgcolor: 'primary.main', 
        color: 'white' 
      }}>
               <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <Place sx={{ mr: 1 }} /> Métaverse Chat
        </Typography>
        <Box>
          <IconButton onClick={() => setUserListOpen(!userListOpen)} color="inherit">
            <PersonAdd />
          </IconButton>
          <IconButton onClick={() => setShowProfileOverview(!showProfileOverview)} color="inherit">
            <Avatar sx={{ 
              bgcolor: 'secondary.main', 
              width: 30,
              height: 30,
              fontSize: '16px'
            }}>
              {user.avatar}
            </Avatar>
          </IconButton>
          <IconButton onClick={handleLogout} color="inherit">
            <MoreVert />
          </IconButton>
        </Box>
      </Box>

      {/* MapContainer */}
      <MapContainer center={[48.8566, 2.3522]} zoom={13} scrollWheelZoom={true} style={styles.mapContainer}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocations.map((location) => (
          <Marker 
            key={location.id} 
            position={[location.position.lat, location.position.lng]}
            icon={new Icon({
              iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40"><circle cx="50" cy="50" r="40" fill="%231976d2"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="white">${encodeURIComponent(location.avatar)}</text></svg>`,
              iconSize: [40, 40],
              iconAnchor: [20, 40]
            })}
            eventHandlers={{
              click: () => {
                selectUserForChat(location);
              }
            }}
          >
            <Popup>
              <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px', fontSize: '20px' }}>{location.avatar}</span>
                {location.name}
              </Typography>
              <Typography variant="caption">
                Dernière vue: {location.lastSeen ? new Date(location.lastSeen).toLocaleString() : 'Inconnue'}
              </Typography>
              <Button 
                size="small" 
                variant="contained" 
                fullWidth 
                sx={{ mt: 1 }}
                onClick={() => selectUserForChat(location)}
              >
                Discuter
              </Button>
            </Popup>
          </Marker>
        ))}
        <LocationControl />
      </MapContainer>

      {/* Chat Window */}
      <Drawer 
        anchor="right" 
        open={chatOpen} 
        onClose={() => setChatOpen(false)} 
      >
        <Box sx={{ width: 350 }}>
          <Box sx={styles.chatHeader}>
            <IconButton
              onClick={() => {
                setChatOpen(false);
              }}
              color="inherit"
            >
              <ArrowBack />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              <Typography sx={{ fontSize: '24px', mr: 1 }}>{selectedUser?.avatar}</Typography>
              <Box>
                <Typography variant="subtitle1">
                  {selectedUser?.name}
                </Typography>
                <Typography variant="caption">
                  {selectedUser?.lastSeen ? 
                    `Vu ${new Date(selectedUser.lastSeen).toLocaleString()}` : 
                    'Statut inconnu'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton color="inherit">
              <MoreVert />
            </IconButton>
          </Box>
          <Box sx={styles.chatBody}>
            {messages.map((msg) => (
              <Paper 
                key={msg.id} 
                sx={{
                  ...styles.message, 
                  ...(msg.isMine ? styles.sentMessage : styles.receivedMessage)
                }}
              >
                {msg.type === 'text' && <Typography>{msg.content}</Typography>}
                {msg.type === 'image' && msg.mediaUrl && (
                  <Box>
                    <img src={msg.mediaUrl} alt="Image" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                    {msg.content && <Typography variant="caption">{msg.content}</Typography>}
                  </Box>
                )}
                {msg.type === 'audio' && msg.mediaUrl && (
                  <Box>
                    <audio controls src={msg.mediaUrl} style={{ width: '100%' }} />
                    {msg.content && <Typography variant="caption">{msg.content}</Typography>}
                  </Box>
                )}
                {msg.type === 'file' && msg.mediaUrl && (
                  <Box>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<AttachFile />}
                      href={msg.mediaUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {msg.content || 'Fichier joint'}
                    </Button>
                  </Box>
                )}
                <Typography variant="caption" sx={{ 
                  display: 'block', 
                  textAlign: msg.isMine ? 'right' : 'left',
                  opacity: 0.7,
                  fontSize: '10px',
                  mt: 0.5
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Paper>
            ))}
            <div ref={messagesEndRef} />
          </Box>
          <Box sx={styles.messageInput}>
            {audioBlob && (
              <Box sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', bgcolor: '#f0f0f0', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>Enregistrement audio prêt</Typography>
                <IconButton size="small" onClick={() => setAudioBlob(null)}>
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            )}
            <form onSubmit={sendMessage} style={styles.messageForm}>
              <InputBase 
                placeholder="Tapez votre message…" 
                fullWidth
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                sx={styles.inputField}
                disabled={isSendingMedia || isRecording}
                startAdornment={
                  <InputAdornment position="start">
                    <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)} size="small">
                      <EmojiEmotions fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                }
              />
              <input 
                type="file" 
                ref={mediaInputRef} 
                onChange={handleFileUpload}
                style={{ display: 'none' }} 
              />
              <IconButton 
                onClick={() => mediaInputRef.current && mediaInputRef.current.click()} 
                disabled={isSendingMedia || isRecording}
                size="small"
              >
                <AttachFile fontSize="small" />
              </IconButton>
              <IconButton 
                onClick={isRecording ? stopRecording : startRecording} 
                color={isRecording ? "error" : "default"}
                disabled={isSendingMedia}
                size="small"
              >
                <Mic fontSize="small" />
              </IconButton>
              <IconButton 
                type="submit" 
                color="primary"
                disabled={isSendingMedia || (message.trim() === '' && !uploadFile && !audioBlob)}
                size="small"
              >
                <Send fontSize="small" />
              </IconButton>
            </form>
            {isSendingMedia && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </Box>
          {mediaPreview && (
            <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderTop: '1px solid #ddd' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {uploadFile && uploadFile.type.startsWith('image/') ? (
                    <Box sx={{ position: 'relative' }}>
                      <img src={mediaPreview} alt="Prévisualisation" style={{ maxHeight: 100, maxWidth: '100%', borderRadius: 4 }} />
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AttachFile fontSize="small" sx={{ mr: 1 }} />
                      {uploadFile ? uploadFile.name : mediaPreview}
                    </Box>
                  )}
                </Typography>
                <IconButton size="small" onClick={cancelMedia}>
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}
        </Box>
        {showEmojiPicker && (
          <Box sx={{ 
            position: 'absolute', 
            bottom: '60px', 
            right: '0px', 
            zIndex: 1300,
            boxShadow: 3,
            bgcolor: 'background.paper',
            borderRadius: 1
          }}>
            <Box sx={{ p: 1, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">Emoji</Typography>
              <IconButton size="small" onClick={() => setShowEmojiPicker(false)}>
                <Close fontSize="small" />
              </IconButton>
            </Box>
            <EmojiPicker 
              onEmojiClick={(event, emojiObject) => {
                setMessage((prev) => prev + emojiObject.emoji);
                setShowEmojiPicker(false);
              }}
              disableAutoFocus
              native
            />
          </Box>
        )}
      </Drawer>

      {/* User List */}
      <Drawer 
        anchor="bottom" 
        open={userListOpen} 
        onClose={() => setUserListOpen(false)}
        PaperProps={{
          sx: { height: '50%', borderTopLeftRadius: 16, borderTopRightRadius: 16 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Contacts</Typography>
          <Paper sx={{ display: 'flex', alignItems: 'center', p: 1, mb: 2 }}>
            <Search sx={{ mx: 1, color: 'text.secondary' }} />
            <InputBase 
              placeholder="Rechercher un contact..." 
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={styles.inputField}
            />
          </Paper>
          <List sx={{ maxHeight: 'calc(50vh - 120px)', overflow: 'auto' }}>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <ListItem 
                  key={u.id} 
                  sx={{
                    ...styles.userListItem,
                    borderRadius: 2, 
                    mb: 1,
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => selectUserForChat(u)}
                  disablePadding
                >
                  <Box sx={{ p: 1, width: '100%', display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '28px', mr: 2 }}>{u.avatar}</Typography>
                    <ListItemText 
                      primary={u.name} 
                      secondary={u.email}
                      primaryTypographyProps={{ fontWeight: 'medium' }}
                    />
                    <Chip 
                      label="Discuter" 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectUserForChat(u);
                      }}
                    />
                  </Box>
                </ListItem>
              ))
            ) : (
              <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                Aucun contact trouvé
              </Typography>
            )}
          </List>
        </Box>
      </Drawer>

      {/* Profile Overview */}
      {showProfileOverview && (
        <Paper sx={styles.profileOverview}>
          <Box display="flex" alignItems="center">
            <Typography sx={{ fontSize: '32px', mr: 2 }}>{user.avatar}</Typography>
            <Box>
              <Typography variant="body1" fontWeight="medium">{user.name}</Typography>
              <Typography variant="body2" color="text.secondary">{user.email}</Typography>
            </Box>
            <IconButton 
              size="small" 
              sx={{ ml: 'auto' }} 
              onClick={() => setShowProfileOverview(false)}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" sx={{ mb: 0.5 }}>Changer d'avatar:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {avatarOptions.slice(0, 8).map((avatar) => (
              <IconButton 
                key={avatar}
                size="small"
                onClick={() => updateAvatar(avatar)}
                sx={{
                  fontSize: '20px',
                  backgroundColor: user.avatar === avatar ? '#e3f2fd' : 'transparent',
                  border: user.avatar === avatar ? '2px solid #1976d2' : '1px solid #ddd'
                }}
              >
                {avatar}
              </IconButton>
            ))}
          </Box>
          <Button 
            variant="outlined" 
            size="small"
            fullWidth 
            onClick={handleLogout}
            startIcon={<AccountCircle />}
            sx={{ mt: 1 }}
          >
            Déconnexion
          </Button>
        </Paper>
      )}

      {/* Composant pour centrer la carte sur la position actuelle */}
      <Box 
        sx={{ 
          position: 'absolute', 
          right: 10, 
          bottom: 30, 
          zIndex: 999
        }}
      >
        <Tooltip title="Ma position">
          <IconButton 
            sx={{ 
              bgcolor: 'white', 
              boxShadow: 2,
              '&:hover': { bgcolor: '#f5f5f5' }
            }}
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                  // La carte est gérée par le composant LocationControl
                });
              }
            }}
          >
            <MyLocation />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// Composant pour centrer la carte sur la position actuelle
const LocationControl = () => {
  const map = useMap();

  const centerMapOnLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.flyTo([latitude, longitude], 16);
        },
        (error) => {
          console.error("Erreur de géolocalisation:", error);
        }
      );
    }
  };

  // Centrer la carte au chargement
  useEffect(() => {
    centerMapOnLocation();
  }, []);

  return null;
};

export default MetaverseChat;

