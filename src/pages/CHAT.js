import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-toastify';
import { 
  databases, storage, getCurrentUser, DATABASE_ID, 
  COLLECTION_ID, BUCKET_ID, ID 
} from '../utils/appwrite';
import {
  FaUser, FaHome, FaCog, FaEnvelope, FaCamera, FaMicrophone,
  FaImage, FaVideo, FaFile, FaPaperclip, FaSmile, FaSend,
  FaEdit, FaTrash, FaBell, FaCheck, FaTimes, FaUserCircle,
  FaRobot, FaGamepad, FaDragon, FaGhost, FaHeart, FaStar,
} from 'react-icons/fa';
import '../styles/Chat.css';

// Constantes
const MESSAGES_COLLECTION_ID = '67ec0ff5002cafd109d8';
const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif'],
  audio: ['audio/mp3', 'audio/wav', 'audio/ogg'],
  video: ['video/mp4', 'video/webm']
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Collection d'icônes prédéfinies
const PROFILE_ICONS = {
  default: <FaUser />,
  robot: <FaRobot />,
  game: <FaGamepad />,
  dragon: <FaDragon />,
  ghost: <FaGhost />,
  heart: <FaHeart />,
  star: <FaStar />,
};

// Utilitaires pour le chat
const createCustomIcon = (IconComponent, userName) => {
  return L.divIcon({
    html: `
      <div class="custom-marker">
        ${IconComponent ? IconComponent.render() : '<div></div>'}
        <span>${userName}</span>
      </div>
    `,
    className: 'custom-marker-container',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

// Sous-composant pour la géolocalisation
const LocationMarker = ({ onLocationFound }) => {
  const map = useMap();
  
  useEffect(() => {
    map.locate({ setView: true, maxZoom: 16 });
    
    const handleLocationFound = (e) => {
      onLocationFound(e.latlng);
    };
    
    const handleLocationError = () => {
      toast.error("Impossible d'accéder à votre position");
    };
    
    map.on('locationfound', handleLocationFound);
    map.on('locationerror', handleLocationError);
    
    return () => {
      map.off('locationfound', handleLocationFound);
      map.off('locationerror', handleLocationError);
    };
  }, [map, onLocationFound]);

  return null;
};

// Composant principal Chat
const Chat = () => {
  // États
  const [currentUser, setCurrentUser] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedIcon, setSelectedIcon] = useState('default');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [activeChatRoom, setActiveChatRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [userStatus, setUserStatus] = useState('online');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Refs
  const chatContainerRef = useRef(null);
  const mediaInputRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const wsRef = useRef(null);

  // Initialisation et récupération des données
  useEffect(() => {
    const initChat = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        setCurrentUser(user);
        
        if (user) {
          // Initialiser WebSocket pour les messages en temps réel
          initializeWebSocket(user.$id);
          
          // Charger les salons de chat
          await loadChatRooms(user.$id);
          
          // Mettre à jour le statut de l'utilisateur dans la base de données
          await updateUserStatus(user.$id, 'online');
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation du chat:", err);
        setError("Erreur de connexion. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    };

    initChat();

    // Nettoyage au démontage du composant
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (currentUser) {
        updateUserStatus(currentUser.$id, 'offline');
      }
    };
  }, []);

  // Initialisation du WebSocket
  const initializeWebSocket = (userId) => {
    const wsUrl = `wss://your-appwrite-server.com/chat/${userId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connecté");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'message') {
        handleNewWebSocketMessage(data.message);
      } else if (data.type === 'user_status') {
        updateNearbyUserStatus(data.userId, data.status);
      } else if (data.type === 'typing') {
        handleTypingIndicator(data.userId, data.isTyping);
      }
    };

    ws.onerror = (error) => {
      console.error("Erreur WebSocket:", error);
      toast.error("Problème de connexion au chat en temps réel");
    };

    ws.onclose = () => {
      console.log("WebSocket déconnecté");
      // Tentative de reconnexion après 5 secondes
      setTimeout(() => {
        if (currentUser) initializeWebSocket(currentUser.$id);
      }, 5000);
    };

    wsRef.current = ws;
  };

  // Charger les salons de chat
  const loadChatRooms = async (userId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'chat_rooms',
        [
          // Récupérer les salons où l'utilisateur est membre
          // Utilisez les filtres appropriés pour votre structure de données
        ]
      );

      setChatRooms(response.documents);
      
      // Si des salons existent, activer le premier par défaut
      if (response.documents.length > 0) {
        setActiveChatRoom(response.documents[0]);
        await loadMessages(response.documents[0].$id);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des salons de chat:", err);
      toast.error("Impossible de charger les salons de chat");
    }
  };

  // Charger les messages d'un salon
  const loadMessages = async (roomId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        [
          // Filtrer par roomId et trier par date
        ]
      );

      setMessages(response.documents);
      
      // Marquer tous les messages comme lus
      markMessagesAsRead(roomId);
      
      // Faire défiler vers le bas
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Erreur lors du chargement des messages:", err);
      toast.error("Impossible de charger les messages");
    }
  };

  // Fonction pour faire défiler vers le bas
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Gestion de la localisation trouvée
  const handleLocationFound = async (latlng) => {
    setUserLocation(latlng);
    
    try {
      // Mettre à jour la position de l'utilisateur dans la base de données
      await databases.updateDocument(
        DATABASE_ID,
        'users',
        currentUser.$id,
        {
          location: {
            latitude: latlng.lat,
            longitude: latlng.lng
          },
          lastSeen: new Date().toISOString()
        }
      );
      
      // Charger les utilisateurs à proximité
      await loadNearbyUsers(latlng);
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la position:", err);
      toast.error("Impossible de mettre à jour votre position");
    }
  };

  // Charger les utilisateurs à proximité
  const loadNearbyUsers = async (latlng) => {
    try {
      // Calculer la zone de recherche (environ 1km)
      const latRange = 0.009; // ~1km en latitude
      const lngRange = 0.009 / Math.cos(latlng.lat * (Math.PI / 180));
      
      const response = await databases.listDocuments(
        DATABASE_ID,
        'users',
        [
          // Filtrer les utilisateurs dans la zone géographique
          // et exclure l'utilisateur actuel
        ]
      );
      
      setNearbyUsers(response.documents);
    } catch (err) {
      console.error("Erreur lors du chargement des utilisateurs à proximité:", err);
      toast.error("Impossible de trouver des utilisateurs à proximité");
    }
  };

  // Mettre à jour le statut d'un utilisateur
  const updateUserStatus = async (userId, status) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        'users',
        userId,
        {
          status: status,
          lastSeen: new Date().toISOString()
        }
      );
      
      setUserStatus(status);
      
      // Notifier les autres utilisateurs via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'user_status',
          userId: userId,
          status: status
        }));
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut:", err);
    }
  };

  // Mise à jour du statut d'un utilisateur à proximité
  const updateNearbyUserStatus = (userId, status) => {
    setNearbyUsers(prev => 
      prev.map(user => 
        user.$id === userId 
          ? { ...user, status: status } 
          : user
      )
    );
  };

  // Gérer les indicateurs de frappe
  const handleTypingIndicator = (userId, isTyping) => {
    // Mettre à jour l'état des utilisateurs qui sont en train d'écrire
  };

  // Envoyer une notification de frappe
  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeChatRoom) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        userId: currentUser.$id,
        roomId: activeChatRoom.$id,
        isTyping: isTyping
      }));
    }
  };

  // Gestion des nouveaux messages via WebSocket
  const handleNewWebSocketMessage = (message) => {
    // Vérifier si le message appartient au salon actif
    if (activeChatRoom && message.roomId === activeChatRoom.$id) {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
      
      // Marquer le message comme lu si on est dans le salon actif
      markMessageAsRead(message.$id);
    } else {
      // Incrémenter le compteur de messages non lus pour ce salon
      setUnreadMessages(prev => ({
        ...prev,
        [message.roomId]: (prev[message.roomId] || 0) + 1
      }));
      
      // Notification
      toast.info(`Nouveau message de ${message.sender.name}`);
    }
  };

  // Marquer un message comme lu
  const markMessageAsRead = async (messageId) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        messageId,
        {
          readBy: [...(message.readBy || []), currentUser.$id]
        }
      );
    } catch (err) {
      console.error("Erreur lors du marquage de lecture:", err);
    }
  };

  // Marquer tous les messages d'un salon comme lus
  const markMessagesAsRead = async (roomId) => {
    try {
      // Mise à jour de l'état local
      setUnreadMessages(prev => ({
        ...prev,
        [roomId]: 0
      }));
      
      // Récupérer les messages non lus
      const unreadMessagesResponse = await databases.listDocuments(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        [
          // Filtrer les messages non lus du salon
        ]
      );
      
      // Marquer chaque message comme lu
      for (const message of unreadMessagesResponse.documents) {
        await markMessageAsRead(message.$id);
      }
    } catch (err) {
      console.error("Erreur lors du marquage des messages comme lus:", err);
    }
  };

  // Envoyer un message
  const sendMessage = async () => {
    if ((!newMessage.trim() && !mediaPreview) || !activeChatRoom) return;
    
    try {
      let mediaUrl = null;
      let mediaType = null;
      
      // Si un fichier média est sélectionné, l'uploader d'abord
      if (mediaPreview && mediaPreview.file) {
        const uploadResponse = await storage.createFile(
          BUCKET_ID,
          ID.unique(),
          mediaPreview.file
        );
        
        mediaUrl = storage.getFileView(BUCKET_ID, uploadResponse.$id);
        mediaType = mediaPreview.type;
      }
      
      // Créer le message dans la base de données
      const messageData = {
        roomId: activeChatRoom.$id,
        senderId: currentUser.$id,
        content: newMessage.trim(),
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        timestamp: new Date().toISOString(),
        readBy: [currentUser.$id]
      };
      
      const response = await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        ID.unique(),
        messageData
      );
      
      // Si nous sommes en train d'éditer un message, supprimer l'ancien
      if (editingMessage) {
        await databases.deleteDocument(
          DATABASE_ID,
          MESSAGES_COLLECTION_ID,
          editingMessage.$id
        );
        setEditingMessage(null);
      }
      
      // Ajouter le message au state local
      setMessages(prev => [...prev, { ...response, sender: currentUser }]);
      
      // Réinitialiser les inputs
      setNewMessage('');
      setMediaPreview(null);
      
      // Faire défiler vers le bas
      scrollToBottom();
      
      // Envoyer le message via WebSocket pour notification en temps réel
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message',
          message: { ...response, sender: currentUser }
        }));
      }
    } catch (err) {
      console.error("Erreur lors de l'envoi du message:", err);
      toast.error("Impossible d'envoyer le message");
    }
  };

  // Gérer la sélection de fichiers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Vérifier la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Le fichier est trop volumineux. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return;
    }
    
    // Déterminer le type de média
    let mediaType = null;
    
    if (ALLOWED_FILE_TYPES.image.includes(file.type)) {
      mediaType = 'image';
    } else if (ALLOWED_FILE_TYPES.audio.includes(file.type)) {
      mediaType = 'audio';
    } else if (ALLOWED_FILE_TYPES.video.includes(file.type)) {
      mediaType = 'video';
    } else {
      toast.error("Format de fichier non supporté");
      return;
    }
    
    // Créer un aperçu pour l'utilisateur
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview({
        url: e.target.result,
        type: mediaType,
        file: file
      });
    };
    reader.readAsDataURL(file);
  };

  // Démarrer/arrêter l'enregistrement audio
  const toggleAudioRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
          const audioFile = new File([audioBlob], "audio-message.mp3", { type: 'audio/mp3' });
          
          setMediaPreview({
            url: URL.createObjectURL(audioBlob),
            type: 'audio',
            file: audioFile
          });
        };
        
        mediaRecorder.start();
        audioRecorderRef.current = {
          mediaRecorder,
          stream
        };
        
        setIsRecording(true);
      } catch (err) {
        console.error("Erreur d'accès au microphone:", err);
        toast.error("Impossible d'accéder au microphone");
      }
    } else {
      // Arrêter l'enregistrement
      audioRecorderRef.current.mediaRecorder.stop();
      audioRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // Supprimer un message
  const deleteMessage = async (messageId) => {
    try {
      // Supprimer de la base de données
      await databases.deleteDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        messageId
      );
      
      // Mettre à jour l'état local
      setMessages(prev => prev.filter(msg => msg.$id !== messageId));
      
      toast.success("Message supprimé");
    } catch (err) {
      console.error("Erreur lors de la suppression du message:", err);
      toast.error("Impossible de supprimer le message");
    }
  };

  // Éditer un message
  const startEditingMessage = (message) => {
    setEditingMessage(message);
    setNewMessage(message.content);
    
    if (message.mediaUrl) {
      setMediaPreview({
        url: message.mediaUrl,
        type: message.mediaType
      });
    }
  };

  // Créer un nouveau salon de chat
  const createChatRoom = async (roomName, members) => {
    try {
      const roomData = {
        name: roomName,
        createdBy: currentUser.$id,
        members: [currentUser.$id, ...members],
        createdAt: new Date().toISOString()
      };
      
      const response = await databases.createDocument(
        DATABASE_ID,
        'chat_rooms',
        ID.unique(),
        roomData
      );
      
      // Ajouter le nouveau salon à l'état local
      setChatRooms(prev => [...prev, response]);
      
      // Activer le nouveau salon
      setActiveChatRoom(response);
      
      toast.success("Salon de chat créé avec succès");
    } catch (err) {
      console.error("Erreur lors de la création du salon:", err);
      toast.error("Impossible de créer le salon de chat");
    }
  };

  // Changer de salon de chat
  const switchChatRoom = async (roomId) => {
    const room = chatRooms.find(r => r.$id === roomId);
    if (room) {
      setActiveChatRoom(room);
      await loadMessages(roomId);
    }
  };

  // Rendu des messages
  const renderMessages = () => {
    return messages.map(message => {
      const isCurrentUser = message.senderId === currentUser.$id;
      const messageClass = isCurrentUser ? 'sent' : 'received';
      
      return (
        <div key={message.$id} className={`message ${messageClass}`}>
          <div className="message-content">
            {message.mediaUrl && message.mediaType === 'image' && (
              <img 
                src={message.mediaUrl} 
                alt="Image envoyée" 
                className="message-media" 
                onClick={() => window.open(message.mediaUrl)}
              />
            )}
            
            {message.mediaUrl && message.mediaType === 'audio' && (
              <audio controls className="message-media">
                <source src={message.mediaUrl} type="audio/mp3" />
                Votre navigateur ne supporte pas l'audio HTML5.
              </audio>
            )}
            
            {message.mediaUrl && message.mediaType === 'video' && (
              <video controls className="message-media">
                <source src={message.mediaUrl} type="video/mp4" />
                Votre navigateur ne supporte pas la vidéo HTML5.
              </video>
            )}
            
            {message.content && <p>{message.content}</p>}
            
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()} 
              {isCurrentUser && message.readBy && message.readBy.length > 1 && (
                <FaCheck className="read-indicator" />
              )}
            </span>
          </div>
          
          {isCurrentUser && (
            <div className="message-actions">
              <button 
                className="icon-button" 
                onClick={() => startEditingMessage(message)}
              >
                <FaEdit />
              </button>
              <button 
                className="icon-button" 
                onClick={() => deleteMessage(message.$id)}
              >
                <FaTrash />
              </button>
            </div>
          )}
        </div>
      );
    });
  };

  // Rendu des utilisateurs à proximité
  const renderNearbyUsers = () => {
    return nearbyUsers.map(user => (
      <div 
        key={user.$id} 
        className={`nearby-user ${user.status}`}
        onClick={() => initiatePrivateChat(user)}
      >
        <div className="user-icon">
          {PROFILE_ICONS[user.icon] || PROFILE_ICONS.default}
        </div>
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <span className="user-status">{user.status}</span>
        </div>
      </div>
    ));
  };

  // Initier un chat privé avec un utilisateur
  const initiatePrivateChat = async (user) => {
    // Vérifier si un salon de chat privé existe déjà
    const existingRoom = chatRooms.find(room => 
      room.type === 'private' && 
      room.members.length === 2 && 
      room.members.includes(currentUser.$id) && 
      room.members.includes(user.$id)
    );
    
    if (existingRoom) {
      switchChatRoom(existingRoom.$id);
    } else {
      // Créer un nouveau salon privé
      await createChatRoom(`Chat avec ${user.name}`, [user.$id], 'private');
    }
  };

  // Rendu des salons de chat
  const renderChatRooms = () => {
    return chatRooms.map(room => {
      const unread = unreadMessages[room.$id] || 0;
      
      return (
        <div 
          key={room.$id} 
          className={`chat-room ${activeChatRoom && activeChatRoom.$id === room.$id ? 'active' : ''}`}
          onClick={() => switchChatRoom(room.$id)}
        >
          <div className="room-icon">
            {room.type === 'group' ? <FaUsers /> : <FaUserCircle />}
          </div>
          <div className="room-info">
            <span className="room-name">{room.name}</span>
            {unread > 0 && (
              <span className="unread-badge">{unread}</span>
            )}
          </div>
        </div>
      );
    });
  };

  // Affichage d'un écran de chargement ou d'erreur si nécessaire
  if (loading) {
    return (
      <div className="chat-loading">
        <div className="spinner"></div>
        <p>Chargement du chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-error">
        <FaTimes className="error-icon" />
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="chat-login-prompt">
        <FaUserCircle className="login-icon" />
        <p>Veuillez vous connecter pour accéder au chat</p>
        <button onClick={() => window.location.href = '/login'}>Se connecter</button>
      </div>
    );
  }

  // Rendu principal du composant
  return (
    <div className="chat-container">
      {/* Section de la carte */}
      <div className="map-section">
        <MapContainer 
          center={[48.856614, 2.3522219]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {userLocation && (
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={createCustomIcon(PROFILE_ICONS[selectedIcon], currentUser.name)}
            >
              <Popup>
                Vous êtes ici!
              </Popup>
            </Marker>
          )}
          
          {nearbyUsers.map(user => (
            <Marker 
              key={user.$id}
              position={[user.location.latitude, user.location.longitude]}
              icon={createCustomIcon(PROFILE_ICONS[user.icon], user.name)}
            >
              <Popup>
                <div>
                  <strong>{user.name}</strong>
                  <p>Status: {user.status}</p>
                  <button onClick={() => initiatePrivateChat(user)}>
                    Démarrer une conversation
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          
          <LocationMarker onLocationFound={handleLocationFound} />
        </MapContainer>
      </div>
      
      {/* Section principale du chat */}
      <div className="chat-main">
        {/* Barre latérale avec les salons de chat */}
        <div className="chat-sidebar">
          <div className="user-profile">
            <div className="user-icon">
              {PROFILE_ICONS[selectedIcon]}
            </div>
            <div className="user-info">
              <span className="user-name">{currentUser.name}</span>
              <select 
                value={userStatus} 
                onChange={(e) => updateUserStatus(currentUser.$id, e.target.value)}
                className="status-selector"
              >
                <option value="online">En ligne</option>
                <option value="away">Absent</option>
                <option value="busy">Occupé</option>
                <option value="offline">Hors ligne</option>
              </select>
            </div>
          </div>
          
          <div className="icon-selector">
            <h3>Choisir une icône</h3>
            <div className="icon-grid">
              {Object.entries(PROFILE_ICONS).map(([key, Icon]) => (
                <div 
                  key={key}
                  className={`icon-option ${selectedIcon === key ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(key)}
                >
                  {Icon}
                </div>
              ))}
            </div>
          </div>
          
          <div className="chat-rooms">
                      <h3>Salons de chat</h3>
            {renderChatRooms()}
          </div>
          
          <div className="nearby-users">
            <h3>Utilisateurs à proximité</h3>
            {renderNearbyUsers()}
          </div>
        </div>
        
        {/* Interface de chat */}
        <div className="chat-interface">
          {activeChatRoom ? (
            <>
              <div className="chat-header">
                <h3>{activeChatRoom.name}</h3>
              </div>
              
              <div className="chat-messages" ref={chatContainerRef}>
                {renderMessages()}
              </div>
              
              <div className="chat-input">
                {mediaPreview ? (
                  <div className="media-preview">
                    {mediaPreview.type === 'image' && (
                      <img src={mediaPreview.url} alt="Image Preview" />
                    )}
                    {mediaPreview.type === 'audio' && (
                      <audio controls>
                        <source src={mediaPreview.url} type="audio/mp3" />
                        Votre navigateur ne supporte pas l'audio HTML5.
                      </audio>
                    )}
                    {mediaPreview.type === 'video' && (
                      <video controls>
                        <source src={mediaPreview.url} type="video/mp4" />
                        Votre navigateur ne supporte pas la vidéo HTML5.
                      </video>
                    )}
                    <button onClick={() => setMediaPreview(null)}>✖</button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    onFocus={() => sendTypingIndicator(true)}
                    onBlur={() => sendTypingIndicator(false)}
                  />
                )}
                
                <button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim() && !mediaPreview}
                >
                  Envoyer
                </button>
                
                <input 
                  type="file" 
                  ref={mediaInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect}
                  accept={Object.values(ALLOWED_FILE_TYPES).flat().join(',')}
                />
                <button onClick={() => mediaInputRef.current.click()}>
                  <FaPaperclip />
                </button>
                
                <button onClick={toggleAudioRecording}>
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                
                <button onClick={() => setShowEmojiPicker(val => !val)}>
                  <FaSmile />
                </button>
                
                {showEmojiPicker && (
                  <div className="emoji-picker">
                    {/* Emoji Picker Logic here */}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="chat-placeholder">
              <p>Choisissez un salon de chat pour commencer la conversation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;

