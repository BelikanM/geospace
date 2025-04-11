import { Client, Account, Databases, Storage, ID, Query, Users } from 'appwrite';

// Configuration Appwrite avec des valeurs par défaut
const AppwriteConfig = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || '67bb24ad002378e79e38',
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID || '67bb32ca00157be0d0a2',
  collectionId: process.env.REACT_APP_APPWRITE_COLLECTION_ID || '67ec0ff5002cafd109d7',
  bucketId: process.env.REACT_APP_APPWRITE_BUCKET_ID || '67c698210004ee988ef1'
};

// Initialisation du client Appwrite
const client = new Client().setEndpoint(AppwriteConfig.endpoint).setProject(AppwriteConfig.projectId);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const users = new Users(client); // Initialisation du service Users

// Constantes pour les identifiants de la base de données
const { databaseId: DATABASE_ID, collectionId: COLLECTION_ID, bucketId: BUCKET_ID } = AppwriteConfig;

/**
 * Crée un nouvel utilisateur
 * @param {string} email - L'email de l'utilisateur
 * @param {string} password - Le mot de passe de l'utilisateur
 * @param {string} name - Le nom de l'utilisateur
 * @returns {Promise} - La réponse de la création de l'utilisateur
 */
export const createUser = async (email, password, name) => {
  try {
    const response = await account.create(ID.unique(), email, password, name);
    await loginUser(email, password); // Connexion immédiate après la création
    return response;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur :', error);
    throw error;
  }
};

/**
 * Connecte un utilisateur avec email et mot de passe
 * @param {string} email - L'email de l'utilisateur
 * @param {string} password - Le mot de passe de l'utilisateur
 * @returns {Promise} - La réponse de la connexion
 */
export const loginUser = async (email, password) => {
  try {
    return await account.createEmailSession(email, password);
  } catch (error) {
    console.error('Erreur lors de la connexion :', error);
    throw error;
  }
};

/**
 * Récupère l'utilisateur courant
 * @returns {Promise} - Les informations de l'utilisateur courant
 */
export const getCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur courant :', error);
    return null;
  }
};

/**
 * Déconnecte l'utilisateur courant
 * @returns {Promise} - La réponse de la déconnexion
 */
export const logout = async () => {
  try {
    return await account.deleteSession('current');
  } catch (error) {
    console.error('Erreur lors de la déconnexion :', error);
    throw error;
  }
};

export const logoutUser = logout;

/**
 * Connexion avec Google
 */
export const loginWithGoogle = () => {
  const redirectUrl = window.location.origin;
  account.createOAuth2Session('google', redirectUrl, redirectUrl);
};

/**
 * Enregistre la localisation d'un utilisateur
 * @param {string} userId - L'ID de l'utilisateur
 * @param {Object} location - Les coordonnées de localisation
 * @param {Object} locationInfo - Informations additionnelles sur la localisation
 * @returns {Promise} - La réponse de l'enregistrement
 */
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
    console.error('Erreur lors de l\'enregistrement de la localisation :', error);
    throw error;
  }
};

/**
 * Récupère toutes les localisations d'un utilisateur
 * @param {string} userId - L'ID de l'utilisateur
 * @returns {Promise} - La liste des localisations de l'utilisateur
 */
export const getUserLocations = async (userId) => {
  try {
    return await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal('user_id', userId)]
    );
  } catch (error) {
    console.error('Erreur lors de la récupération des localisations :', error);
    throw error;
  }
};

/**
 * Récupère la liste des utilisateurs
 * @returns {Promise} - La liste des utilisateurs
 */
export const getUsers = async () => {
  try {
    // Note: Cette méthode nécessite des permissions spécifiques
    const response = await users.list(); // Utilisation du service Users
    return response; // Ajuster selon la structure de retour
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error);
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
  Query,
};

