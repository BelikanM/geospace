// src/pages/IA/Appwrite.js
import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

// Fonction utilitaire pour tronquer les chaînes trop longues pour Appwrite
const truncateString = (str) => {
  if (typeof str === 'string' && str.length > 255) {
    return str.substring(0, 252) + '...';
  }
  return str;
};

// Fonction pour sérialiser un objet en JSON et tronquer si nécessaire
const serializeAndTruncate = (obj) => {
  if (!obj) return '';
  try {
    const jsonString = JSON.stringify(obj);
    return truncateString(jsonString);
  } catch (error) {
    console.error('Error serializing object:', error);
    return '';
  }
};

// Appwrite configuration avec valeurs par défaut
const AppwriteConfig = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || '67bb24ad002378e79e38',
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID || '67bb32ca00157be0d0a2',
  collectionId: process.env.REACT_APP_APPWRITE_COLLECTION_ID || '67ec0ff5002cafd109d7',
  bucketId: process.env.REACT_APP_APPWRITE_BUCKET_ID || '67c698210004ee988ef1'
};

// Appwrite client configuration
const client = new Client();

client
  .setEndpoint(AppwriteConfig.endpoint)
  .setProject(AppwriteConfig.projectId);

// Initialize services
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

// Database constants
const DATABASE_ID = AppwriteConfig.databaseId;
const COLLECTION_ID = AppwriteConfig.collectionId;
const BUCKET_ID = AppwriteConfig.bucketId;

// Auth functions
export const createUser = async (email, password, name) => {
  try {
    const response = await account.create(ID.unique(), email, password, name);
    if (response) {
      await loginUser(email, password);
    }
    return response;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    return await account.createEmailSession(email, password);
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const logout = async () => {
  try {
    return await account.deleteSession('current');
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

// Alias logoutUser pour compatibilité
export const logoutUser = logout;

// Google OAuth login
export const loginWithGoogle = () => {
  try {
    const redirectUrl = window.location.origin;
    account.createOAuth2Session('google', redirectUrl, redirectUrl);
  } catch (error) {
    console.error('Error with Google login:', error);
    throw error;
  }
};

// Location data functions
export const saveUserLocation = async (userId, location, locationInfo) => {
  try {
    // Préparation des données en s'assurant qu'aucune chaîne ne dépasse 255 caractères
    const neighborhood = truncateString(locationInfo.neighborhood || '');
    
    // Convertir l'objet weather en chaîne JSON et la tronquer si nécessaire
    const weatherString = serializeAndTruncate(locationInfo.weather);
    
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      {
        user_id: userId,
        latitude: location.lat,
        longitude: location.lng,
        neighborhood: neighborhood,
        timestamp: new Date().toISOString(),
        weather: weatherString // Maintenant c'est une chaîne tronquée
      }
    );
  } catch (error) {
    console.error('Error saving location:', error);
    throw error;
  }
};

export const saveUserLocationBatch = async (userId, location, locationInfo) => {
  // À implémenter si nécessaire
  console.log("Fonction à implémenter pour les lots de positions");
  return true;
};

export const retrySendFailedBatches = async () => {
  // À implémenter si nécessaire
  console.log("Fonction à implémenter pour renvoyer les lots échoués");
  return true;
};

export const getUserLocations = async (userId) => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        Query.equal('user_id', userId)
      ]
    );
    
    // Optionnel: reconvertir les chaînes weather en objets JSON pour faciliter l'utilisation
    const documents = response.documents.map(doc => {
      if (doc.weather && typeof doc.weather === 'string') {
        try {
          doc.weatherObject = JSON.parse(doc.weather);
        } catch (e) {
          // Si erreur de parsing, on garde juste la chaîne
          doc.weatherObject = null;
        }
      }
      return doc;
    });
    
    return { ...response, documents };
  } catch (error) {
    console.error('Error getting locations:', error);
    throw error;
  }
};

export {
  client,
  account,
  databases,
  storage,
  DATABASE_ID,
  COLLECTION_ID,
  BUCKET_ID,
  ID,
  Query
};

