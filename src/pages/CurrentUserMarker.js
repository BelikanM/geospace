import React, { useState, useEffect, useRef } from 'react';
import { 
  Client, Account, Databases, Storage, ID, Query,
  getCurrentUser, logout, databases, storage, DATABASE_ID, BUCKET_ID 
} from './appwrite'; // Importation de votre configuration Appwrite
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaSignOutAlt, FaPaperPlane, FaImage, FaEllipsisV, FaMicrophone, FaVideo } from 'react-icons/fa';
import { RiSpaceShipFill, RiAliensFill } from 'react-icons/ri';
import { IoMdSend } from 'react-icons/io';
import { GiStarfighter, GiRingedPlanet } from 'react-icons/gi';

// Création d'une nouvelle collection pour les messages
const MESSAGES_COLLECTION_ID = '67ec0ff5002cafd109d8'; // Remplacez par votre ID de collection de messages

// Palettes de couleurs futuristes
const COLORS = {
  primary: '#05D9E8',
  secondary: '#FF2A6D',
  tertiary: '#D1F7FF',
  background: '#01012B',
  darkBackground: '#010118',
  accent: '#7B61FF',
  success: '#05FF00',
  warning: '#FFC600',
  dark: '#120458',
  light: '#F5F5F5'
};

// Sons d'interface
const SOUNDS = {
  messageSent: new Audio('/sounds/message-sent.mp3'),
  messageReceived: new Audio('/sounds/message-received.mp3'),
  buttonClick: new Audio('/sounds/button-click.mp3'),
  userJoined: new Audio('/sounds/user-joined.mp3'),
  userLeft: new Audio('/sounds/user-left.mp3')
};

