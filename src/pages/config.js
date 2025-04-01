// src/config.js
export const AppwriteConfig = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT,
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID,
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID,
  collectionId: process.env.REACT_APP_APPWRITE_COLLECTION_ID,
  bucketId: process.env.REACT_APP_APPWRITE_BUCKET_ID
};

