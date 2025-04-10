import { Account, Client, Databases, Storage, ID, Query } from 'appwrite';

export const client = new Client();

client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('VOTRE_ID_PROJET'); // Remplacez par votre ID de projet Appwrite

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Constantes pour la base de données
export const DATABASE_ID = 'VOTRE_DATABASE_ID';
export const USERS_COLLECTION_ID = 'users';
export const MESSAGES_COLLECTION_ID = 'messages';

// Fonction pour l'authentification avec Google
export const loginWithGoogle = async () => {
  try {
    const response = await account.createOAuth2Session(
      'google',
      window.location.origin,
      window.location.origin + '/auth-failed'
    );
    return response;
  } catch (error) {
    console.error('Erreur lors de la connexion avec Google:', error);
    throw error;
  }
};

// Fonction pour vérifier si un utilisateur est connecté
export const getCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    return null;
  }
};

// Fonction pour créer/mettre à jour un utilisateur dans la base de données
export const upsertUser = async (userId, userData) => {
  try {
    const existingUser = await databases.listDocuments(
      DATABASE_ID,
      USERS_COLLECTION_ID,
      [Query.equal('userId', userId)]
    );

    if (existingUser.documents.length > 0) {
      return await databases.updateDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        existingUser.documents[0].$id,
        userData
      );
    } else {
      return await databases.createDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        ID.unique(),
        { userId, ...userData }
      );
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw error;
  }
};

// Fonction pour récupérer tous les utilisateurs
export const getAllUsers = async () => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USERS_COLLECTION_ID
    );
    return response.documents;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return [];
  }
};

// Fonction pour envoyer un message
export const sendMessage = async (senderId, receiverId, content, type = 'text') => {
  try {
    const message = {
      senderId,
      receiverId,
      content,
      type,
      timestamp: new Date().toISOString()
    };
    
    return await databases.createDocument(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      ID.unique(),
      message
    );
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    throw error;
  }
};

// Fonction pour récupérer les messages entre deux utilisateurs
export const getMessages = async (userId1, userId2) => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      [
        Query.or([
          Query.and([
            Query.equal('senderId', userId1),
            Query.equal('receiverId', userId2)
          ]),
          Query.and([
            Query.equal('senderId', userId2),
            Query.equal('receiverId', userId1)
          ])
        ])
      ]
    );
    return response.documents;
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    return [];
  }
};

// Fonction pour télécharger une image de profil
export const uploadProfileImage = async (file) => {
  try {
    const result = await storage.createFile(
      'profiles',
      ID.unique(),
      file
    );
    return result.$id;
  } catch (error) {
    console.error('Erreur lors du téléchargement de l\'image de profil:', error);
    throw error;
  }
};

// Fonction pour récupérer l'URL d'une image de profil
export const getProfileImageUrl = (fileId) => {
  return storage.getFileView('profiles', fileId);
};

// Fonction pour télécharger un média pour un message
export const uploadMessageMedia = async (file) => {
  try {
    const result = await storage.createFile(
      'messages',
      ID.unique(),
      file
    );
    return result.$id;
  } catch (error) {
    console.error('Erreur lors du téléchargement du média:', error);
    throw error;
  }
};

// Fonction pour récupérer l'URL d'un média de message
export const getMessageMediaUrl = (fileId) => {
  return storage.getFileView('messages', fileId);
};