// Fonction principale du chat
const CHAT = () => {
  // États
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chats');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUserOnline, setIsUserOnline] = useState({});
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [themeMode, setThemeMode] = useState('dark');
  const [messageFilter, setMessageFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Références
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const audioRef = useRef(null);
  
  // Collection constante pour les utilisateurs
  const USERS_COLLECTION_ID = '67ec0ff5002cafd109d9'; // Remplacez par votre ID de collection d'utilisateurs

  // Effet pour charger le profil de l'utilisateur actuel
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        
        // Mettre à jour le statut "en ligne" de l'utilisateur
        if (user) {
          await databases.updateDocument(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            user.$id,
            {
              isOnline: true,
              lastSeen: new Date().toISOString()
            }
          );
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Erreur lors du chargement de l'utilisateur:", error);
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
    
    // Nettoyage: définir isOnline à false lorsque l'utilisateur quitte
    return () => {
      if (currentUser) {
        databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          currentUser.$id,
          {
            isOnline: false,
            lastSeen: new Date().toISOString()
          }
        );
      }
    };
  }, []);

  // Effet pour charger tous les utilisateurs
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID
        );
        
        // Filtrer l'utilisateur actuel de la liste
        const otherUsers = response.documents.filter(
          user => currentUser && user.$id !== currentUser.$id
        );
        
        setUsers(otherUsers);
        
        // Créer un objet pour le statut en ligne
        const onlineStatus = {};
        otherUsers.forEach(user => {
          onlineStatus[user.$id] = user.isOnline || false;
        });
        
        setIsUserOnline(onlineStatus);
        
      } catch (error) {
        console.error("Erreur lors du chargement des utilisateurs:", error);
      }
    };

    if (currentUser) {
      fetchUsers();
      
      // Mettre en place un intervalle pour actualiser la liste des utilisateurs
      const interval = setInterval(fetchUsers, 30000); // Actualiser toutes les 30 secondes
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Effet pour charger les messages lorsqu'un utilisateur est sélectionné
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedUser || !currentUser) return;
      
      try {
        // Créer un identifiant de conversation unique
        const conversationId = [currentUser.$id, selectedUser.$id].sort().join('_');
        
        const response = await databases.listDocuments(
          DATABASE_ID,
          MESSAGES_COLLECTION_ID,
          [
            Query.equal('conversationId', conversationId),
            Query.orderAsc('createdAt')
          ]
        );
        
        setMessages(response.documents);
        
        // Marquer tous les messages comme lus
        response.documents.forEach(async (msg) => {
          if (msg.receiverId === currentUser.$id && !msg.read) {
            await databases.updateDocument(
              DATABASE_ID,
              MESSAGES_COLLECTION_ID,
              msg.$id,
              { read: true }
            );
          }
        });
        
      } catch (error) {
        console.error("Erreur lors du chargement des messages:", error);
      }
    };

    fetchMessages();
    
    // Configurer une souscription en temps réel pour les nouveaux messages
    const unsubscribe = databases.subscribe(
      DATABASE_ID, 
      MESSAGES_COLLECTION_ID,
      (response) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const newMessage = response.payload;
          
          // Vérifier si le message appartient à la conversation actuelle
          const conversationId = [currentUser.$id, selectedUser.$id].sort().join('_');
          if (newMessage.conversationId === conversationId) {
            setMessages(prevMessages => [...prevMessages, newMessage]);
            
            // Jouer un son pour nouveau message
            if (newMessage.senderId !== currentUser.$id) {
              SOUNDS.messageReceived.play();
              
              // Marquer comme lu si l'utilisateur est actif
              databases.updateDocument(
                DATABASE_ID,
                MESSAGES_COLLECTION_ID,
                newMessage.$id,
                { read: true }
              );
            }
          } else if (newMessage.receiverId === currentUser.$id) {
            // Notification pour un message d'un autre utilisateur
            const sender = users.find(user => user.$id === newMessage.senderId);
            if (sender) {
              setNotifications(prev => [
                ...prev, 
                { id: Date.now(), message: `Nouveau message de ${sender.name}`, userId: sender.$id }
              ]);
              SOUNDS.messageReceived.play();
            }
          }
        }
      }
    );
    
    return () => {
      unsubscribe();
    };
  }, [selectedUser, currentUser]);

  // Effet pour faire défiler vers le bas lorsque de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fonction pour gérer la déconnexion
  const handleLogout = async () => {
    try {
      SOUNDS.buttonClick.play();
      
      // Mettre à jour le statut en ligne
      if (currentUser) {
        await databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          currentUser.$id,
          {
            isOnline: false,
            lastSeen: new Date().toISOString()
          }
        );
      }
      
      await logout();
      setCurrentUser(null);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  // Fonction pour sélectionner un utilisateur
  const handleSelectUser = (user) => {
    SOUNDS.buttonClick.play();
    setSelectedUser(user);
    
    // Supprimer les notifications de cet utilisateur
    setNotifications(prev => 
      prev.filter(notif => notif.userId !== user.$id)
    );
  };

  // Fonction pour envoyer un message
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !mediaPreview) || !selectedUser || !currentUser) return;
    
    try {
      SOUNDS.messageSent.play();
      
      // Créer un identifiant de conversation unique
      const conversationId = [currentUser.$id, selectedUser.$id].sort().join('_');
      
      let mediaUrl = null;
      
      // Télécharger le média si présent
      if (mediaPreview) {
        setUploadingMedia(true);
        
        const file = mediaPreview.file;
        const fileUpload = await storage.createFile(
          BUCKET_ID,
          ID.unique(),
          file
        );
        
        mediaUrl = storage.getFileView(
          BUCKET_ID,
          fileUpload.$id
        );
        
        setUploadingMedia(false);
        setMediaPreview(null);
      }
      
      // Créer le message
      const messageData = {
        conversationId,
        senderId: currentUser.$id,
        senderName: currentUser.name,
        receiverId: selectedUser.$id,
        receiverName: selectedUser.name,
        message: newMessage.trim(),
        mediaUrl,
        mediaType: mediaPreview ? mediaPreview.type : null,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        ID.unique(),
        messageData
      );
      
      setNewMessage('');
      
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
    }
  };

  // Fonction pour gérer le téléchargement de fichiers
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileType = file.type.split('/')[0]; // 'image' ou 'video'
    const reader = new FileReader();
    
    reader.onloadend = () => {
      setMediaPreview({
        url: reader.result,
        type: fileType,
        file
      });
    };
    
    reader.readAsDataURL(file);
  };

  // Fonction pour démarrer/arrêter l'enregistrement audio
  const toggleAudioRecording = () => {
    SOUNDS.buttonClick.play();
    
    if (isRecordingAudio) {
      // Arrêter l'enregistrement
      setIsRecordingAudio(false);
      
      // Ici, vous ajouteriez la logique pour arrêter réellement l'enregistrement
      // et préparer le fichier audio pour l'envoi
    } else {
      // Démarrer l'enregistrement
      setIsRecordingAudio(true);
      
      // Ici, vous ajouteriez la logique pour démarrer l'enregistrement
      // Vous auriez besoin d'accéder à l'API MediaRecorder
    }
  };
  
  // Fonction pour formater la date du dernier message
  const formatLastSeen = (dateString) => {
    if (!dateString) return "Il y a longtemps";
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return "À l'instant";
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
    
    return date.toLocaleDateString();
  };

  // Composant pour le chargement
  const LoadingScreen = () => (
    <div className="loading-screen">
      <motion.div 
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        className="loading-icon"
      >
        <RiSpaceShipFill size={50} color={COLORS.primary} />
      </motion.div>
      <h2 className="loading-text">Initialisation du système de communication...</h2>
    </div>
  );

  // Composant pour les notifications
  const NotificationSystem = () => (
    <div className="notification-container">
      <AnimatePresence>
        {notifications.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="notification"
            onClick={() => {
              const user = users.find(u => u.$id === notif.userId);
              if (user) handleSelectUser(user);
            }}
          >
            <div className="notification-icon">
              <RiAliensFill size={24} color={COLORS.accent} />
            </div>
            <p>{notif.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  // Si l'application est en train de charger
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Si aucun utilisateur n'est connecté, rediriger vers la page de connexion
  if (!currentUser) {
    return (
      <div className="login-redirect">
        <h2>Veuillez vous connecter pour accéder au système de communication</h2>
        <button 
          className="login-button"
          onClick={() => window.location.href = '/login'}
        >
          Accéder au terminal de connexion
        </button>
      </div>
    );
  }

  return (
    <div className={`chat-container ${themeMode}`}>
      {/* En-tête du chat */}
      <div className="chat-header">
        <div className="logo">
          <GiStarfighter size={28} />
          <h1>StarComm</h1>
        </div>
        
        <div className="user-profile">
          <div className="user-avatar">
            {currentUser.profileImage ? (
              <img src={currentUser.profileImage} alt={currentUser.name} />
            ) : (
              <FaUser />
            )}
            <span className="status-indicator online"></span>
          </div>
          
          <span className="username">{currentUser.name}</span>
          
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt />
          </button>
        </div>
      </div>
      
      <div className="chat-main">
        {/* Barre latérale des utilisateurs */}
        <div className="users-sidebar">
          <div className="sidebar-header">
            <div className="tabs">
              <button 
                className={activeTab === 'chats' ? 'active' : ''}
                onClick={() => setActiveTab('chats')}
              >
                Contacts
              </button>
              <button 
                className={activeTab === 'groups' ? 'active' : ''}
                onClick={() => setActiveTab('groups')}
              >
                Équipages
              </button>
            </div>
            
            <div className="search-bar">
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="users-list">
            <AnimatePresence>
              {users
                .filter(user => 
                  user.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(user => (
                  <motion.div
                    key={user.$id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500 }}
                    className={`user-card ${selectedUser && selectedUser.$id === user.$id ? 'selected' : ''}`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="user-avatar">
                      {user.profileImage ? (
                        <img src={user.profileImage} alt={user.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          <GiRingedPlanet size={30} />
                        </div>
                      )}
                      <span className={`status-indicator ${isUserOnline[user.$id] ? 'online' : 'offline'}`}></span>
                    </div>
                    
                    <div className="user-info">
                      <div className="user-name-row">
                        <h3>{user.name}</h3>
                        {notifications.some(n => n.userId === user.$id) && (
                          <span className="notification-badge"></span>
                        )}
                      </div>
                      
                      <p className="last-seen">
                        {isUserOnline[user.$id] 
                          ? 'En ligne' 
                          : `Vu ${formatLastSeen(user.lastSeen)}`
                        }
                      </p>
                    </div>
                  </motion.div>
                ))
              }
            </AnimatePresence>
          </div>
        </div>
        
        {/* Zone principale de chat */}
        <div className="chat-area">
          {selectedUser ? (
            <>
              <div className="chat-header-user">
                <div className="selected-user">
                  <div className="user-avatar">
                    {selectedUser.profileImage ? (
                      <img src={selectedUser.profileImage} alt={selectedUser.name} />
                    ) : (
                      <div className="avatar-placeholder">
                        <GiRingedPlanet size={30} />
                      </div>
                    )}
                    <span className={`status-indicator ${isUserOnline[selectedUser.$id] ? 'online' : 'offline'}`}></span>
                  </div>
                  
                  <div className="user-info">
                    <h3>{selectedUser.name}</h3>
                    <p>
                      {isUserOnline[selectedUser.$id] 
                        ? 'En ligne' 
                        : `Vu ${formatLastSeen(selectedUser.lastSeen)}`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="chat-actions">
                  <button onClick={() => {/* Implémentation d'appel audio */}}>
                    <FaMicrophone />
                  </button>
                  <button onClick={() => {/* Implémentation d'appel vidéo */}}>
                    <FaVideo />
                  </button>
                  <button onClick={() => {/* Implémentation d'autres options */}}>
                    <FaEllipsisV />
                  </button>
                </div>
              </div>
              
              <div className="messages-container" ref={chatContainerRef}>
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <RiSpaceShipFill size={50} color={COLORS.primary} />
                    </motion.div>
                    <p>Aucun message. Commencez à communiquer !</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isCurrentUser = msg.senderId === currentUser.$id;
                    const showDate = index === 0 || 
                      new Date(msg.createdAt).toDateString() !== 
                      new Date(messages[index - 1].createdAt).toDateString();
                    
                    return (
                      <React.Fragment key={msg.$id}>
                        {showDate && (
                          <div className="date-separator">
                            <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        <motion.div
                          initial={{ x: isCurrentUser ? 50 : -50, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          className={`message ${isCurrentUser ? 'sent' : 'received'}`}
                        >
                          {!isCurrentUser && (
                            <div className="message-avatar">
                              {selectedUser.profileImage ? (
                                <img src={selectedUser.profileImage} alt={selectedUser.name} />
                              ) : (
                                <FaUser />
                              )}
                            </div>
                          )}
                          
                          <div className="message-content">
                            {msg.mediaUrl && (
                              <div className="message-media">
                                {msg.mediaType === 'image' ? (
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt="Image partagée"
                                    onClick={() => {/* Afficher en plein écran */}}
                                  />
                                ) : msg.mediaType === 'video' ? (
                                  <video controls>
                                    <source src={msg.mediaUrl} type="video/mp4" />
                                    Votre navigateur ne prend pas en charge la vidéo
                                  </video>
                                ) : msg.mediaType === 'audio' ? (
                                  <audio controls>
                                    <source src={msg.mediaUrl} type="audio/mpeg" />
                                    Votre navigateur ne prend pas en charge l'audio
                                  </audio>
                                ) : (
                                  <div className="file-attachment">
                                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                                      Ouvrir le fichier
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {msg.message && (
                              <p className="message-text">{msg.message}</p>
                            )}
                            
                            <div className="message-meta">
                              <span className="message-time">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isCurrentUser && (
                                <span className={`message-status ${msg.read ? 'read' : 'sent'}`}>
                                  {msg.read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
                
                {isTyping && (
                  <div className="typing-indicator">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                )}
              </div>
              
              {mediaPreview && (
                <div className="media-preview">
                  {mediaPreview.type === 'image' ? (
                    <img src={mediaPreview.url} alt="Aperçu" />
                  ) : mediaPreview.type === 'video' ? (
                    <video src={mediaPreview.url} controls />
                  ) : null}
                  
                  <button 
                    className="cancel-upload"
                    onClick={() => setMediaPreview(null)}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <form className="message-input-container" onSubmit={sendMessage}>
                <button 
                  type="button" 
                  className="attach-button"
                  onClick={() => fileInputRef.current.click()}
                >
                  <FaImage />
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  accept="image/*,video/*,audio/*"
                />
                
                <input
                  type="text"
                  className="message-input"
                  placeholder="Tapez votre message..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    // Simuler l'indication "est en train d'écrire"
                    if (!isTyping) {
                      // Ici, vous pourriez envoyer un événement indiquant que l'utilisateur tape
                      setIsTyping(true);
                      setTimeout(() => setIsTyping(false), 2000);
                    }
                  }}
                />
                
                <button 
                  type="button"
                  className={`voice-button ${isRecordingAudio ? 'recording' : ''}`}
                  onClick={toggleAudioRecording}
                >
                  <FaMicrophone />
                </button>
                
                <button 
                  type="submit" 
                  className="send-button"
                  disabled={(!newMessage.trim() && !mediaPreview) || uploadingMedia}
                >
                  {uploadingMedia ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <IoMdSend />
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="no-chat-icon"
              >
                <RiSpaceShipFill size={80} color={COLORS.secondary} />
              </motion.div>
              <h2>Sélectionnez un contact pour démarrer une communication</h2>
              <p>Choisissez un utilisateur dans la liste pour commencer à discuter</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Système de notifications */}
      <NotificationSystem />
      
      {/* Styles CSS en ligne */}
      <style jsx>{`
        /* Réinitialisation et styles de base */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Rajdhani', 'Orbitron', sans-serif;
        }
        
        :root {
          --primary: ${COLORS.primary};
          --secondary: ${COLORS.secondary};
          --tertiary: ${COLORS.tertiary};
          --background: ${COLORS.background};
          --dark-background: ${COLORS.darkBackground};
          --accent: ${COLORS.accent};
          --success: ${COLORS.success};
          --warning: ${COLORS.warning};
          --dark: ${COLORS.dark};
          --light: ${COLORS.light};
          
          --border-radius: 8px;
          --glow-effect: 0 0 10px var(--primary);
          --box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          --gradient-bg: linear-gradient(135deg, var(--dark-background) 0%, var(--background) 100%);
        }
        
        body {
          background-color: #000;
          color: var(--light);
          overflow: hidden;
        }
        
        button {
          cursor: pointer;
          background: none;
          border: none;
          outline: none;
          color: var(--light);
          transition: all 0.3s ease;
        }
        
        button:hover {
          color: var(--primary);
          text-shadow: var(--glow-effect);
        }
        
        /* Loading Screen */
        .loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 
          100vh;
          background-color: var(--background);
          color: var(--light);
        }
        
        .loading-icon {
          animation: 3s infinite spin linear;
        }
        
        .loading-text {
          margin-top: 20px;
          font-size: 1.5em;
          color: var(--primary);
          text-shadow: var(--glow-effect);
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        /* Styles de la boîte de notifications */
        .notification-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 1000;
          width: 300px;
        }
        
        .notification {
          background-color: var(--dark);
          padding: 10px 20px;
          margin-bottom: 10px;
          border-radius: var(--border-radius);
          box-shadow: var(--box-shadow);
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        
        .notification-icon {
          margin-right: 10px;
        }
        
        .notification-badge {
          background-color: var(--secondary);
          border-radius: 50%;
          width: 10px;
          height: 10px;
          position: absolute;
          top: 12px;
          right: 20px;
          box-shadow: var(--glow-effect);
        }
        
        /* Styles du conteneur du chat */
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--gradient-bg);
        }
        
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background-color: var(--dark-background);
          box-shadow: var(--box-shadow);
        }
        
        .logo {
          display: flex;
          align-items: center;
          color: var(--light);
        }
        
        .logo h1 {
          margin-left: 10px;
        }
        
        .user-profile {
          display: flex;
          align-items: center;
        }
        
        .user-avatar {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 10px;
          box-shadow: var(--box-shadow);
        }
        
        .status-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid var(--background);
        }
        
        .online {
          background-color: var(--success);
        }
        
        .offline {
          background-color: var(--warning);
        }
        
        .logout-button {
          font-size: 1.2em;
        }
        
        .chat-main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        /* Styles de la barre latérale des utilisateurs */
        .users-sidebar {
          width: 250px;
          overflow-y: auto;
          background-color: var(--dark-background);
          box-shadow: var(--box-shadow);
          padding: 10px;
        }
        
        .sidebar-header {
          margin-bottom: 10px;
        }
        
        .tabs {
          display: flex;
          margin-bottom: 10px;
        }
        
        .tabs button {
          flex: 1;
          padding: 10px;
          text-align: center;
          background-color: var(--dark);
          border-radius: var(--border-radius);
        }
        
        .tabs .active {
          background-color: var(--primary);
          color: var(--dark-background);
        }
        
        .search-bar input {
          width: 100%;
          padding: 8px;
          border-radius: var(--border-radius);
          border: 1px solid var(--primary);
          background-color: var(--dark);
          color: var(--light);
        }
        
        .users-list {
          display: flex;
          flex-direction: column;
        }
        
        .user-card {
          padding: 10px;
          margin-bottom: 5px;
          display: flex;
          align-items: center;
          border-radius: var(--border-radius);
          box-shadow: var(--box-shadow);
          background-color: var(--dark);
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .user-card:hover {
          background-color: var(--accent);
        }
        
        .user-avatar img, .avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          margin-right: 10px;
        }
        
        .user-info {
          flex: 1;
        }
        
        .user-name-row {
          display: flex;
          align-items: center;
        }
        
        .user-name-row h3 {
          flex: 1;
        }
        
        .last-seen {
          font-size: 0.9em;
          color: var(--tertiary);
        }
        
        /* Zone principale de chat */
        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--dark-background);
        }
        
        .chat-header-user {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background-color: var(--dark-background);
          box-shadow: var(--box-shadow);
        }
        
        .selected-user {
          display: flex;
          align-items: center;
        }
        
        .message-input-container {
          display: flex;
          align-items: center;
          padding: 10px;
          background-color: var(--dark-background);
        }
        
        .message-input {
          flex: 1;
          padding: 10px;
          border-radius: var(--border-radius);
          border: none;
          background-color: var(--dark);
          color: var(--light);
          box-shadow: var(--box-shadow) inset;
        }
        
        .send-button {
          background-color: var(--accent);
          padding: 10px;
          border-radius: 50%;
          margin-left: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--box-shadow);
        }
        
        .voice-button {
          margin-left: 10px;
        }
        
        .attach-button {
          margin: 0 10px;
        }
        
        .chat-actions button,
        .tabs button:not(.active) {
          background-color: var(--dark-background);
          box-shadow: inset 0 0 8px var(--primary);
        }
        
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: var(--dark);
          color: var(--light);
          box-shadow: var(--box-shadow) inset;
        }
        
        .message {
          display: flex;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        
        .message.received {
          justify-content: flex-start;
        }
        
        .message.sent {
          justify-content: flex-end;
        }
        
        .message-content {
          max-width: 60%;
          padding: 10px;
          border-radius: var(--border-radius);
          background-color: var(--accent);
          box-shadow: var(--box-shadow);
        }
        
        .message-content .message-media img {
          max-width: 100%;
          border-radius: var(--border-radius);
        }
        
        .message-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8em;
          margin-top: 4px;
        }
        
        .message-time {
          color: var(--tertiary);
        }
        
        .message-status {
          font-weight: bold;
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          margin: 0 auto;
        }
        
        .dot {
          width: 8px;
          height: 8px;
          margin: 2px;
          background-color: var(--primary);
          border-radius: 50%;
          animation: dotPulse 1.5s infinite;
        }
        
        @keyframes dotPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        
        .no-chat-selected {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--tertiary);
        }
        
        .media-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 10px;
        }
        
        .cancel-upload {
          position: absolute;
          top: 5px;
          right: 5px;
          background-color: var(--secondary);
          border-radius: 50%;
          box-shadow: var(--box-shadow);
          font-size: 1.2em;
          cursor: pointer;
        }
        
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid var(--light);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spinner 1s infinite linear;
        }
        
        @keyframes spinner {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default CHAT;

