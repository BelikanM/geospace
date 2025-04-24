// AppwriteHistoryService.js
import { databases, storage, ID, Query, DATABASE_ID, BUCKET_ID } from './Appwrite';

const HISTORY_COLLECTION_ID = process.env.REACT_APP_APPWRITE_HISTORY_COLLECTION_ID || '67ec1234002cafd109e8';

/**
 * Save detection history to Appwrite
 * @param {string} userId 
 * @param {object} detection 
 * @param {string} imageData base64 image
 * @returns {Promise} document created
 */
export const saveDetectionHistory = async (userId, detection, imageData) => {
  try {
    const file = await uploadDetectionImage(imageData, detection.class);

    return await databases.createDocument(
      DATABASE_ID,
      HISTORY_COLLECTION_ID,
      ID.unique(),
      {
        user_id: userId,
        detection_class: detection.class,
        confidence_score: detection.score,
        timestamp: new Date().toISOString(),
        image_id: file.$id,
        metadata: JSON.stringify({
          bbox: detection.bbox,
          icon: detection.icon,
          certainty: detection.certainty,
          categories: detection.categories || []
        })
      }
    );
  } catch (error) {
    console.error('Error saving detection history:', error);
    throw error;
  }
};

/**
 * Upload base64 image as file to Appwrite Storage
 * @param {string} imageData base64 string
 * @param {string} objectClass
 * @returns {Promise} uploaded file object
 */
export const uploadDetectionImage = async (imageData, objectClass) => {
  try {
    const response = await fetch(imageData);
    const blob = await response.blob();

    const fileName = `detection_${objectClass}_${Date.now()}.jpg`;

    return await storage.createFile(
      BUCKET_ID,
      ID.unique(),
      blob,
      {
        name: fileName,
        contentType: 'image/jpeg'
      }
    );
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Get user detection history documents from Appwrite
 * @param {string} userId 
 * @param {number} limit 
 * @returns {Promise<Array>} documents plus image URLs
 */
export const getUserDetectionHistory = async (userId, limit = 50) => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      HISTORY_COLLECTION_ID,
      [
        Query.equal('user_id', userId),
        Query.orderDesc('timestamp'),
        Query.limit(limit)
      ]
    );

    return await enhanceHistoryWithImageUrls(response.documents);
  } catch (error) {
    console.error('Error getting detection history:', error);
    throw error;
  }
};

/**
 * Enhance history documents with image preview URLs
 * @param {Array} historyItems 
 * @returns {Promise<Array>} enhanced items
 */
const enhanceHistoryWithImageUrls = async (historyItems) => {
  return Promise.all(historyItems.map(async (item) => {
    try {
      if (item.image_id) {
        const imageUrl = storage.getFilePreview(
          BUCKET_ID,
          item.image_id,
          200, // width
          200, // height
          'center', // gravity
          100 // quality
        );
        return {
          ...item,
          imageUrl
        };
      }
      return item;
    } catch {
      return item; // fallback silent fail
    }
  }));
};

/**
 * Delete a single history item and its associated image
 * @param {string} historyId 
 * @param {string} imageId 
 * @returns {Promise}
 */
export const deleteHistoryItem = async (historyId, imageId) => {
  try {
    await databases.deleteDocument(DATABASE_ID, HISTORY_COLLECTION_ID, historyId);
    if (imageId) {
      await storage.deleteFile(BUCKET_ID, imageId);
    }
  } catch (error) {
    console.error('Error deleting history item:', error);
    throw error;
  }
};

/**
 * Clear all history for a user (delete documents and images)
 * @param {string} userId
 * @returns {Promise}
 */
export const clearUserHistory = async (userId) => {
  const history = await getUserDetectionHistory(userId, 1000);

  await Promise.all(
    history.map(item => deleteHistoryItem(item.$id, item.image_id))
  );

  return { success: true, count: history.length };
};

