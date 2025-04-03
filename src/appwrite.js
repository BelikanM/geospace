import { Client, Account, Databases, ID } from 'appwrite';

// Initialize Appwrite
const client = new Client();
client
  .setEndpoint(process.env.REACT_APP_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.REACT_APP_APPWRITE_PROJECT_ID || 'your-project-id');

// Initialize Appwrite Account service
export const account = new Account(client);

// Initialize Appwrite Database service
export const databases = new Databases(client);

export const DATABASE_ID = process.env.REACT_APP_APPWRITE_DATABASE_ID || 'your-database-id';
export const COLLECTION_ID = process.env.REACT_APP_APPWRITE_COLLECTION_ID || 'your-collection-id';

// Get current user
export const getCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Logout user
export const logout = async () => {
  try {
    await account.deleteSession('current');
    return true;
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

// Save user location
export const saveUserLocation = async (userId, latitude, longitude, altitude, speed, accuracy) => {
  try {
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      {
        user_id: userId,
        latitude,
        longitude,
        altitude: altitude || null,
        speed: speed || null,
        accuracy: accuracy || null,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error saving location:', error);
    throw error;
  }
};

// Fonction pour enregistrer un lot de positions utilisateur
export const saveUserLocationBatch = async (userId, locationBatch, totalDistance) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      {
        user_id: userId,
        date: currentDate,
        locations: JSON.stringify(locationBatch),
        total_distance: totalDistance,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error saving location batch:', error);
    // Sauvegarder localement en cas d'échec pour réessayer plus tard
    const failedBatches = JSON.parse(localStorage.getItem('failedLocationBatches') || '[]');
    failedBatches.push({
      userId,
      locationBatch,
      totalDistance,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('failedLocationBatches', JSON.stringify(failedBatches));
    throw error;
  }
};

// Fonction pour retenter l'envoi des lots échoués
export const retrySendFailedBatches = async () => {
  const failedBatches = JSON.parse(localStorage.getItem('failedLocationBatches') || '[]');
  if (failedBatches.length === 0) return;
  
  const successfulBatches = [];
  
  for (const batch of failedBatches) {
    try {
      await saveUserLocationBatch(batch.userId, batch.locationBatch, batch.totalDistance);
      successfulBatches.push(batch);
    } catch (error) {
      console.error('Failed to resend batch:', error);
    }
  }
  
  // Retirer les lots envoyés avec succès
  const remainingBatches = failedBatches.filter(batch => 
    !successfulBatches.some(s => s.timestamp === batch.timestamp)
  );
  
  localStorage.setItem('failedLocationBatches', JSON.stringify(remainingBatches));
};

// Get user locations
export const getUserLocations = async (userId) => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        // Filter for the specific user
        { field: 'user_id', value: userId }
      ]
    );
    return response.documents;
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
};

