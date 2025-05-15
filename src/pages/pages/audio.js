import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaSave, FaInfoCircle, FaCog, FaExchangeAlt, FaVolumeUp, FaVolumeMute, FaRobot, FaBrain } from 'react-icons/fa';
import { BsZoomIn, BsZoomOut } from 'react-icons/bs';
import { MdPhotoLibrary, MdOutlineInfo } from 'react-icons/md';
import './Analyse.css';

// On initialise avec un objet vide qui sera remplacé par les données du fichier JSON
let objetInfos = {};

// Tableaux de noms de classes pour le modèle YOLO personnalisé
const YOLO_CLASSES = [
  "personne", "vélo", "voiture", "moto", "avion", "bus", "train", "camion", 
  "bateau", "feu-tricolore", "bouche-incendie", "panneau-stop", "parcmètre", 
  "banc", "oiseau", "chat", "chien", "cheval", "mouton", "vache", "éléphant", 
  "ours", "zèbre", "girafe", "sac-à-dos", "parapluie", "sac-à-main", "cravate", 
  "valise", "frisbee", "skis", "snowboard", "ballon-sport", "cerf-volant", 
  "batte-baseball", "gant-baseball", "skateboard", "planche-surf", "raquette-tennis", 
  "bouteille", "verre-vin", "tasse", "fourchette", "couteau", "cuillère", "bol", 
  "banane", "pomme", "sandwich", "orange", "brocoli", "carotte", "hot-dog", 
  "pizza", "donut", "gâteau", "chaise", "canapé", "plante-en-pot", "lit", 
  "table-à-manger", "toilettes", "téléviseur", "ordinateur-portable", "souris", 
  "télécommande", "clavier", "téléphone", "micro-ondes", "four", "grille-pain", 
  "évier", "réfrigérateur", "livre", "horloge", "vase", "ciseaux", "ours-en-peluche", 
  "sèche-cheveux", "brosse-à-dents", "écouteurs", "clé", "lunettes", "montre", "stylo"
];

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
    // Utiliser notre liste personnalisée de noms de classes pour YOLO si c'est une détection custom
    let className = prediction.class;
    if (className.startsWith('custom-')) {
      const classId = parseInt(className.replace('custom-', ''));
      if (classId >= 0 && classId < YOLO_CLASSES.length) {
        className = YOLO_CLASSES[classId];
      }
    }

    const baseInfo = objetInfos[className] || {
      icon: className.includes('custom-') ? '🔧' : '❓',
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
      class: className, // Utiliser le nom de classe traduit
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
      },
      source: prediction.class.includes('custom-') ? 'YOLO' : 'COCO-SSD'
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
 * Gestion intelligente des commentaires vocaux avec contrôle des délais
 * et voix masculine
 */
class SpeechManager {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.lastMessages = {};
    this.cooldowns = {};
    this.enabled = true;
    this.audioContext = null;
    // Pour la synchronisation audio-vidéo
    this.lastFrameTime = 0;
    this.frameDelayThreshold = 30; // ms
    // Voix préférée (masculine)
    this.preferredVoice = null;
  }

  // Initialisation du contexte audio pour une meilleure synchronisation
  initialize() {
    try {
      // Créer un contexte audio seulement si le navigateur le supporte
      if (window.AudioContext || window.webkitAudioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Initialiser la voix masculine
      this.initializeVoice();
    } catch (error) {
      console.error("Impossible d'initialiser l'AudioContext:", error);
    }
  }
  
  // Recherche et configure une voix masculine en français
  initializeVoice() {
    if (!window.speechSynthesis) return;
    
    // S'assurer que les voix sont chargées
    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Priorité: voix masculine française
        this.preferredVoice = voices.find(voice => 
          voice.lang.includes('fr') && voice.name.toLowerCase().includes('male'));
        
        // Si aucune voix masculine française n'est trouvée, essayer une voix française
        if (!this.preferredVoice) {
          this.preferredVoice = voices.find(voice => voice.lang.includes('fr'));
        }
        
        // Si toujours pas de voix, prendre une voix masculine quelconque
        if (!this.preferredVoice) {
          this.preferredVoice = voices.find(voice => voice.name.toLowerCase().includes('male'));
        }
        
        console.log("Voix sélectionnée:", this.preferredVoice ? this.preferredVoice.name : "Voix par défaut");
      } else {
        // Réessayer si les voix ne sont pas encore chargées
        setTimeout(checkVoices, 100);
      }
    };
    
    // Chrome nécessite un événement, Firefox non
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = checkVoices;
    } else {
      checkVoices();
    }
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

  // Utiliser cette méthode pour ajouter un message à la file d'attente avec contrôle de synchronisation
  speak(text, priority = 1, objectId = null, frameTime = null) {
    if (!this.enabled) return;
    
    // Mise à jour du timestamp de frame pour synchronisation
    if (frameTime) {
      const frameDelay = frameTime - this.lastFrameTime;
      this.lastFrameTime = frameTime;
      
      // Si le délai entre frames est trop grand, on vide la file d'attente
      // pour éviter des commentaires obsolètes
      if (frameDelay > this.frameDelayThreshold && this.queue.length > 0) {
        this.queue = this.queue.filter(item => item.priority >= 3); // Garder uniquement les messages prioritaires
      }
    }
    
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
      this.cooldowns[objectId] = Math.min(5000, cooldown + 500);
    }

    const message = { text, priority, timestamp: Date.now() };
    
    // Ajouter le message à la file dans l'ordre de priorité
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(message);
    } else {
      this.queue.splice(insertIndex, 0, message);
    }
    
    // Limiter la taille de la file pour éviter accumulation
    if (this.queue.length > 5) {
      // Garder les messages prioritaires et les plus récents
      this.queue = this.queue.sort((a, b) => {
        // D'abord par priorité (décroissante)
        if (b.priority !== a.priority) return b.priority - a.priority;
        // Puis par timestamp (croissant - plus récent)
        return b.timestamp - a.timestamp;
      }).slice(0, 5);
    }
    
    this.processQueue();
  }

  // Traite la file de messages avec synchronisation améliorée
  processQueue() {
    if (this.speaking || this.queue.length === 0) return;
    
    const message = this.queue.shift();
    this.speaking = true;
    
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.1; // Légèrement plus rapide pour une expérience plus fluide
    
    // Appliquer la voix masculine si disponible
    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }
    
    // Paramètres pour voix masculine
    utterance.pitch = 0.9; // Légèrement plus grave
    
    // Préparer la synthèse en avance pour réduire la latence
    if (this.audioContext) {
      // Créer un petit son silencieux pour débloquer l'audio si nécessaire
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0; // Volume à zéro (silencieux)
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.001);
    }
    
    utterance.onend = () => {
      this.speaking = false;
      // Attendre un court instant avant de traiter le message suivant
      setTimeout(() => this.processQueue(), 200);
    };
    
    // Gestion des erreurs de synthèse vocale
    utterance.onerror = (event) => {
      console.error("Erreur de synthèse vocale:", event);
      this.speaking = false;
      setTimeout(() => this.processQueue(), 200);
    };
    
    window.speechSynthesis.speak(utterance);
    
    // Vérifier après un délai si la synthèse a commencé
    // Si non, on force la réinitialisation pour éviter le blocage
    setTimeout(() => {
      if (this.speaking && window.speechSynthesis.pending) {
        console.warn("Synthèse vocale bloquée, réinitialisation...");
        window.speechSynthesis.cancel();
        this.speaking = false;
        setTimeout(() => this.processQueue(), 500);
      }
    }, 1000);
  }
}

