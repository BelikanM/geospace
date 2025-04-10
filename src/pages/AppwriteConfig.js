import { Client, Account, Databases, ID } from 'appwrite';

// Appwrite configuration avec valeurs par défaut
const AppwriteConfig = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || '<PROJECT_ID>',
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID || '<DATABASE_ID>',
  collectionId: process.env.REACT_APP_APPWRITE_COLLECTION_ID || '<COLLECTION_ID>',
  bucketId: process.env.REACT_APP_APPWRITE_BUCKET_ID || '<BUCKET_ID>'
};

// Appwrite client configuration
const client = new Client();
client.setEndpoint(AppwriteConfig.endpoint).setProject(AppwriteConfig.projectId);

// Initialize services
const account = new Account(client);
const databases = new Databases(client);

// Auth functions
export const loginWithGoogle = () => {
  try {
    const redirectUrl = window.location.origin; // Redirect URL
    account.createOAuth2Session('google', redirectUrl, redirectUrl);
  } catch (error) {
    console.error('Error with Google login:', error);
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

export const saveUserLocation = async (userId, location) => {
  try {
    return await databases.createDocument(
      AppwriteConfig.databaseId,
      AppwriteConfig.collectionId,
      ID.unique(),
      {
        user_id: userId,
        latitude: location.lat,
        longitude: location.lng,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error saving location:', error);
    throw error;
  }
};

