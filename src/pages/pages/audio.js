import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaSave, FaInfoCircle, FaCog, FaExchangeAlt, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { BsZoomIn, BsZoomOut } from 'react-icons/bs';
import { MdPhotoLibrary } from 'react-icons/md';
import './Analyse.css';

// On initialise avec un objet vide qui sera remplacé par les données du fichier JSON
let objetInfos = {};

/**
 * Simule le chargement d'un modèle d'IA personnalisé en complément de COCO-SSD
 * @returns {Promise<boolean>} État du chargement du modèle
 */
const loadCustomModel = async () => {
  console.log("Chargement du modèle personnalisé...");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulation de chargement
  console.log("Modèle personnalisé chargé");
  return true;
};

/**
 * Enrichit les prédictions de l'IA avec des informations supplémentaires
 * @param {Array} predictions - Prédictions brutes du modèle COCO-SSD
 * @returns {Array} - Prédictions enrichies avec données additionnelles
 */
const enrichPredictions = (predictions) => {
  return predictions.map(prediction => {
    const baseInfo = objetInfos[prediction.class] || {
      icon: '❓',
      caracteristiques: "Informations non disponibles dans notre base de connaissances.",
      utilisation: "Utilisation non spécifiée.",
      categories: ["non classifié"],
      materiaux: ["inconnu"],
      histoire: "Histoire non documentée.",
      conseil: "Aucun conseil disponible.",
      dimensionsMoyennes: { notes: "Dimensions inconnues" },
      poidsEstime: "Inconnu",
      textePotentiel: "Texte inconnu"
    };
    
    const [x, y, width, height] = prediction.bbox;
    const aspectRatio = width / height;
    
    // Estimation de la taille réelle (approximative)
    let tailleEstimee = null;
    if (baseInfo.dimensionsMoyennes) {
      tailleEstimee = {
        ...baseInfo.dimensionsMoyennes,
        ratioImage: aspectRatio.toFixed(2),
        surface: `${(width * height).toFixed(0)} pixels²`,
        proportionImage: `${((width * height) / (640 * 480) * 100).toFixed(1)}% de l'image`
      };
    }
    
    return {
      ...prediction,
      ...baseInfo,
      id: `${prediction.class}_${Math.random().toString(36).substr(2, 9)}`, // ID unique pour chaque objet
      detectedAt: new Date().toISOString(),
      certainty: prediction.score > 0.8 ? "Élevée" : prediction.score > 0.6 ? "Moyenne" : "Faible",
      dimensions: {
        pixels: { width: width.toFixed(0), height: height.toFixed(0) },
        estimationTailleReelle: tailleEstimee
      },
      analyseTexte: {
        potentiel: baseInfo.textePotentiel,
        zoneTexte: width > 100 && height > 30 ? "Zone suffisante pour contenir du texte" : "Zone probablement trop petite pour du texte lisible"
      }
    };
  });
};

/**
 * Analyse les dimensions et positions des objets détectés dans l'image
 * @param {Object} prediction - Prédiction enrichie
 * @param {number} videoWidth - Largeur de la vidéo
 * @param {number} videoHeight - Hauteur de la vidéo
 * @returns {Object} - Analyse dimensionnelle complète de l'objet
 */
const analyserDimensionsObjets = (prediction, videoWidth, videoHeight) => {
  const [x, y, width, height] = prediction.bbox;
  
  const proportionLargeur = width / videoWidth;
  const proportionHauteur = height / videoHeight;
  const proportionSurface = (width * height) / (videoWidth * videoHeight);
  
  // Estimation de distance basée sur la taille relative
  let distanceEstimee = "indéterminée";
  if (proportionSurface > 0.5) distanceEstimee = "très proche";
  else if (proportionSurface > 0.25) distanceEstimee = "proche";
  else if (proportionSurface > 0.1) distanceEstimee = "distance moyenne";
  else if (proportionSurface > 0.05) distanceEstimee = "éloigné";
  else distanceEstimee = "très éloigné";
  
  return {
    proportionImage: {
      largeur: `${(proportionLargeur * 100).toFixed(1)}%`,
      hauteur: `${(proportionHauteur * 100).toFixed(1)}%`,
      surface: `${(proportionSurface * 100).toFixed(1)}%`
    },
    taillePixels: {
      largeur: Math.round(width),
      hauteur: Math.round(height),
      rapport: (width / height).toFixed(2)
    },
    distanceEstimee,
    dimensionsEstimees: prediction.dimensionsMoyennes || "Données non disponibles"
  };
};

