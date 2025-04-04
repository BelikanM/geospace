import { Client, Account, Databases, Storage, ID } from 'appwrite';

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

// Vérification des valeurs avant utilisation
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

export const logoutUser = async () => {
  try {
    return await account.deleteSession('current');
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

// Google OAuth login
export const loginWithGoogle = () => {
  try {
    const redirectUrl = window.location.origin; // Current URL as redirect
    account.createOAuth2Session('google', redirectUrl, redirectUrl);
  } catch (error) {
    console.error('Error with Google login:', error);
    throw error;
  }
};

// Location data functions
export const saveUserLocation = async (userId, location, locationInfo) => {
  try {
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      {
        user_id: userId,
        latitude: location.lat,
        longitude: location.lng,
        neighborhood: locationInfo.neighborhood,
        timestamp: new Date().toISOString(),
        weather: locationInfo.weather || {}
      }
    );
  } catch (error) {
    console.error('Error saving location:', error);
    throw error;
  }
};

export const getUserLocations = async (userId) => {
  try {
    return await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        databases.queries.equal('user_id', userId)
      ]
    );
  } catch (error) {
    console.error('Error getting locations:', error);
    throw error;
  }
};

export { client, account, databases, storage, DATABASE_ID, COLLECTION_ID, BUCKET_ID, ID };