/**
 * Composant principal d'analyse d'objets en temps réel
 */
const Analyse = () => {
  // Références
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const speechManagerRef = useRef(new SpeechManager());
  const animationFrameRef = useRef(null);

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
  const [lastSceneDescription, setLastSceneDescription] = useState("");
  const [aiLogs, setAiLogs] = useState([]); // État pour les logs d'IA
  const [showAiLogs, setShowAiLogs] = useState(true); // Afficher/masquer les logs

  // Références pour optimisation
  const lastPredictionsRef = useRef([]);
  const objectHistoryRef = useRef({}); // Pour suivre l'historique de chaque objet détecté
  const lastDetectionTimeRef = useRef(0);
  const detectionInterval = detectionMode === "fast" ? 300 : detectionMode === "detail" ? 100 : 200;
  const lastDescriptionTimeRef = useRef(0);
  
  // Fonction pour ajouter des logs
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setAiLogs(prevLogs => {
      // Limiter à 100 logs maximum
      const newLogs = [...prevLogs, { message, type, timestamp }];
      if (newLogs.length > 100) return newLogs.slice(-100);
      return newLogs;
    });
  }, []);
  
  // Appliquer le mode sombre
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Mettre à jour l'état d'activation audio du gestionnaire de parole
  useEffect(() => {
    speechManagerRef.current.setEnabled(audioEnabled);
  }, [audioEnabled]);

  // Initialiser le gestionnaire audio au démarrage
  useEffect(() => {
    speechManagerRef.current.initialize();
    addLog("Initialisation du gestionnaire audio", "system");
    
    // Nettoyer l'animation frame à la fermeture pour éviter les fuites mémoire
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      speechManagerRef.current.cancel();
    };
  }, [addLog]);

  // Optimisation du chargement des modèles et configuration TensorFlow
  useEffect(() => {
    const loadModelsAndData = async () => {
      try {
        setLoadingModel(true);
        addLog("Démarrage du chargement des modèles", "system");
        
        // Configuration TensorFlow optimisée pour GPU
        await tf.ready();
        addLog("TensorFlow.js initialisé", "system");
        
        // Optimisation de la mémoire GPU/WebGL - valeurs à ajuster selon les performances
        tf.env().set('WEBGL_FLUSH_THRESHOLD', 2); // Réduire pour économiser la mémoire GPU
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Utiliser des textures 16-bit pour économiser la mémoire
        tf.env().set('WEBGL_PACK', true); // Activer le packing pour optimiser les calculs
        tf.env().set('WEBGL_LAZILY_UNPACK', true); // Décompresser paresseusement quand nécessaire
        
        // Activer WebGL explicitement
        await tf.setBackend('webgl');
        addLog(`Backend TensorFlow.js: ${tf.getBackend()}`, "success");
        
        // Chargement dynamique du fichier JSON avec les données des objets
        addLog("Chargement des données des objets...", "system");
        const module = await import('./objetInfos.json');
        objetInfos = module.default;
        addLog("Données des objets chargées avec succès", "success");
        
        // Chargement des modèles en parallèle
        addLog("Chargement des modèles d'IA...", "system");
        
        const modelPromises = [
          cocoSsd.load({
            base: detectionMode === "fast" ? "lite_mobilenet_v2" : "mobilenet_v2"
          })
        ];
        
        // Ajouter le chargement YOLO à la liste des promesses
        try {
          addLog("Tentative de chargement du modèle YOLO personnalisé...", "system");
          modelPromises.push(tf.loadGraphModel('/models/lifemodo_tfjs/model.json'));
        } catch (error) {
          addLog("Modèle YOLO non disponible, continuons sans lui", "warning");
        }
        
        // Attendre que tous les modèles soient chargés
        const loadedModels = await Promise.allSettled(modelPromises);
        
        // Stocker les modèles dans la référence
        modelRef.current = {
          cocoModel: loadedModels[0].status === 'fulfilled' ? loadedModels[0].value : null,
          yoloModel: loadedModels.length > 1 && loadedModels[1].status === 'fulfilled' ? loadedModels[1].value : null,
          customModelLoaded: loadedModels.length > 1 && loadedModels[1].status === 'fulfilled',
          createdAt: new Date()
        };
        
        if (!modelRef.current.cocoModel) {
          throw new Error("Impossible de charger le modèle COCO-SSD");
        }
        
        addLog("Modèle COCO-SSD chargé avec succès", "success");
        
        if (modelRef.current.yoloModel) {
          addLog("Modèle YOLO personnalisé chargé avec succès", "success");
        }
        
        setLoadingModel(false);
        
        // Message de bienvenue avec délai pour assurer la disponibilité audio
        setTimeout(() => {
          speechManagerRef.current.speak("Système d'analyse d'objets prêt à l'emploi. Je suis votre assistant de détection visuelle.", 3);
          addLog("Système d'IA prêt à détecter les objets", "success");
        }, 500);
      } catch (error) {
        console.error("Erreur lors du chargement:", error);
        addLog(`ERREUR: ${error.message}`, "error");
        setErrorMessage(`Impossible de charger les données ou les modèles d'IA. ${error.message || "Veuillez vérifier votre connexion internet et recharger l'application."}`);
        setLoadingModel(false);
      }
    };
    
    loadModelsAndData();
    
    return () => {
      // Nettoyage à la fermeture
      speechManagerRef.current.cancel();
      addLog("Nettoyage des ressources...", "system");
      // Libérer explicitement la mémoire TensorFlow
      if (tf.getBackend() === 'webgl') {
        // @ts-ignore
        const gl = tf.backend().getGPGPUContext().gl;
        if (gl && typeof gl.getExtension === 'function') {
          // Forcer la libération des ressources WebGL
          const loseContextExt = gl.getExtension('WEBGL_lose_context');
          if (loseContextExt) loseContextExt.loseContext();
        }
      }
    };
  }, [detectionMode, addLog]);
  
  /**
   * Génère une description de la scène à partir des objets détectés,
   * optimisée pour la synchronisation
   */
  const generateSceneDescription = useCallback((enhancedPredictions, newSceneDetected, frameTime) => {
    if (!audioEnabled || enhancedPredictions.length === 0) return;
    
    const now = Date.now();
    // Limiter la fréquence des descriptions générales
    const descriptionCooldown = 5000; // 5 secondes
    
    // Si pas assez de temps depuis la dernière description
    if (now - lastDescriptionTimeRef.current < descriptionCooldown && !newSceneDetected) {
      return;
    }
    
    // Descriptions individuelles pour les objets significatifs (score élevé)
    enhancedPredictions.forEach((prediction, index) => {
      const objectId = `${prediction.class}-${index}`;
      const objectHistory = objectHistoryRef.current[objectId] || { 
        firstSeen: now, 
        lastDescribed: 0,
        detectionCount: 0,
        confidence: [] 
      };
      
      // Mettre à jour l'historique de l'objet
      objectHistory.detectionCount++;
      objectHistory.confidence.push(prediction.score);
      if (objectHistory.confidence.length > 5) objectHistory.confidence.shift(); // Garder les 5 dernières valeurs
      
      // Calculer la confiance moyenne
      const avgConfidence = objectHistory.confidence.reduce((a, b) => a + b, 0) / objectHistory.confidence.length;
      const isNewObject = objectHistory.detectionCount <= 3;
      const isStableObject = objectHistory.detectionCount > 5 && avgConfidence > 0.7;
      const timeSinceLastDescription = now - objectHistory.lastDescribed;
      
      // Décider si on doit parler de cet objet
      const shouldDescribe = 
        (isNewObject && prediction.score > 0.7) || // Nouvel objet avec haute confiance
        (isStableObject && timeSinceLastDescription > 10000) || // Objet stable mais pas décrit depuis longtemps
        (newSceneDetected && index < 2 && prediction.score > 0.6); // Un des 2 principaux objets dans une nouvelle scène
        
      if (shouldDescribe) {
        // Créer une description plus riche basée sur les infos disponibles
        let description = `${prediction.class} détecté`;
        
        // Ajouter des détails sur la position/taille
        const analysis = analyserDimensionsObjets(prediction, 640, 480); // Valeurs par défaut
        description += `, ${analysis.distanceEstimee}`;
        
        // Ajouter des caractéristiques de l'objet si disponibles
        if (prediction.caracteristiques && prediction.caracteristiques !== "Informations non disponibles dans notre base de connaissances.") {
          const shortDesc = prediction.caracteristiques.split('.')[0]; // Juste la première phrase
          description += `. ${shortDesc}`;
        }
        
        // Ajouter un conseil si disponible et pertinent
        if (prediction.conseil && prediction.conseil !== "Aucun conseil disponible" && Math.random() > 0.7) {
          description += `. ${prediction.conseil}`;
        }
        
        // Parler avec une priorité basée sur la confiance et la nouveauté
        const priority = isNewObject ? 2 : 1;
        speechManagerRef.current.speak(description, priority, objectId, frameTime);
        
        // Ajouter aux logs
        addLog(`Détection: ${prediction.class} (${Math.round(prediction.score * 100)}%) - ${prediction.source}`, 
               prediction.score > 0.7 ? "success" : "info");
        
        // Mettre à jour quand cet objet a été décrit pour la dernière fois
        objectHistory.lastDescribed = now;
      }
      
      // Sauvegarder l'historique mis à jour
      objectHistoryRef.current[objectId] = objectHistory;
    });
    
    // Génération de description globale de la scène si nécessaire
    if (newSceneDetected && enhancedPredictions.length > 1) {
      const topObjects = enhancedPredictions
        .filter(p => p.score > 0.6)
        .slice(0, 3)
        .map(p => p.class);
      
      if (topObjects.length > 1) {
        const sceneDesc = `Je vois ${topObjects.join(', ')}`;
        
        // Ne pas répéter la même description
        if (sceneDesc !== lastSceneDescription) {
          setLastSceneDescription(sceneDesc);
          speechManagerRef.current.speak(sceneDesc, 1.5, null, frameTime);
          addLog(`Scène: ${sceneDesc}`, "highlight");
          lastDescriptionTimeRef.current = now;
        }
      }
    }
  }, [audioEnabled, addLog]);
  
  /**
   * Fonction principale de détection d'objets et dessin
   * Optimisée pour la performance et la synchronisation
   */
  const detectFrame = useCallback(async () => {
    // Vérification des prérequis
    if (
      !isDetecting || 
      !modelRef.current?.cocoModel || 
      !webcamRef.current?.video || 
      webcamRef.current.video.readyState !== 4
    ) {
      animationFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // Limiter la fréquence de détection
    const now = performance.now();
    if (now - lastDetectionTimeRef.current < detectionInterval) {
      animationFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastDetectionTimeRef.current = now;

    try {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      
      const ctx = canvas.getContext('2d');

      // Ajuster le canvas aux dimensions de la vidéo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Capture du timestamp pour synchronisation
      const frameTimestamp = performance.now();

      // Traitement des prédictions dans une fonction séparée pour permettre
      // l'utilisation de async/await sans bloquer le rendu
      const processPredictions = async () => {
        try {
          // Création directe d'un tenseur à partir de la vidéo pour optimiser
          const videoTensor = tf.browser.fromPixels(video);
          
          // Obtenir les prédictions COCO-SSD
          const startTime = performance.now();
          const cocoPredictions = await modelRef.current.cocoModel.detect(videoTensor);
          const cocoTime = performance.now() - startTime;
          
          // Log de performance COCO
          if (cocoPredictions.length > 0) {
            addLog(`COCO-SSD: ${cocoPredictions.length} objets en ${cocoTime.toFixed(0)}ms`, "performance");
          }
          
          // Libérer le tenseur après utilisation
          videoTensor.dispose();
          
          // Tableau pour stocker toutes les prédictions
          let allPredictions = [...cocoPredictions];
    
          // Ajouter les prédictions YOLO si le modèle est disponible
          if (modelRef.current.yoloModel) {
            try {
              // Préparation de l'entrée pour YOLO
              const yoloStartTime = performance.now();
              const inputTensor = tf.browser.fromPixels(video)
                .resizeNearestNeighbor([640, 640])
                .expandDims()
                .div(255.0);
    
              // Exécuter l'inférence YOLO
              const yoloOutput = await modelRef.current.yoloModel.executeAsync(inputTensor);
              
              // Nettoyer le tenseur d'entrée pour éviter les fuites mémoire
              inputTensor.dispose();
              
              // Traiter la sortie du modèle YOLO
              const yoloData = await yoloOutput[0].array();
              
              // S'assurer que yoloOutput est bien un tableau et dispose tous les tenseurs
              if (Array.isArray(yoloOutput)) {
                yoloOutput.forEach(tensor => tensor.dispose());
              } else {
                yoloOutput.dispose();
              }
              
              // Récupérer les prédictions brutes
              const yoloRawPredictions = yoloData[0];
              let yoloDetectionCount = 0;
              
              // Convertir les prédictions YOLO au format compatible
              for (let i = 0; i < yoloRawPredictions.length; i++) {
                const [x, y, w, h, score, classId] = yoloRawPredictions[i];
                
                // Ne garder que les prédictions avec un score suffisant
                if (score > 0.5) {
                  // Convertir au format attendu par le reste du code
                  allPredictions.push({
                    bbox: [
                      (x - w/2) * video.videoWidth, 
                      (y - h/2) * video.videoHeight,
                      w * video.videoWidth, 
                      h * video.videoHeight
                    ],
                    class: `custom-${Math.round(classId)}`, 
                    score
                  });
                  yoloDetectionCount++;
                }
              }
              
              const yoloTime = performance.now() - yoloStartTime;
              
              // Log de performance YOLO
              if (yoloDetectionCount > 0) {
                addLog(`YOLO: ${yoloDetectionCount} objets en ${yoloTime.toFixed(0)}ms`, "performance");
              }
              
            } catch (yoloError) {
              console.error("Erreur lors de l'inférence YOLO:", yoloError);
              addLog(`Erreur YOLO: ${yoloError.message}`, "error");
              // Continuer avec seulement les prédictions COCO-SSD en cas d'erreur
            }
          }
          
          // Filtrer par seuil de confiance et trier
          const filteredPredictions = allPredictions
            .filter(prediction => prediction.score > 0.35)
            .sort((a, b) => b.score - a.score);
            
          // Enrichir les prédictions
          const enhancedPredictions = enrichPredictions(filteredPredictions);
          
          // Vérifier si changement significatif
          const lastPredClasses = lastPredictionsRef.current
            .map(p => `${p.class}-${p.score.toFixed(2)}`)
            .sort()
            .join(',');
            
          const newPredClasses = enhancedPredictions
            .map(p => `${p.class}-${p.score.toFixed(2)}`)
            .sort()
            .join(',');
          
          // Détecter si la scène a changé significativement
          const isNewScene = lastPredClasses.split(',').length !== newPredClasses.split(',').length || 
            (lastPredClasses.length > 0 && 
             newPredClasses.length > 0 && 
             !lastPredClasses.includes(newPredClasses.split(',')[0]));
          
          if (lastPredClasses !== newPredClasses) {
            // Mise à jour des états
            setPredictions(enhancedPredictions);
            lastPredictionsRef.current = enhancedPredictions;
            
            // Analyser les dimensions des objets
            const newAnalyses = {};
            enhancedPredictions.forEach(pred => {
              const objectId = `${pred.class}-${Math.random().toString(36).substring(2, 7)}`;
              newAnalyses[objectId] = {
                ...pred,
                analyseComplete: analyserDimensionsObjets(pred, video.videoWidth, video.videoHeight),
                horodatage: new Date().toISOString()
              };
            });
            
            setObjectAnalyses(prev => ({...prev, ...newAnalyses}));
            
            // Générer des descriptions audio des objets détectés avec le timestamp pour synchronisation
            generateSceneDescription(enhancedPredictions, isNewScene, frameTimestamp);
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
            ctx.strokeStyle = isSelected ? '#FF3366' : prediction.source === 'YOLO' ? '#36BBFF' : '#00FFFF';
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
            const modelText = prediction.source || "IA";
            const textWidth = ctx.measureText(text).width + 20;
            const bubbleHeight = 30;

            ctx.fillStyle = isSelected ? 'rgba(255, 51, 102, 0.8)' : 
                           prediction.source === 'YOLO' ? 'rgba(54, 187, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';

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
            
            // Ajouter badge indiquant la source du modèle
            ctx.fillStyle = prediction.source === 'YOLO' ? 'rgba(0, 100, 200, 0.9)' : 'rgba(50, 50, 50, 0.9)';
            const modelBadgeWidth = ctx.measureText(modelText).width + 8;
            const modelBadgeHeight = 20;
            
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(
                x + width - modelBadgeWidth,
                y,
                modelBadgeWidth,
                modelBadgeHeight,
                5
              );
            } else {
              ctx.fillRect(
                x + width - modelBadgeWidth,
                y,
                modelBadgeWidth,
                modelBadgeHeight
              );
            }
            ctx.fill();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(
              modelText,
              x + width - modelBadgeWidth + 4,
              y + 15
            );
          });
        } catch (error) {
          console.error("Erreur pendant le traitement des prédictions:", error);
          addLog(`Erreur de traitement: ${error.message}`, "error");
        }
      };

      // Lancer le traitement des prédictions
      processPredictions();
      
      // Dessiner la vidéo directement (sans attendre les prédictions) pour plus de fluidité
      // si les filtres ne sont pas appliqués
      if (brightness === 100 && zoomLevel === 1) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    } catch (error) {
      console.error("Erreur pendant la détection:", error);
      addLog(`Erreur de détection: ${error.message}`, "error");
    }

    // Boucle de détection continue avec requestAnimationFrame pour meilleures performances
    animationFrameRef.current = requestAnimationFrame(detectFrame);
  }, [isDetecting, selectedObject, zoomLevel, brightness, detectionInterval, generateSceneDescription, addLog]);

  // Démarrer la détection une fois le modèle chargé
  useEffect(() => {
    if (!loadingModel) {
      // Utiliser une promesse pour s'assurer que le premier frame est rendu avant
      // de commencer l'analyse, pour une meilleure synchronisation
      Promise.resolve().then(() => {
        detectFrame();
      });
    }
    
    return () => {
      // Nettoyer l'animation frame à la fermeture
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
        speechManagerRef.current.speak("Photo capturée", 2);
        addLog("Photo capturée pour analyse", "info");
      }
    }
  };

  /**
   * Analyse une image capturée ou chargée
   */
  const analyzeImage = async () => {
    if (!capturedImage || !modelRef.current?.cocoModel) return;

    try {
      speechManagerRef.current.speak("Analyse de l'image en cours", 2);
      addLog("Démarrage de l'analyse d'image", "info");
      
      const img = new Image();
      img.crossOrigin = "anonymous"; // Évite les erreurs CORS
      img.src = capturedImage;

      // Attendre que l'image soit chargée
      await new Promise(resolve => { img.onload = resolve; });

      // Tableau pour stocker toutes les prédictions
      let allPredictions = [];

      // Utiliser un tenseur pour optimiser l'analyse
      const imgTensor = tf.browser.fromPixels(img);
      
      // COCO-SSD predictions
      const startTime = performance.now();
      const cocoPredictions = await modelRef.current.cocoModel.detect(imgTensor);
      const cocoTime = performance.now() - startTime;
      
      allPredictions = [...cocoPredictions];
      addLog(`COCO-SSD: ${cocoPredictions.length} objets en ${cocoTime.toFixed(0)}ms`, "performance");
      
      // Libérer le tenseur image après l'analyse COCO
      imgTensor.dispose();
      
      // YOLO predictions si disponibles
      if (modelRef.current.yoloModel) {
        try {
          const yoloStartTime = performance.now();
          const inputTensor = tf.browser.fromPixels(img)
            .resizeNearestNeighbor([640, 640])
            .expandDims()
            .div(255.0);

          const yoloOutput = await modelRef.current.yoloModel.executeAsync(inputTensor);
          
          // Libérer la mémoire
          inputTensor.dispose();
          
          const yoloData = await yoloOutput[0].array();
          
          // Libérer les tenseurs
          if (Array.isArray(yoloOutput)) {
            yoloOutput.forEach(tensor => tensor.dispose());
          } else {
            yoloOutput.dispose();
          }
          
          const yoloRawPredictions = yoloData[0];
          let yoloDetectionCount = 0;

          // Convertir les prédictions YOLO au format compatible
          for (let i = 0; i < yoloRawPredictions.length; i++) {
            const [x, y, w, h, score, classId] = yoloRawPredictions[i];
            if (score > 0.5) {
              allPredictions.push({
                bbox: [
                  (x - w/2) * img.width, 
                  (y - h/2) * img.height,
                  w * img.width, 
                  h * img.height
                ],
                class: `custom-${Math.round(classId)}`, 
                score
              });
              yoloDetectionCount++;
            }
          }
          
          const yoloTime = performance.now() - yoloStartTime;
          addLog(`YOLO: ${yoloDetectionCount} objets en ${yoloTime.toFixed(0)}ms`, "performance");
        } catch (yoloError) {
          console.error("Erreur lors de l'inférence YOLO sur image:", yoloError);
          addLog(`Erreur YOLO: ${yoloError.message}`, "error");
        }
      }

      const enhancedPredictions = enrichPredictions(allPredictions.filter(p => p.score > 0.5));
      setPredictions(enhancedPredictions);
      
      // Ajouter les objets détectés aux analyses
      const newAnalyses = {};
      enhancedPredictions.forEach(pred => {
        const objectId = `${pred.class}-${Math.random().toString(36).substring(2, 7)}`;
        newAnalyses[objectId] = {
          ...pred,
          analyseComplete: analyserDimensionsObjets(pred, img.width, img.height),
          horodatage: new Date().toISOString()
        };
      });
      setObjectAnalyses(prev => ({...prev, ...newAnalyses}));
      
      addLog(`Analyse complète: ${enhancedPredictions.length} objets identifiés`, "success");

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

        ctx.strokeStyle = prediction.source === 'YOLO' ? '#36BBFF' : '#00FFFF';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = prediction.source === 'YOLO' ? 'rgba(54, 187, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y > 20 ? y - 25 : y + height, width, 25);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.fillText(
          `${prediction.class} ${(prediction.score * 100).toFixed(0)}%`,
          x + 5,
          y > 20 ? y - 7 : y + height + 18
        );
        
        // Badge du modèle
        const modelText = prediction.source || "IA";
        ctx.fillStyle = prediction.source === 'YOLO' ? 'rgba(0, 100, 200, 0.9)' : 'rgba(50, 50, 50, 0.9)';
        const modelBadgeWidth = ctx.measureText(modelText).width + 8;
        ctx.fillRect(x + width - modelBadgeWidth, y, modelBadgeWidth, 20);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(modelText, x + width - modelBadgeWidth + 4, y + 15);
      });
      
      // Résumé audio des objets détectés
      if (enhancedPredictions.length > 0) {
        const objectsText = enhancedPredictions.length === 1 
          ? `1 objet détecté: ${enhancedPredictions[0].class}`
          : `${enhancedPredictions.length} objets détectés: ${enhancedPredictions.slice(0, 3).map(p => p.class).join(', ')}`;
          
        speechManagerRef.current.speak(objectsText, 2);
      } else {
        speechManagerRef.current.speak("Aucun objet n'a été détecté dans cette image", 2);
        addLog("Aucun objet détecté dans l'image", "warning");
      }
    } catch (error) {
      console.error("Erreur lors de l'analyse de l'image:", error);
      setErrorMessage("Erreur lors de l'analyse de l'image");
      addLog(`Erreur d'analyse: ${error.message}`, "error");
      speechManagerRef.current.speak("Erreur lors de l'analyse de l'image", 3);
    } finally {
      // Forcer un collecteur de mémoire pour libérer les ressources
      tf.engine().endScope();
      if (tf.memory().numTensors > 0) {
        console.log(`Tenseurs restants: ${tf.memory().numTensors}`);
        addLog(`Nettoyage mémoire: ${tf.memory().numTensors} tenseurs libérés`, "system");
        tf.disposeVariables();
      }
    }
  };

  /**
   * Retour au mode de détection en direct
   */
  const resumeLiveDetection = () => {
    setCapturedImage(null);
    setIsDetecting(true);
    speechManagerRef.current.speak("Retour au mode de détection en direct", 2);
    addLog("Retour au mode de détection en direct", "info");
  };

  /**
   * Change la caméra (avant/arrière sur mobile)
   */
  const switchCamera = () => {
    const newMode = cameraFacingMode === "user" ? "environment" : "user";
    setCameraFacingMode(newMode);
    speechManagerRef.current.speak(`Caméra ${newMode === "user" ? "avant" : "arrière"} activée`, 2);
    addLog(`Changement de caméra: ${newMode === "user" ? "avant" : "arrière"}`, "info");
  };
  
  /**
   * Création d'une description détaillée d'un objet pour l'audio
   */
  const describeObjectVerbally = (object) => {
    if (!audioEnabled || !object) return;
    
    // Construire une description complète basée sur toutes les informations disponibles
    let description = `${object.class} détecté avec ${Math.round(object.score * 100)}% de certitude. `;
    
    // Ajouter l'origine du modèle
    if (object.source) {
      description += `Détecté par le modèle ${object.source}. `;
    }
    
    // Ajouter des informations sur les caractéristiques si disponibles
    if (object.caracteristiques && object.caracteristiques !== "Informations non disponibles dans notre base de connaissances.") {
      description += `${object.caracteristiques} `;
    }
    
    // Ajouter l'utilisation si disponible
    if (object.utilisation && object.utilisation !== "Utilisation non spécifiée.") {
      description += `Utilisation: ${object.utilisation} `;
    }
    
    // Ajouter l'analyse dimensionnelle
    if (object.analyseComplete) {
      const analyse = object.analyseComplete;
      description += `Cet objet semble être ${analyse.distanceEstimee} et occupe environ ${analyse.proportionImage.surface} de l'image. `;
    }
    
    // Ajouter un conseil pratique à la fin si disponible
    if (object.conseil && object.conseil !== "Aucun conseil disponible.") {
      description += `Conseil: ${object.conseil}`;
    }
    
    speechManagerRef.current.speak(description, 3);
    addLog(`Description verbale: ${object.class}`, "info");
  };
  
  /**
   * Afficher ou masquer la boîte de logs
   */
  const toggleAiLogs = () => {
    setShowAiLogs(prev => !prev);
    addLog("Affichage des logs " + (showAiLogs ? "désactivé" : "activé"), "system");
  };
  
  /**
   * Effacer les logs d'IA
   */
  const clearAiLogs = () => {
    setAiLogs([]);
    addLog("Logs effacés", "system");
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
                  videoConstraints={{ 
                    facingMode: cameraFacingMode, 
                    aspectRatio: 4 / 3,
                    // Optimisation des paramètres vidéo pour meilleures performances
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                  }}
                  className="webcam"
                  style={{ filter: `brightness(${brightness}%)`, transform: `scale(${zoomLevel})` }}
                  onLoadedMetadata={() => {
                    console.log("Caméra initialisée");
                    addLog("Caméra initialisée", "success");
                    // Précharger l'audio pour réduire la latence
                    if (audioEnabled) {
                      speechManagerRef.current.initialize();
                    }
                  }}
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
                onAnimationComplete={() => {
                  // Décrire verbalement l'objet une fois que l'animation est terminée
                  describeObjectVerbally(selectedObject);
                }}
              >
                <div className="object-detail-card">
                  <div className="object-header">
                    <div className="object-title">
                      <span className="object-icon" aria-hidden="true">{selectedObject.icon}</span>
                      <h3 id="object-detail-title">{selectedObject.class}</h3>
                      {selectedObject.source && (
                        <span className={`model-badge ${selectedObject.source.toLowerCase()}`}>
                          {selectedObject.source}
                        </span>
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
                    
                    <div className="detail-section">
                      <h4>Informations techniques</h4>
                      <p><strong>Source:</strong> {selectedObject.source || "Modèle standard"}</p>
                      <p><strong>Détecté à:</strong> {new Date(selectedObject.detectedAt).toLocaleString()}</p>
                      <p><strong>Certitude:</strong> {selectedObject.certainty}</p>
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

            <motion.button
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={() => setAudioEnabled(prev => !prev)}
              title={audioEnabled ? "Désactiver l'audio" : "Activer l'audio"}
              aria-label={audioEnabled ? "Désactiver l'audio" : "Activer l'audio"}
            >
              {audioEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={toggleAiLogs}
              title={showAiLogs ? "Masquer les logs IA" : "Afficher les logs IA"}
              aria-label={showAiLogs ? "Masquer les logs IA" : "Afficher les logs IA"}
            >
              <FaRobot />
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
                      addLog(`Image chargée: ${file.name}`, "info");
                      // Utiliser setTimeout pour s'assurer que l'état est mis à jour
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
                  speechManagerRef.current.speak("Image sauvegardée dans votre galerie", 2);
                  addLog("Image sauvegardée", "success");
                }}
                className="control-button"
                aria-label="Sauvegarder l'image"
              >
                <FaSave /> Sauvegarder l'image
              </motion.button>
            </div>
          )}
          {/* Logs d'IA */}
          <AnimatePresence>
            {showAiLogs && (
              <motion.div 
                className="ai-logs-container"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="ai-logs-header">
                  <h3>
                    <FaBrain className="logs-icon" /> 
                    Logs d'IA
                  </h3>
                  <div className="log-controls">
                    <button onClick={clearAiLogs} className="clear-logs-btn" title="Effacer les logs">
                      Effacer
                    </button>
                    <button onClick={toggleAiLogs} className="close-logs-btn" title="Fermer les logs">
                      Fermer
                    </button>
                  </div>
                </div>
                <div className="ai-logs-content">
                  {aiLogs.length === 0 ? (
                    <p className="no-logs">Aucun log pour le moment</p>
                  ) : (
                    aiLogs.map((log, i) => (
                      <div key={i} className={`log-entry ${log.type}`}>
                        <span className="log-time">{log.timestamp}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Liste des objets détectés */}
        <div className="detection-results" role="complementary" aria-label="Liste des objets détectés">
          <AnimatePresence>
            <motion.div 
              className="results-container"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="results-header">
                <h2 className="results-title">Objets Détectés</h2>
                <div className="detection-mode-controls">
                  <select
                    value={detectionMode}
                    onChange={(e) => setDetectionMode(e.target.value)}
                    className="detection-mode-select"
                    title="Mode de détection"
                    aria-label="Sélectionner le mode de détection"
                  >
                    <option value="fast">Mode rapide</option>
                    <option value="normal">Mode équilibré</option>
                    <option value="detail">Mode détaillé</option>
                  </select>
                  <button 
                    onClick={() => setDarkMode(prev => !prev)}
                    className="theme-toggle-button"
                    aria-label={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}
                  >
                    {darkMode ? "☀️" : "🌙"}
                  </button>
                </div>
              </div>

              <div className="results-content">
                {predictions.length === 0 ? (
                  <div className="no-detections">
                    <MdOutlineInfo size={48} className="no-detect-icon" />
                    <p>Aucun objet détecté pour le moment</p>
                    <p className="hint">Dirigez la caméra vers un objet...</p>
                  </div>
                ) : (
                  <motion.ul className="detection-list">
                    <AnimatePresence>
                      {predictions.map((prediction, index) => (
                        <motion.li
                          key={`${prediction.class}-${index}`}
                          className={`detection-item ${selectedObject && selectedObject.class === prediction.class ? 'selected' : ''}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedObject(prediction)}
                        >
                          <div className="detection-icon">{prediction.icon}</div>
                          <div className="detection-info">
                            <div className="detection-top">
                              <h3 className="detection-name">{prediction.class}</h3>
                              {prediction.source && (
                                <span className={`model-badge small ${prediction.source.toLowerCase()}`}>
                                  {prediction.source}
                                </span>
                              )}
                            </div>
                            <div className="detection-confidence">
                              <div className="confidence-bar">
                                <div 
                                  className="confidence-level" 
                                  style={{ 
                                    width: `${prediction.score * 100}%`,
                                    backgroundColor:
                                      prediction.score > 0.7
                                        ? '#4CAF50'
                                        : prediction.score > 0.5
                                          ? '#FFC107'
                                          : '#F44336'
                                  }}
                                ></div>
                              </div>
                              <span className="confidence-value">{(prediction.score * 100).toFixed(0)}%</span>
                            </div>
                            <p className="detection-category">
                              {prediction.categories[0] !== "non classifié" 
                                ? prediction.categories[0]
                                : "Catégorie non définie"}
                            </p>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Menu de paramètres */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              className="settings-panel"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-labelledby="settings-title"
              aria-modal="true"
            >
              <div className="settings-header">
                <h2 id="settings-title">Paramètres</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="close-settings"
                  aria-label="Fermer les paramètres"
                >×</button>
              </div>

              <div className="settings-body">
                <div className="settings-section">
                  <h3>Apparence</h3>
                  <div className="settings-option">
                    <span>Mode sombre</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={darkMode}
                        onChange={() => setDarkMode(prev => !prev)}
                        aria-label="Activer le mode sombre"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="settings-option">
                    <span>Luminosité</span>
                    <div className="settings-slider">
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={brightness}
                        onChange={e => setBrightness(parseInt(e.target.value))}
                        aria-label="Ajuster la luminosité"
                      />
                      <span>{brightness}%</span>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Détection</h3>
                  <div className="settings-option">
                    <span>Mode de détection</span>
                    <select
                      value={detectionMode}
                      onChange={e => setDetectionMode(e.target.value)}
                      aria-label="Sélectionner le mode de détection"
                    >
                      <option value="fast">Rapide (performance)</option>
                      <option value="normal">Équilibré</option>
                      <option value="detail">Détaillé (précision)</option>
                    </select>
                  </div>

                  <div className="settings-option">
                    <span>Audio descriptif</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={audioEnabled}
                        onChange={() => setAudioEnabled(prev => !prev)}
                        aria-label="Activer l'audio descriptif"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Avancé</h3>
                  <div className="settings-option">
                    <span>Analyse cloud (expérimental)</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={enableCloudAnalysis}
                        onChange={() => setEnableCloudAnalysis(prev => !prev)}
                        aria-label="Activer l'analyse cloud"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="settings-option">
                    <span>Modèle YOLO personnalisé</span>
                    <div className="model-status">
                      {modelRef.current?.customModelLoaded ? (
                        <span className="status-active">Actif</span>
                      ) : (
                        <span className="status-inactive">Non disponible</span>
                      )}
                    </div>
                  </div>

                  <div className="settings-option">
                    <span>Afficher les logs IA</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={showAiLogs}
                        onChange={toggleAiLogs}
                        aria-label="Afficher les logs d'IA"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-info">
                  <p>
                    Modèle IA: {modelRef.current?.customModelLoaded ? 'COCO-SSD & YOLO personnalisé' : 'COCO-SSD'}
                    <br />
                    Version: 1.0.0
                    <br />
                    <small>
                      Powered by TensorFlow.js - {tf.getBackend ? tf.getBackend() : 'webgl'} backend
                    </small>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bouton flottant pour les paramètres */}
      <motion.button
        className="settings-button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowSettings(true)}
        title="Paramètres"
        aria-label="Ouvrir les paramètres"
      >
        <FaCog size={24} />
      </motion.button>
    </div>
  );
};

export default Analyse;