/**
 * Crée un message audio descriptif d'un objet détecté
 * @param {Object} object - Objet détecté enrichi
 * @returns {string} - Texte descriptif à prononcer
 */
const createAudioDescription = (object) => {
  const confiance = Math.round(object.score * 100);
  let description = `${object.class} détecté avec ${confiance}% de confiance. `;
  
  if (object.analyseComplete) {
    const { distanceEstimee } = object.analyseComplete;
    description += `Situé à ${distanceEstimee}. `;
  }
  
  // Ajouter des informations spécifiques selon le niveau de confiance
  if (object.score > 0.8) {
    if (object.caracteristiques && object.caracteristiques !== "Informations non disponibles dans notre base de connaissances.") {
      description += `${object.caracteristiques.split('.')[0]}. `;
    }
    
    if (object.utilisation && object.utilisation !== "Utilisation non spécifiée.") {
      description += `Utilisé pour ${object.utilisation.split('.')[0].toLowerCase()}. `;
    }
  }
  
  return description;
};

/**
 * Composant principal d'analyse d'objets en temps réel
 */
const Analyse = () => {
  // Références
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const speechQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);

  // États
  const [predictions, setPredictions] = useState([]);
  const [isDetecting, setIsDetecting] = useState(true);
  const [selectedObject, setSelectedObject] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState("environment");
  const [capturedImage, setCapturedImage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [detectionMode, setDetectionMode] = useState("normal");
  const [loadingModel, setLoadingModel] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [enableCloudAnalysis, setEnableCloudAnalysis] = useState(false);
  const [objectAnalyses, setObjectAnalyses] = useState({});
  const [detectedObjectsHistory, setDetectedObjectsHistory] = useState({}); // Pour suivre les objets déjà détectés

  // Références pour optimisation
  const lastPredictionsRef = useRef([]);
  const lastDetectionTimeRef = useRef(0);
  const detectionInterval = detectionMode === "fast" ? 300 : detectionMode === "detail" ? 100 : 200; 
  
  // Appliquer le mode sombre
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Annuler toute synthèse vocale en cours quand l'audio est désactivé
  useEffect(() => {
    if (!audioEnabled) {
      window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      isSpeakingRef.current = false;
    }
  }, [audioEnabled]);
  
  /**
   * Gestion de la file d'attente audio et lecture séquentielle
   */
  const processAudioQueue = useCallback(() => {
    if (!audioEnabled || isSpeakingRef.current || speechQueueRef.current.length === 0) {
      return;
    }
    
    isSpeakingRef.current = true;
    const nextText = speechQueueRef.current.shift();
    
    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.rate = 1.1; // Légèrement plus rapide pour plus de fluidité
    utterance.onend = () => {
      isSpeakingRef.current = false;
      // Poursuivre avec le prochain élément
      setTimeout(processAudioQueue, 300);
    };
    utterance.onerror = () => {
      console.error("Erreur lors de la synthèse vocale");
      isSpeakingRef.current = false;
      setTimeout(processAudioQueue, 300);
    };
    
    window.speechSynthesis.speak(utterance);
  }, [audioEnabled]);
  
  // Processeur de file d'attente audio
  useEffect(() => {
    const intervalId = setInterval(processAudioQueue, 500);
    return () => clearInterval(intervalId);
  }, [processAudioQueue]);

  /**
   * Ajouter un message à la file d'attente audio
   */
  const addToSpeechQueue = useCallback((text, priority = false) => {
    if (!audioEnabled) return;
    
    // Si prioritaire, placer au début de la file, sinon à la fin
    if (priority) {
      speechQueueRef.current.unshift(text);
      
      // Si un message est en cours, l'interrompre pour le message prioritaire
      if (isSpeakingRef.current) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
      }
    } else {
      speechQueueRef.current.push(text);
    }
  }, [audioEnabled]);

  // Charger le JSON puis le modèle
  useEffect(() => {
    const loadModelsAndData = async () => {
      try {
        setLoadingModel(true);
        
        // Chargement dynamique du fichier JSON avec les données des objets
        console.log("Chargement des données des objets...");
        const module = await import('./objetInfos.json');
        objetInfos = module.default;
        console.log("Données des objets chargées");
        
        // Assurer que TensorFlow.js utilise WebGL
        await tf.setBackend('webgl');
        console.log("Backend TensorFlow.js:", tf.getBackend());
        
        // Charger modèle COCO-SSD
        console.log("Chargement du modèle COCO-SSD...");
        const cocoModel = await cocoSsd.load({
          base: detectionMode === "fast" ? "lite_mobilenet_v2" : "mobilenet_v2"
        });
        
        // Charger le modèle personnalisé
        const customModelLoaded = await loadCustomModel();
        
        // Stocker les références
        modelRef.current = {
          cocoModel,
          customModelLoaded,
          createdAt: new Date()
        };
        
        setLoadingModel(false);
        
        // Message de bienvenue
        addToSpeechQueue("Système d'analyse d'objets prêt à l'emploi", true);
      } catch (error) {
        console.error("Erreur lors du chargement:", error);
        setErrorMessage(`Impossible de charger les données ou les modèles d'IA. ${error.message || "Veuillez vérifier votre connexion internet et recharger l'application."}`);
        setLoadingModel(false);
      }
    };
    
    loadModelsAndData();
    
    return () => {
      // Nettoyage à la fermeture
      window.speechSynthesis.cancel();
      console.log("Nettoyage des ressources...");
    };
  }, [detectionMode, addToSpeechQueue]);
  
  /**
   * Fonction principale de détection d'objets et dessin
   */
  const detectFrame = useCallback(async () => {
    // Vérification des prérequis
    if (
      !isDetecting || 
      !modelRef.current?.cocoModel || 
      !webcamRef.current?.video || 
      webcamRef.current.video.readyState !== 4
    ) {
      requestAnimationFrame(detectFrame);
      return;
    }

    // Limiter la fréquence de détection
    const now = performance.now();
    if (now - lastDetectionTimeRef.current < detectionInterval) {
      requestAnimationFrame(detectFrame);
      return;
    }
    lastDetectionTimeRef.current = now;

    try {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      
      if (!canvas) {
        requestAnimationFrame(detectFrame);
        return;
      }
      
      const ctx = canvas.getContext('2d');

      // Ajuster le canvas aux dimensions de la vidéo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Détection des objets
      const rawPredictions = await modelRef.current.cocoModel.detect(video, 10);
      
      // Filtrer par seuil de confiance et trier
      const filteredPredictions = rawPredictions
        .filter(prediction => prediction.score > 0.35)
        .sort((a, b) => b.score - a.score);
        
      // Enrichir les prédictions
      const enhancedPredictions = enrichPredictions(filteredPredictions);
      
      // Vérifier si changement significatif
      const lastPredClasses = lastPredictionsRef.current
        .map(p => `${p.class}-${p.score.toFixed(2)}`)
        .join(',');
      const newPredClasses = enhancedPredictions
        .map(p => `${p.class}-${p.score.toFixed(2)}`)
        .join(',');
      
      if (lastPredClasses !== newPredClasses) {
        // Mise à jour des états
        setPredictions(enhancedPredictions);
        lastPredictionsRef.current = enhancedPredictions;
        
        // Analyser les dimensions des objets et mettre à jour la liste des objets détectés
        const newAnalyses = {};
        const currentTime = Date.now();
        const newDetectedObjects = {...detectedObjectsHistory};
        
        // Préparer des descriptions audio pour les nouveaux objets
        enhancedPredictions.forEach(pred => {
          // Créer un ID unique pour cet objet
          const objectId = pred.id;
          
          // Analyser les dimensions
          const analyseDimensions = analyserDimensionsObjets(pred, video.videoWidth, video.videoHeight);
          
          // Mettre à jour l'objet avec l'analyse complète
          const enhancedObject = {
            ...pred,
            analyseComplete: analyseDimensions,
            horodatage: new Date().toISOString()
          };
          
          newAnalyses[objectId] = enhancedObject;
          
          // Vérifier si cet objet est nouveau ou a changé significativement
          const objKey = `${pred.class}`;
          const existingObj = newDetectedObjects[objKey];
          
          if (!existingObj || 
              (currentTime - existingObj.lastSpoken > 5000) || // Ne pas répéter avant 5 secondes
              (Math.abs(pred.score - existingObj.score) > 0.15)) { // Changement significatif de confiance
            
            // Générer description audio pour ce nouvel objet ou changement significatif
            const audioDescription = createAudioDescription(enhancedObject);
            
            // Mettre à jour l'historique de détection
            newDetectedObjects[objKey] = {
              ...pred,
              lastSpoken: currentTime,
              score: pred.score
            };
            
            // Ajouter à la file d'attente audio avec priorité selon la confiance
            const isPriority = pred.score > 0.85;
            addToSpeechQueue(audioDescription, isPriority);
          }
        });
        
        // Mettre à jour l'état des objets détectés
        setObjectAnalyses(prev => ({...prev, ...newAnalyses}));
        setDetectedObjectsHistory(newDetectedObjects);
      }

      // Nettoyer le canvas pour le nouveau rendu
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Appliquer les filtres visuels si nécessaire
      if (brightness !== 100 || zoomLevel !== 1) {
        ctx.filter = `brightness(${brightness}%)`;
        ctx.save();
        if (zoomLevel !== 1) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(zoomLevel, zoomLevel);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
        }
        
        // Dessiner la vidéo avec filtres
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.filter = 'none';
      }
      
      // Dessiner les rectangles et étiquettes des objets détectés
      enhancedPredictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const isSelected = selectedObject && selectedObject.class === prediction.class;

        // Style du rectangle
        ctx.strokeStyle = isSelected ? '#FF3366' : '#00FFFF';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.lineJoin = 'round';

        // Dessiner le rectangle (avec arrondis si disponible)
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, 5);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, width, height);
        }

        // Créer étiquette avec info-bulle pour chaque objet détecté
        const text = `${prediction.icon} ${prediction.class} : ${(prediction.score * 100).toFixed(0)}%`;
        const textWidth = ctx.measureText(text).width + 20;
        const bubbleHeight = 30;

        ctx.fillStyle = isSelected ? 'rgba(255, 51, 102, 0.8)' : 'rgba(0, 0, 0, 0.7)';

        // Créer bulle d'arrière-plan pour le texte
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(
            x - 5,
            y > bubbleHeight + 10 ? y - bubbleHeight - 5 : y + height + 5,
            textWidth,
            bubbleHeight,
            5
          );
        } else {
          ctx.fillRect(
            x - 5,
            y > bubbleHeight + 10 ? y - bubbleHeight - 5 : y + height + 5,
            textWidth,
            bubbleHeight
          );
        }
        ctx.fill();

        // Ajouter le texte de l'étiquette
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(
          text,
          x + 5,
          y > bubbleHeight + 10 ? y - bubbleHeight / 2 - 5 : y + height + bubbleHeight / 2 + 5
        );
      });
      
    } catch (error) {
      console.error("Erreur pendant la détection:", error);
    }

    // Boucle de détection continue
    requestAnimationFrame(detectFrame);
  }, [isDetecting, selectedObject, zoomLevel, brightness, audioEnabled, detectionInterval, addToSpeechQueue, detectedObjectsHistory]);

  // Démarrer la détection une fois le modèle chargé
  useEffect(() => {
    if (!loadingModel) {
      detectFrame();
    }
  }, [detectFrame, loadingModel]);

  /**
   * Capture une photo depuis le flux webcam
   */
  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        setIsDetecting(false);
        addToSpeechQueue("Photo capturée", true);
      }
    }
  };

  /**
   * Analyse une image capturée ou chargée
   */
  const analyzeImage = async () => {
    if (!capturedImage || !modelRef.current?.cocoModel) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Évite les erreurs CORS
      img.src = capturedImage;

      // Attendre que l'image soit chargée
      await new Promise(resolve => { img.onload = resolve; });

      // Analyser l'image avec le modèle
      const rawPredictions = await modelRef.current.cocoModel.detect(img, 10);
      const enhancedPredictions = enrichPredictions(rawPredictions.filter(p => p.score > 0.5));

      setPredictions(enhancedPredictions);
      
      // Message audio pour résumer l'analyse
      if (enhancedPredictions.length > 0) {
        const summary = `Analyse terminée. ${enhancedPredictions.length} objets détectés: ${
          enhancedPredictions
            .map(p => p.class)
            .slice(0, 3) // Limiter pour ne pas être trop verbeux
            .join(', ')
        }${enhancedPredictions.length > 3 ? ', et d\'autres.' : '.'}`;
        
        addToSpeechQueue(summary, true);
      } else {
        addToSpeechQueue("Aucun objet n'a été détecté dans cette image.", true);
      }

      // Dessiner l'image et les détections sur le canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Dessiner les rectangles de détection sur l'image
      enhancedPredictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;

        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y > 20 ? y - 25 : y + height, width, 25);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.fillText(
          `${prediction.class} ${(prediction.score * 100).toFixed(0)}%`,
          x + 5,
          y > 20 ? y - 7 : y + height + 18
        );
      });
    } catch (error) {
      console.error("Erreur lors de l'analyse de l'image:", error);
      setErrorMessage("Erreur lors de l'analyse de l'image");
      addToSpeechQueue("Une erreur s'est produite lors de l'analyse de l'image", true);
    }
  };

  /**
   * Retour au mode de détection en direct
   */
  const resumeLiveDetection = () => {
    setCapturedImage(null);
    setIsDetecting(true);
    addToSpeechQueue("Retour à la détection en direct", true);
  };

  /**
   * Change la caméra (avant/arrière sur mobile)
   */
  const switchCamera = () => {
    setCameraFacingMode(prev => {
      const newMode = prev === "user" ? "environment" : "user";
      addToSpeechQueue(`Passage à la caméra ${newMode === "user" ? "frontale" : "arrière"}`, true);
      return newMode;
    });
  };
  
  /**
   * Lire la description détaillée d'un objet sélectionné
   */
  const speakObjectDetails = (object) => {
    if (!audioEnabled || !object) return;
    
    const details = `
      ${object.class} détecté avec ${Math.round(object.score * 100)}% de confiance.
      ${object.caracteristiques}
      ${object.utilisation !== "Utilisation non spécifiée." ? "Utilisation: " + object.utilisation : ""}
      ${object.conseil !== "Aucun conseil disponible." ? "Conseil: " + object.conseil : ""}
    `;
    
    addToSpeechQueue(details, true);
  };

  return (
    <div className={`analyse-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* Overlay de chargement */}
      {loadingModel && (
        <motion.div
          className="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
        >
          <div className="loader" aria-hidden="true"></div>
          <h2>Chargement des modèles d'IA...</h2>
          <p>Préparation des réseaux de neurones et bases de connaissances</p>
        </motion.div>
      )}

      {/* Message d'erreur */}
      {errorMessage && (
        <motion.div
          className="error-message"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          role="alert"
        >
          <FaInfoCircle size={24} aria-hidden="true" />
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} aria-label="Fermer le message d'erreur">Fermer</button>
        </motion.div>
      )}

      <div className="main-content">
        <div className="camera-container">
          <div className="camera-view" aria-live="polite" aria-label="Flux vidéo avec détection d'objets">
            {!capturedImage ? (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: cameraFacingMode, aspectRatio: 4 / 3 }}
                  className="webcam"
                  style={{ filter: `brightness(${brightness}%)`, transform: `scale(${zoomLevel})` }}
                />
                <canvas ref={canvasRef} className="detection-canvas" />
              </>
            ) : (
              <div className="captured-image-container">
                <img src={capturedImage} alt="Image capturée" className="captured-image" />
                <canvas ref={canvasRef} className="detection-canvas" />
              </div>
            )}

            {/* Overlay de détail pour l'objet sélectionné */}
            {selectedObject && (
              <motion.div
                className="object-detail-overlay"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="object-detail-title"
              >
                <div className="object-detail-card">
                  <div className="object-header">
                    <div className="object-title">
                      <span className="object-icon" aria-hidden="true">{selectedObject.icon}</span>
                      <h3 id="object-detail-title">{selectedObject.class}</h3>
                      {audioEnabled && (
                        <button 
                          className="audio-btn"
                          onClick={() => speakObjectDetails(selectedObject)}
                          aria-label="Lire la description audio de cet objet"
                        >
                          <FaVolumeUp />
                        </button>
                      )}
                    </div>
                    <button 
                      className="close-btn" 
                      onClick={() => setSelectedObject(null)}
                      aria-label="Fermer les détails"
                    >×</button>
                  </div>

                  <div className="object-body">
                    <div className="confidence-meter" 
                      aria-label={`Niveau de confiance: ${(selectedObject.score * 100).toFixed(1)}%`}
                    >
                      <span>Confiance: {(selectedObject.score * 100).toFixed(1)}%</span>
                      <div className="progress-bar" role="progressbar" 
                        aria-valuenow={(selectedObject.score * 100).toFixed(1)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div
                          className="progress"
                          style={{
                            width: `${selectedObject.score * 100}%`,
                                                       backgroundColor:
                              selectedObject.score > 0.7
                                ? '#4CAF50'
                                : selectedObject.score > 0.5
                                  ? '#FFC107'
                                  : '#F44336'
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Caractéristiques</h4>
                      <p>{selectedObject.caracteristiques}</p>
                    </div>

                    <div className="detail-section">
                      <h4>Utilisation</h4>
                      <p>{selectedObject.utilisation}</p>
                    </div>

                    <div className="detail-columns">
                      <div className="detail-column">
                        <h4>Catégories</h4>
                        <ul>
                          {selectedObject.categories.map((cat, i) => (
                            <li key={i}>{cat}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="detail-column">
                        <h4>Matériaux</h4>
                        <ul>
                          {selectedObject.materiaux.map((mat, i) => (
                            <li key={i}>{mat}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Dimensions Moyennes</h4>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(selectedObject.dimensionsMoyennes, null, 2)}
                      </pre>
                      <p><strong>Poids estimé:</strong> {selectedObject.poidsEstime}</p>
                    </div>

                    <div className="detail-section">
                      <h4>Analyse de la taille sur l'image</h4>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedObject.analyseComplete
                          ? JSON.stringify(selectedObject.analyseComplete, null, 2)
                          : 'Non disponible'}
                      </pre>
                    </div>

                    <div className="detail-section">
                      <h4>Analyse du texte potentiel</h4>
                      <p><strong>Potentiel:</strong> {selectedObject.analyseTexte?.potentiel || 'Non spécifié'}</p>
                      <p><strong>Zone disponible:</strong> {selectedObject.analyseTexte?.zoneTexte || 'Non spécifiée'}</p>
                    </div>

                    <div className="detail-section">
                      <h4>Histoire</h4>
                      <p>{selectedObject.histoire}</p>
                    </div>

                    <div className="detail-section conseil">
                      <h4>Conseil</h4>
                      <p>{selectedObject.conseil}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Barre d'outils de caméra */}
          <div className="camera-toolbar" role="toolbar" aria-label="Contrôles de caméra">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={switchCamera}
              title="Changer de caméra"
              aria-label="Changer entre caméra avant et arrière"
            >
              <FaExchangeAlt />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.1))}
              disabled={zoomLevel <= 1}
              title="Zoom arrière"
              aria-label="Zoom arrière"
            >
              <BsZoomOut />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              className={`tool-button ${!capturedImage ? "primary" : ""}`}
              onClick={capturedImage ? analyzeImage : capturePhoto}
              title={capturedImage ? "Analyser l'image" : "Prendre une photo"}
              aria-label={capturedImage ? "Analyser l'image" : "Prendre une photo"}
            >
              <FaCamera />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}
              disabled={zoomLevel >= 3}
              title="Zoom avant"
              aria-label="Zoom avant"
            >
              <BsZoomIn />
            </motion.button>

            <label className="tool-button" title="Charger une image" aria-label="Charger une image">
              <MdPhotoLibrary />
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setCapturedImage(reader.result);
                      setIsDetecting(false);
                      setTimeout(() => analyzeImage(), 100);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>

          {/* Contrôles pour l'image capturée */}
          {capturedImage && (
            <div className="capture-controls">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={resumeLiveDetection}
                className="control-button"
                aria-label="Retour à la caméra en direct"
              >
                Retour à la caméra
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (!capturedImage) return;
                  const link = document.createElement('a');
                  link.href = capturedImage;
                  link.download = `detected-objects-${new Date().toISOString()}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  addToSpeechQueue("Image sauvegardée dans votre galerie", true);
                }}
                className="control-button"
                aria-label="Sauvegarder l'image"
              >
                <FaSave /> Sauvegarder l'image
              </motion.button>
            </div>
          )}
        </div>

        {/* Liste des objets détectés */}
        <div className="detected-list-container">
          <h2>Objets détectés</h2>
          {predictions.length === 0 && !loadingModel && <p>En attente de détection...</p>}

          <ul className="detected-list" role="listbox" aria-label="Liste des objets détectés">
            <AnimatePresence>
              {predictions.map((item, index) => {
                const isSelected = selectedObject?.class === item.class;
                return (
                  <motion.li
                    key={`${item.class}-${index}`}
                    className={`detected-item ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedObject(isSelected ? null : item);
                      if (!isSelected && audioEnabled) {
                        // Annoncer la sélection
                        addToSpeechQueue(`${item.class} sélectionné`, true);
                      }
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.05, backgroundColor: '#222' }}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedObject(isSelected ? null : item);
                      }
                    }}
                  >
                    <span className="item-icon" aria-hidden="true">{item.icon}</span>
                    <div className="item-text">
                      <strong>{item.class}</strong>
                      <span>{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    {audioEnabled && (
                      <button 
                        className="item-audio-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToSpeechQueue(createAudioDescription(item), true);
                        }}
                        aria-label={`Lire la description de ${item.class}`}
                      >
                        <FaVolumeUp />
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>

        {/* Paramètres */}
        <div className="settings-section">
          <h3>Paramètres</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
              /> Mode sombre
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={() => setAudioEnabled(!audioEnabled)}
              /> Commentaires audio activés
            </label>
          </div>
          <div className="setting-item">
            <label>
              Mode détection:&nbsp;
              <select
                value={detectionMode}
                onChange={(e) => setDetectionMode(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="fast">Rapide</option>
                <option value="detail">Détaillé</option>
              </select>
            </label>
          </div>
          <div className="setting-item">
            <label>
              Luminosité:&nbsp;
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                aria-valuemin="50"
                aria-valuemax="150"
                aria-valuenow={brightness}
              />&nbsp;{brightness}%
            </label>
          </div>
          <motion.button
            className="settings-toggle-btn"
            onClick={() => setShowSettings(!showSettings)}
            whileTap={{ scale: 0.9 }}
            aria-expanded={showSettings}
            aria-controls="advanced-settings"
          >
            <FaCog /> {showSettings ? "Cacher" : "Afficher"} paramètres avancés
          </motion.button>

          {/* Options avancées */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                id="advanced-settings"
                className="settings-advanced"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={enableCloudAnalysis}
                      onChange={() => setEnableCloudAnalysis(!enableCloudAnalysis)}
                      disabled
                    /> Analyse dans le cloud (bientôt disponible)
                  </label>
                  <small className="coming-soon" aria-label="Fonctionnalité à venir">⚠️</small>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={audioEnabled}
                      onChange={() => setAudioEnabled(!audioEnabled)}
                    /> {audioEnabled ? <FaVolumeUp /> : <FaVolumeMute />} Commentaires vocaux
                  </label>
                </div>
                
                {/* Nouveau: contrôle de la file d'attente audio */}
                {audioEnabled && (
                  <div className="setting-item">
                    <button 
                      className="control-button"
                      onClick={() => {
                        window.speechSynthesis.cancel();
                        speechQueueRef.current = [];
                        isSpeakingRef.current = false;
                        addToSpeechQueue("File d'attente audio effacée", true);
                      }}
                    >
                      <FaVolumeMute /> Effacer file d'attente audio
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Analyse;

