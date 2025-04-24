// HistoryGallery.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrash, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { getUserDetectionHistory, deleteHistoryItem, clearUserHistory } from './AppwriteHistoryService';
import './HistoryGallery.css';

const HistoryGallery = ({ userId, onHistoryChange }) => {
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Load history when component mounts or userId changes
  useEffect(() => {
    if (userId) {
      loadHistory();
    }
  }, [userId]);

  // Function to load history from Appwrite
  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await getUserDetectionHistory(userId);
      setHistoryItems(items);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('Failed to load detection history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to delete a single history item
  const handleDeleteItem = async (itemId, imageId) => {
    try {
      await deleteHistoryItem(itemId, imageId);
      setHistoryItems(prev => prev.filter(item => item.$id !== itemId));
      if (onHistoryChange) onHistoryChange();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError('Failed to delete item. Please try again.');
    }
  };

  // Function to clear all history
  const handleClearAll = async () => {
    try {
      setLoading(true);
      await clearUserHistory(userId);
      setHistoryItems([]);
      if (onHistoryChange) onHistoryChange();
      setConfirmClearAll(false);
    } catch (err) {
      console.error('Failed to clear history:', err);
      setError('Failed to clear history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="history-gallery-container">
      <div className="history-gallery-header">
        <h3>Detection History</h3>
        <div className="history-gallery-actions">
          <button 
            className="refresh-button" 
            onClick={loadHistory} 
            disabled={loading}
            title="Refresh history"
          >
            <FaSync className={loading ? 'spinning' : ''} />
          </button>
          <button 
            className="clear-all-button" 
            onClick={() => setConfirmClearAll(true)}
            disabled={loading || historyItems.length === 0}
            title="Clear all history"
          >
            <FaTrash /> Clear All
          </button>
        </div>
      </div>

      {error && (
        <div className="history-error">
          <FaExclamationTriangle />
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading && historyItems.length === 0 ? (
        <div className="history-loading">
          <div className="spinner"></div>
          <p>Loading history...</p>
        </div>
      ) : historyItems.length === 0 ? (
        <div className="history-empty">
          <p>No detection history found.</p>
        </div>
      ) : (
        <div className="history-items-container">
          <AnimatePresence>
            {historyItems.map(item => (
              <motion.div 
                key={item.$id}
                className="history-item"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
              >
                <div className="history-item-image">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.detection_class} />
                  ) : (
                    <div className="no-image">No image</div>
                  )}
                </div>
                <div className="history-item-info">
                  <h4>{item.detection_class}</h4>
                  <p>Confidence: {(item.confidence_score * 100).toFixed(1)}%</p>
                  <p className="timestamp">{formatDate(item.timestamp)}</p>
                </div>
                <button 
                  className="delete-button"
                  onClick={() => setConfirmDelete(item.$id)}
                  title="Delete this item"
                >
                  <FaTrash />
                </button>

                {/* Confirmation overlay for single item delete */}
                {confirmDelete === item.$id && (
                  <div className="confirm-delete-overlay">
                    <div className="confirm-delete-dialog">
                      <p>Delete this detection?</p>
                      <div className="confirm-actions">
                        <button 
                          className="confirm-yes" 
                          onClick={() => handleDeleteItem(item.$id, item.image_id)}
                        >
                          Yes, delete
                        </button>
                        <button 
                          className="confirm-no"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Confirmation dialog for clearing all history */}
      {confirmClearAll && (
        <div className="confirm-clear-all-overlay">
          <div className="confirm-clear-dialog">
            <h4>Clear All History</h4>
            <p>Are you sure you want to delete all detection history? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button 
                className="confirm-yes" 
                onClick={handleClearAll}
                disabled={loading}
              >
                {loading ? 'Clearing...' : 'Yes, clear all'}
              </button>
              <button 
                className="confirm-no"
                onClick={() => setConfirmClearAll(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryGallery;

