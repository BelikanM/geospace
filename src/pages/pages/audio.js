import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaSave, FaInfoCircle, FaCog, FaExchangeAlt, FaVolumeUp, FaVolumeMute, FaArrowLeft } from 'react-icons/fa';
import { BsZoomIn, BsZoomOut, BsFullscreen } from 'react-icons/bs';
import { MdPhotoLibrary, MdFiberManualRecord } from 'react-icons/md';
import './Analyse.css';

// On initialise avec un objet vide qui sera remplacé par les données du fichier JSON
let objetInfos = {};

/**
 * Gestion intelligente des commentaires vocaux avec file d'attente
 */
class SpeechManager {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.lastMessages = {};
    this.cooldowns = {};
    this.enabled = true;
    this.lastDetections = new Map(); // Pour suivre les objets détectés entre les frames
    this.stabilityThreshold = 3; // Nombre de détections consécutives avant de parler
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  cancel() {
    window.speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
  }

  // Utiliser cette méthode pour ajouter un message à la file d'attente
  speak(text, priority = 1, objectId = null) {
    if (!this.enabled) return;
    
    // Éviter les messages répétés trop fréquemment pour le même objet
    if (objectId) {
      const now = Date.now();
      const lastSpoken = this.lastMessages[objectId] || 0;
      const cooldown = this.cooldowns[objectId] || 2000; // 2 secondes par défaut
      
      if (now - lastSpoken < cooldown) {
        return; // Ignore ce message, trop récent pour cet objet
      }
      
      this.lastMessages[objectId] = now;
      
      // Augmenter progressivement le cooldown pour éviter trop de mises à jour
      this.cooldowns[objectId] = Math.min(8000, cooldown + 500);
    }

    const message = { text, priority, timestamp: Date.now() };
    
    // Ajouter le message à la file dans l'ordre de priorité
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(message);
    } else {
      this.queue.splice(insertIndex, 0, message);
    }
    
    this.processQueue();
  }

  // Traite la file de messages
  processQueue() {
    if (this.speaking || this.queue.length === 0) return;
    
    const message = this.queue.shift();
    this.speaking = true;
    
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.1; // Légèrement plus rapide pour une expérience plus fluide
    
    utterance.onend = () => {
      this.speaking = false;
      // Attendre un court instant avant de traiter le message suivant
      setTimeout(() => this.processQueue(), 300);
    };
    
    window.speechSynthesis.speak(utterance);
  }

  // Méthode pour suivre la stabilité des objets entre les frames
  trackDetection(objectId, prediction) {
    const now = Date.now();
    let track = this.lastDetections.get(objectId) || {
      firstSeen: now,
      detectionCount: 0,
      lastSeen: 0,
      confidence: [],
      isStable: false,
      wasDescribed: false
    };

    // Mettre à jour les stats de l'objet
    track.detectionCount++;
    track.lastSeen = now;
    track.confidence.push(prediction.score);
    
    // Garder seulement les dernières valeurs pour éviter une consommation mémoire trop importante
    if (track.confidence.length > 10) track.confidence.shift();

    // Déterminer si l'objet est stable (détecté plusieurs fois consécutivement)
    track.isStable = track.detectionCount >= this.stabilityThreshold;

    this.lastDetections.set(objectId, track);
    return track;
  }

  // Nettoyer les objets qui n'ont pas été vus depuis un certain temps
  cleanupDetections() {
    const now = Date.now();
    const timeout = 5000; // 5 secondes
    
    for (const [objectId, track] of this.lastDetections.entries()) {
      if (now - track.lastSeen > timeout) {
        this.lastDetections.delete(objectId);
      }
    }
  }
}

/**
 * Enrichit les prédictions de l'IA avec des informations supplémentaires
 * @param {Array} predictions - Prédictions brutes des modèles
 * @returns {Array} - Prédictions enrichies avec données additionnelles
 */
const enrichPredictions = (predictions) => {
  return predictions.map(prediction => {
    // Informations de base par défaut
    const baseInfo = objetInfos[prediction.class] || {
      icon: '🔧', // Icône pour les détections YOLO
      caracteristiques: "Informations non disponibles dans notre base de connaissances.",
      utilisation: "Utilisation non spécifiée.",
      categories: ["non classifié"],
      materiaux: ["inconnu"],
      histoire: "Histoire non documentée.",
      conseil: "Aucun conseil disponible.",
      dimensionsMoyennes: { notes: "Dimensions inconnues" },
      poidsEstime: "Inconnu",
      textePotentiel: "Texte inconnu",
      source: "YOLO" // Toujours YOLO puisque c'est le seul modèle utilisé
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
    dimensionsEstimees: prediction.dimensionsMoyennes || "Données non disponibles",
    position: {
      centre: {
        x: Math.round(x + width/2),
        y: Math.round(y + height/2),
      },
      relativePosition: x < videoWidth/3 ? "gauche" : 
                        x > videoWidth*2/3 ? "droite" : "centre"
    }
  };
};

/**
 * Composant principal d'analyse d'objets en temps réel
 */
const Analyse = () => {
  // Références
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const speechManagerRef = useRef(new SpeechManager());
  const containerRef = useRef(null);

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [objectAnalyses, setObjectAnalyses] = useState({});
  const [lastSceneDescription, setLastSceneDescription] = useState("");
  const [detectionStats, setDetectionStats] = useState({
    yoloDetections: 0,
    lastUpdate: Date.now()
  });

  // Références pour optimisation
  const lastPredictionsRef = useRef([]);
  const objectHistoryRef = useRef({}); // Pour suivre l'historique de chaque objet détecté
  const lastDetectionTimeRef = useRef(0);
  const detectionInterval = detectionMode === "fast" ? 150 : detectionMode === "detail" ? 60 : 100;
  const lastDescriptionTimeRef = useRef(0);
  
  // Fonction pour passer en plein écran et sortir du plein écran
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Surveillance des changements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Afficher/masquer les contrôles sur le touch
  useEffect(() => {
    let timeout;
    const handleInteraction = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!showSettings && isFullscreen) {
          setShowControls(false);
        }
      }, 3000);
    };

    document.addEventListener('mousemove', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('mousemove', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      clearTimeout(timeout);
    };
  }, [showSettings, isFullscreen]);
  
  // Appliquer le mode sombre
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Mettre à jour l'état d'activation audio du gestionnaire de parole
  useEffect(() => {
    speechManagerRef.current.setEnabled(audioEnabled);
  }, [audioEnabled]);

  // Charger le JSON puis les modèles (uniquement YOLO)
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
        
        // CHARGEMENT UNIQUEMENT DU MODÈLE YOLO
        console.log("Chargement du modèle YOLO personnalisé...");
        const yoloModel = await tf.loadGraphModel('/models/lifemodo_tfjs/model.json');
        console.log("Modèle YOLO chargé avec succès ✅");

        // Stocker uniquement le modèle YOLO
        modelRef.current = {
          yoloModel,
          createdAt: new Date()
        };
        
        setLoadingModel(false);
        
        // Message de bienvenue
        speechManagerRef.current.speak("Système d'analyse d'objets prêt à l'emploi. Modèle YOLO activé.", 3);
      } catch (error) {
        console.error("Erreur lors du chargement:", error);
        setErrorMessage(`Impossible de charger les données ou le modèle YOLO. ${error.message || "Veuillez vérifier votre connexion internet et recharger l'application."}`);
        setLoadingModel(false);
      }
    };
    
    loadModelsAndData();
    
    return () => {
      // Nettoyage à la fermeture
      speechManagerRef.current.cancel();
      console.log("Nettoyage des ressources...");
    };
  }, [detectionMode]);
  
  /**
   * Génère une description de la scène à partir des objets détectés
   */
  const generateSceneDescription = useCallback((enhancedPredictions, newSceneDetected) => {
    if (!audioEnabled || enhancedPredictions.length === 0) return;
    
    const now = Date.now();
    // Limiter la fréquence des descriptions générales
    const descriptionCooldown = 5000; // 5 secondes
    
    // Nettoyer les détections obsolètes
    speechManagerRef.current.cleanupDetections();
    
    // Trier les prédictions par score
    const sortedPredictions = [...enhancedPredictions].sort((a, b) => b.score - a.score);
    
    // Descriptions individuelles pour les objets significatifs
    sortedPredictions.forEach((prediction, index) => {
      // Identifier l'objet par sa classe et sa position (pour différencier multiples instances)
      const [x, y, width, height] = prediction.bbox;
      const objectId = `${prediction.class}-${Math.round(x)}-${Math.round(y)}`;
      
      // Suivre la détection pour évaluer sa stabilité
      const track = speechManagerRef.current.trackDetection(objectId, prediction);
      
      // Conditions pour décrire un objet
      const isStableObject = track.isStable;
      const isNewStableObject = isStableObject && !track.wasDescribed;
      const isHighConfidence = prediction.score > 0.7;
      const timeSinceLastDescription = now - (track.lastDescribed || 0);
      const isTimeToBriefly = timeSinceLastDescription > 20000; // 20 secondes
      const isPrioritizedPosition = index < 3; // Parmi les 3 objets principaux
      
      // Décider si on doit parler de cet objet
      const shouldDescribe = 
        (isNewStableObject && isHighConfidence) || // Nouvel objet stable avec haute confiance
        (isStableObject && isTimeToBriefly && isHighConfidence) || // Rappel périodique pour les objets importants
        (newSceneDetected && isPrioritizedPosition && isHighConfidence); // Objets importants dans une nouvelle scène
        
      if (shouldDescribe) {
        // Créer une description intelligente basée sur le contexte
        let description = "";
        
        // Version détaillée pour les nouveaux objets, simplifiée pour les rappels
        if (isNewStableObject) {
          description = `Objet personnalisé ${prediction.class.replace('custom-', '')} détecté`;
          
          // Ajouter des détails sur la position/taille
          const analysis = analyserDimensionsObjets(prediction, 640, 480);
          const positionDesc = analysis.position.relativePosition === "gauche" ? "à gauche" : 
                              analysis.position.relativePosition === "droite" ? "à droite" : "au centre";
                              
          description += `, ${positionDesc}, ${analysis.distanceEstimee}`;
          
          // Ajouter des caractéristiques de l'objet si disponibles et pertinentes
          if (prediction.caracteristiques && 
              prediction.caracteristiques !== "Informations non disponibles dans notre base de connaissances.") {
            // Extraire juste la première phrase pour être concis
            const shortDesc = prediction.caracteristiques.split('.')[0]; 
            description += `. ${shortDesc}`;
          }
          
          // Ajouter un conseil si disponible et pertinent (pas à chaque fois)
          if (prediction.conseil && 
              prediction.conseil !== "Aucun conseil disponible" && 
              Math.random() > 0.6) {
            description += `. ${prediction.conseil}`;
          }
        } else if (isTimeToBriefly) {
          // Version très courte pour les rappels périodiques
          description = `Objet ${prediction.class.replace('custom-', '')} toujours visible`;
          
          // Mentionner sa position
          const analysis = analyserDimensionsObjets(prediction, 640, 480);
          const positionDesc = analysis.position.relativePosition === "gauche" ? "à gauche" : 
                              analysis.position.relativePosition === "droite" ? "à droite" : "au centre";
          description += `, ${positionDesc}`;
        }
        
        if (description) {
          // Parler avec une priorité basée sur la nouveauté et confiance
          const priority = isNewStableObject ? 2 : 
                          isTimeToBriefly ? 1 : 1.5;
                          
          speechManagerRef.current.speak(description, priority, objectId);
          
          // Marquer que cet objet a été décrit
          track.wasDescribed = true;
          track.lastDescribed = now;
        }
      }
    });
    
    // Génération de description globale de la scène si nécessaire
    if (newSceneDetected && sortedPredictions.length > 1 && now - lastDescriptionTimeRef.current > descriptionCooldown) {
      const topObjects = sortedPredictions
        .filter(p => p.score > 0.6)
        .slice(0, 3)
        .map(p => p.class.replace('custom-', 'Objet '));
      
      if (topObjects.length > 1) {
        const sceneDesc = `Je vois ${topObjects.join(', ')}`;
        
        // Ne pas répéter la même description
        if (sceneDesc !== lastSceneDescription) {
          setLastSceneDescription(sceneDesc);
          speechManagerRef.current.speak(sceneDesc, 1.8);
          lastDescriptionTimeRef.current = now;
        }
      }
    }
    
    // Mettre à jour les statistiques de détection pour l'affichage
    const yoloCount = sortedPredictions.length;
    
    setDetectionStats(prev => ({
      yoloDetections: yoloCount,
      lastUpdate: now
    }));
    
  }, [audioEnabled]);
  
  /**
   * Fonction principale de détection d'objets et dessin
   * Utilise uniquement YOLO
   */
  const detectFrame = useCallback(async () => {
    // Vérification des prérequis
    if (
      !isDetecting || 
      !modelRef.current?.yoloModel || 
      !webcamRef.current?.video || 
      webcamRef.current.video.readyState !== 4
    ) {
      requestAnimationFrame(detectFrame);
      return;
    }

    // Limiter la fréquence de détection pour maintenir les performances
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

      // Préparer le tenseur d'entrée pour YOLO
      const inputTensor = tf.browser.fromPixels(video)
        .resizeNearestNeighbor([640, 640])
        .expandDims()
        .div(255.0);
          
      // Exécuter l'inférence YOLO
      const yoloOutputs = await modelRef.current.yoloModel.executeAsync(inputTensor);
      
      // Nettoyer le tenseur d'entrée pour éviter les fuites mémoire
      inputTensor.dispose();
      
      // Récupérer les données du premier tenseur de sortie qui contient les prédictions
      const yoloData = await yoloOutputs[0].array();
      
      // Nettoyer les tenseurs de sortie
      if (Array.isArray(yoloOutputs)) {
        yoloOutputs.forEach(tensor => tensor.dispose());
      } else {
        yoloOutputs.dispose();
      }
      
      // Récupérer les prédictions brutes du modèle YOLO
      const yoloRawPredictions = yoloData[0];
      
      // Tableau pour stocker les prédictions formatées
      let yoloPredictions = [];
      
      // Analyser les prédictions YOLO et les convertir au format standard
      for (let i = 0; i < yoloRawPredictions.length; i++) {
        const [x, y, w, h, score, classId] = yoloRawPredictions[i];
        
        // Ne garder que les prédictions avec un score suffisant
        if (score > 0.3) { // Seuil plus bas car c'est notre seul modèle
          // Convertir en format compatible avec le reste du code
          yoloPredictions.push({
            bbox: [
              (x - w/2) * video.videoWidth, // Coordonnée X du coin supérieur gauche
              (y - h/2) * video.videoHeight, // Coordonnée Y du coin supérieur gauche
              w * video.videoWidth,          // Largeur
              h * video.videoHeight          // Hauteur
            ],
            class: `custom-${Math.round(classId)}`, // Nom de classe personnalisé
            score,                                  // Score de confiance
            source: "YOLO"                          // Source de la prédiction
          });
        }
      }
      
      // Trier les prédictions par score
      const filteredPredictions = yoloPredictions
        .filter(prediction => prediction.score > 0.3)
        .sort((a, b) => b.score - a.score);

      // Enrichir les prédictions avec des informations supplémentaires
      const enhancedPredictions = enrichPredictions(filteredPredictions);

      // Vérifier changement significatif pour mise à jour des états et audio
      const lastPredClasses = lastPredictionsRef.current
        .map(p => `${p.class}-${p.score.toFixed(2)}`)
        .sort()
        .join(',');
      const newPredClasses = enhancedPredictions
        .map(p => `${p.class}-${p.score.toFixed(2)}`)
        .sort()
        .join(',');
      const isNewScene = lastPredClasses !== newPredClasses;
      
      if (isNewScene) {
        // Maj état React
        setPredictions(enhancedPredictions);
        lastPredictionsRef.current = enhancedPredictions;

        // Analyser dimensions objets détectés
        const newAnalyses = {};
        enhancedPredictions.forEach(pred => {
          const objectId = `${pred.class}-${Math.random().toString(36).slice(2, 8)}`;
          newAnalyses[objectId] = {
            ...pred,
            analyseComplete: analyserDimensionsObjets(pred, video.videoWidth, video.videoHeight),
            horodatage: new Date().toISOString()
          };
        });
        setObjectAnalyses(prev => ({ ...prev, ...newAnalyses }));

        // Génération des descriptions audio intelligentes
        generateSceneDescription(enhancedPredictions, isNewScene);
      }

      // Dessiner sur le canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Appliquer filtres visuels (luminosité, zoom)
      if (brightness !== 100 || zoomLevel !== 1) {
        ctx.filter = `brightness(${brightness}%)`;
        ctx.save();

        if (zoomLevel !== 1) {
          ctx.translate(canvas.width/2, canvas.height/2);
          ctx.scale(zoomLevel, zoomLevel);
          ctx.translate(-canvas.width/2, -canvas.height/2);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.filter = 'none';
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Dessiner toutes les boîtes rectangulaires et annotations
      enhancedPredictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const isSelected = selectedObject && selectedObject.class === prediction.class;

        ctx.strokeStyle = isSelected ? '#FF3366' : '#FFAA00'; // Couleur orange pour YOLO
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.lineJoin = 'round';

        // Arrondir les rectangles si possible
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, 6);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, width, height);
        }

        // Affichage des étiquettes
        const label = `${prediction.icon} YOLO ${prediction.class.replace('custom-', '')} ${(prediction.score*100).toFixed(0)}%`;
        const padding = 6;
        const fontSize = 16;
        ctx.font = `bold ${fontSize}px Arial`;
        const textWidth = ctx.measureText(label).width;

        // Background box étiquette
        ctx.fillStyle = isSelected ? 'rgba(255, 51, 102, 0.85)' : 'rgba(0, 0, 0, 0.6)';
        const rectX = x;
        const rectY = y > fontSize + padding*2 ? y - fontSize - padding*1.5 : y + height + padding/2;
        const rectWidth = textWidth + padding*2;
        const rectHeight = fontSize + padding*1.5;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 5);
          ctx.fill();
        } else {
          ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        }

        // Texte étiquette
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, rectX + padding, rectY + fontSize);
      });
      
    } catch (error) {
      console.error('Erreur pendant la détection:', error);
    }

    requestAnimationFrame(detectFrame);
  }, [
    isDetecting, selectedObject, zoomLevel, brightness,
    detectionInterval, generateSceneDescription, audioEnabled
  ]);

  // Lancement de la détection après chargement des modèles
  useEffect(() => {
       if (!loadingModel && webcamRef.current?.video?.readyState === 4) {
      detectFrame();
    }
  }, [loadingModel, detectFrame]);

  // Analyse d'une image capturée
  const analyzeCapturedImage = async (imageSource) => {
    if (!modelRef.current?.yoloModel) {
      setErrorMessage("Le modèle YOLO n'est pas chargé");
      return;
    }

    try {
      // Créer une image à partir de la source
      const img = new Image();
      img.src = imageSource;
      await new Promise(resolve => { img.onload = resolve; });

      // Préparer le canvas pour l'analyse
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Préparer le tenseur d'entrée pour YOLO
      const inputTensor = tf.browser.fromPixels(img)
        .resizeNearestNeighbor([640, 640])
        .expandDims()
        .div(255.0);

      // Exécuter l'inférence YOLO
      const yoloOutputs = await modelRef.current.yoloModel.executeAsync(inputTensor);
      inputTensor.dispose();

      // Récupérer les données
      const yoloData = await yoloOutputs[0].array();
      if (Array.isArray(yoloOutputs)) {
        yoloOutputs.forEach(tensor => tensor.dispose());
      } else {
        yoloOutputs.dispose();
      }

      // Traiter les prédictions
      const yoloRawPredictions = yoloData[0];
      let yoloPredictions = [];

      for (let i = 0; i < yoloRawPredictions.length; i++) {
        const [x, y, w, h, score, classId] = yoloRawPredictions[i];
        if (score > 0.3) {
          yoloPredictions.push({
            bbox: [
              (x - w/2) * img.width,
              (y - h/2) * img.height,
              w * img.width,
              h * img.height
            ],
            class: `custom-${Math.round(classId)}`,
            score,
            source: "YOLO"
          });
        }
      }

      // Enrichir et mettre à jour l'état
      const enhancedPredictions = enrichPredictions(yoloPredictions);
      setPredictions(enhancedPredictions);

      // Dessiner les résultats sur l'image
      enhancedPredictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        
        // Rectangle de détection
        ctx.strokeStyle = '#FFAA00';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, 6);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, width, height);
        }

        // Étiquette
        const label = `${prediction.icon} YOLO ${prediction.class.replace('custom-', '')} ${(prediction.score*100).toFixed(0)}%`;
        const padding = 6;
        const fontSize = 16;
        ctx.font = `bold ${fontSize}px Arial`;
        const textWidth = ctx.measureText(label).width;

        // Fond de l'étiquette
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const rectX = x;
        const rectY = y > fontSize + padding*2 ? y - fontSize - padding*1.5 : y + height + padding/2;
        const rectWidth = textWidth + padding*2;
        const rectHeight = fontSize + padding*1.5;
        
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 5);
          ctx.fill();
        } else {
          ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        }

        // Texte de l'étiquette
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, rectX + padding, rectY + fontSize);
      });

      // Description audio des résultats
      if (enhancedPredictions.length > 0 && audioEnabled) {
        const objectsText = enhancedPredictions.length === 1 
          ? `1 objet détecté: ${enhancedPredictions[0].class.replace('custom-', '')}`
          : `${enhancedPredictions.length} objets détectés: ${enhancedPredictions.slice(0, 3).map(p => p.class.replace('custom-', '')).join(', ')}`;
          
        speechManagerRef.current.speak(objectsText, 2);
      } else if (audioEnabled) {
        speechManagerRef.current.speak("Aucun objet n'a été détecté dans cette image", 2);
      }

    } catch (error) {
      console.error("Erreur lors de l'analyse de l'image:", error);
      setErrorMessage("Erreur lors de l'analyse de l'image");
    }
  };

  // Commandes principales (zoom, capture, arrêt/démarrage détection, changement caméra)
  const capturePhoto = () => {
    if (!webcamRef.current) return;

    const screenshot = webcamRef.current.getScreenshot();
    if (screenshot) {
      setCapturedImage(screenshot);
      setIsDetecting(false);
      speechManagerRef.current.speak('Photo capturée', 2);
      setTimeout(() => analyzeCapturedImage(screenshot), 200);
    }
  };

  const resumeLiveDetection = () => {
    setCapturedImage(null);
    setIsDetecting(true);
    speechManagerRef.current.speak('Retour au mode détection en direct', 2);
  };

  const switchCamera = () => {
    setCameraFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
    speechManagerRef.current.speak(`Caméra ${cameraFacingMode === 'user' ? 'arrière' : 'avant'} activée`, 2);
  };

  // Description audio à la sélection d'un objet
  const describeObjectVerbally = (obj) => {
    if (!audioEnabled || !obj) return;
    let description = `${obj.class.replace('custom-', 'Objet ')} détecté avec une confiance de ${Math.round(obj.score * 100)}%. `;
    if (obj.caracteristiques && !obj.caracteristiques.includes('non disponible')){
      description += obj.caracteristiques + " ";
    }
    if (obj.utilisation && !obj.utilisation.includes('non spécifiée')){
      description += `Utilisation : ${obj.utilisation}. `;
    }
    if (obj.analyseComplete){
      description += `Cet objet semble être ${obj.analyseComplete.distanceEstimee} dans le champ de vision. `;
    }
    if (obj.conseil && !obj.conseil.includes('Aucun')){
      description += `Conseil : ${obj.conseil}.`;
    }
    speechManagerRef.current.speak(description, 3);
  };

  return (
    <div
      ref={containerRef}
      className={`analyse-container ${darkMode ? 'dark-mode' : 'light-mode'} fullscreen`}
      style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}
      onClick={() => setShowSettings(false)}
    >
      {/* Overlay de chargement */}
      {loadingModel && (
        <motion.div
          className="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: darkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)',
            zIndex: 100,
            color: darkMode ? 'white' : 'black'
          }}
        >
          <div className="loader" style={{
            border: `5px solid ${darkMode ? '#333' : '#f3f3f3'}`,
            borderTop: '5px solid #FFAA00',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <h2>Chargement du modèle YOLO...</h2>
          <p>Préparation du système d'analyse d'objets</p>
        </motion.div>
      )}

      {/* Caméra & Canvas en plein écran */}
      {!capturedImage ? (
        <Webcam
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: cameraFacingMode, aspectRatio: 4/3 }}
          style={{
            position: 'absolute',
            height: '100vh',
            width: '100vw',
            objectFit: 'cover',
            transform: `scale(${zoomLevel})`,
            filter: `brightness(${brightness}%)`
          }}
          ref={webcamRef}
          className="webcam-fullscreen"
          onUserMediaError={e => setErrorMessage('Erreur accès caméra : ' + e.message)}
        />
      ) : (
        <img 
          src={capturedImage} 
          alt="Capture analysée"
          style={{
            position: 'absolute',
            height: '100vh',
            width: '100vw',
            objectFit: 'contain',
            backgroundColor: 'black'
          }}
        />
      )}
      
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: 'absolute',
          height: '100vh',
          width: '100vw',
          top: 0,
          left: 0,
          objectFit: capturedImage ? 'contain' : 'cover',
          pointerEvents: 'none'
        }}
      />

      {/* Overlay boutons flottants intégrés pour immersion */}
      {showControls && (
        <motion.div
          className="controls-overlay"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0.8 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            bottom: 20,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            pointerEvents: 'auto',
            zIndex: 20
          }}
        >
          <motion.button
            className="control-button"
            aria-label="Changer caméra"
            onClick={switchCamera}
            whileTap={{ scale: 0.9 }}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <FaExchangeAlt size={24} />
          </motion.button>
          <motion.button
            className="control-button"
            onClick={() => setZoomLevel(z => Math.max(1, z - 0.1))}
            disabled={zoomLevel <= 1}
            aria-label="Zoom arrière"
            whileTap={{ scale: 0.9 }}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              opacity: zoomLevel <= 1 ? 0.5 : 1
            }}
          >
            <BsZoomOut size={24} />
          </motion.button>
          <motion.button
            className="control-button primary"
            onClick={capturedImage ? resumeLiveDetection : capturePhoto}
            aria-label={capturedImage ? 'Revenir à détection' : 'Prendre photo'}
            whileTap={{ scale: 0.9 }}
            style={{
              backgroundColor: 'rgba(255,170,0,0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <FaCamera size={28} />
          </motion.button>
          <motion.button
            className="control-button"
            onClick={() => setZoomLevel(z => Math.min(3, z + 0.1))}
            disabled={zoomLevel >= 3}
            aria-label="Zoom avant"
            whileTap={{ scale: 0.9 }}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              opacity: zoomLevel >= 3 ? 0.5 : 1
            }}
          >
            <BsZoomIn size={24} />
          </motion.button>
          <motion.label
            className="control-button file-upload-label"
            aria-label="Charger image"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <MdPhotoLibrary size={24} />
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
                    setTimeout(() => analyzeCapturedImage(reader.result), 200);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </motion.label>
          <motion.button
            className="control-button"
            aria-label={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
            onClick={toggleFullscreen}
            whileTap={{ scale: 0.9 }}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <BsFullscreen size={24} />
          </motion.button>
        </motion.div>
      )}

      {/* Bouton audio on/off */}
      <motion.button
        className="audio-toggle"
        onClick={() => setAudioEnabled(!audioEnabled)}
        whileTap={{ scale: 0.9 }}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 20
        }}
      >
        {audioEnabled ? <FaVolumeUp size={20} /> : <FaVolumeMute size={20} />}
      </motion.button>

      {/* Détails objets détectés */}
      {selectedObject && (
        <motion.div
          className="object-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="object-detail-title"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          style={{
            position: 'absolute',
            top: 60,
            left: 20,
            right: 20,
            maxWidth: '500px',
            backgroundColor: darkMode ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.9)',
            borderRadius: 8,
            padding: 20,
            zIndex: 30,
            color: darkMode ? 'white' : 'black',
            boxShadow: '0 0 15px rgba(0,0,0,0.4)',
          }}
          onClick={e => e.stopPropagation()}
          onAnimationComplete={() => {
            describeObjectVerbally(selectedObject);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 id="object-detail-title" style={{ margin: 0 }}>
              {selectedObject.icon} {selectedObject.class.replace('custom-', 'YOLO ')}
            </h3>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.6rem',
                cursor: 'pointer',
                color: darkMode ? 'white' : 'black',
              }}
              aria-label="Fermer"
              onClick={() => setSelectedObject(null)}
            >
              &times;
            </button>
          </div>

          <p><strong>Confiance : </strong>{Math.round(selectedObject.score * 100)}%</p>
          <p><strong>Caractéristiques :</strong> {selectedObject.caracteristiques}</p>
          <p><strong>Utilisation :</strong> {selectedObject.utilisation}</p>
          <p><strong>Catégories :</strong> {selectedObject.categories.join(', ')}</p>
          <p><strong>Matériaux :</strong> {selectedObject.materiaux.join(', ')}</p>
          <p><strong>Dimensions Moyennes :</strong></p>
          <pre style={{ 
            overflowX: 'auto', 
            whiteSpace: 'pre-wrap', 
            backgroundColor: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(240,240,240,0.8)',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {JSON.stringify(selectedObject.dimensionsMoyennes, null, 2)}
          </pre>
          <p><strong>Analyse dimensionnelle :</strong></p>
          <pre style={{ 
            overflowX: 'auto', 
            whiteSpace: 'pre-wrap', 
            backgroundColor: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(240,240,240,0.8)',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {JSON.stringify(selectedObject.analyseComplete, null, 2)}
          </pre>
          <p><strong>Potentiel texte :</strong> {selectedObject.analyseTexte?.potentiel}</p>
          <p><strong>Zone texte :</strong> {selectedObject.analyseTexte?.zoneTexte}</p>
          <p><strong>Histoire :</strong> {selectedObject.histoire}</p>
          <p><strong>Conseil :</strong> {selectedObject.conseil}</p>
        </motion.div>
      )}

      {/* Liste simple des objets détectés */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          maxWidth: '250px',
          maxHeight: '70vh',
          overflowY: 'auto',
          backgroundColor: darkMode ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.85)',
          borderRadius: 8,
          padding: 10,
          fontSize: 14,
          zIndex: 25,
          color: darkMode ? 'white' : 'black',
          userSelect: 'none'
        }}
        aria-label="Liste des objets détectés"
      >
        <h4 style={{ marginTop: 0 }}>Objets détectés</h4>
        {predictions.length === 0 && !loadingModel ? (
          <p>En attente de détection...</p>
        ) : (
          <ul style={{ paddingLeft: 15, margin: 0 }}>
            {predictions.map((item, idx) => {
              const isSelected = selectedObject?.class === item.class;
              return (
                <li
                  key={`${item.class}-${idx}`}
                  style={{
                    marginBottom: 6,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#FFAA00AA' : 'transparent',
                    color: isSelected ? 'white' : undefined,
                    padding: '4px 6px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => setSelectedObject(isSelected ? null : item)}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (['Enter', ' '].includes(e.key)) {
                      e.preventDefault();
                      setSelectedObject(isSelected ? null : item);
                    }
                  }}
                >
                  <MdFiberManualRecord
                    size={16}
                    color='#FFAA00'
                    aria-hidden="true"
                  />
                  <strong>{item.class.replace('custom-', 'YOLO ')}</strong> {(item.score * 100).toFixed(1)}%
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Message erreur */}
      {errorMessage && (
        <motion.div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 0, 0, 0.85)',
            padding: '10px 20px',
            borderRadius: 8,
            color: 'white',
            zIndex: 50,
          }}
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <FaInfoCircle style={{ marginRight: 8 }} aria-hidden="true" />
          {errorMessage}
          <button onClick={() => setErrorMessage(null)} style={{ marginLeft: 12, background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }} aria-label="Fermer">
            x
          </button>
        </motion.div>
      )}

      {/* Indicateur de statistiques */}
      <div
        style={{
          position: 'absolute',
          bottom: 90,
          left: 20,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: 4,
          fontSize: 12,
          zIndex: 15
        }}
      >
        <div>Détections YOLO: {detectionStats.yoloDetections}</div>
        <div>FPS: {Math.round(1000 / detectionInterval)}</div>
      </div>

      {/* Styles CSS pour l'animation du loader */}
      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Analyse;

