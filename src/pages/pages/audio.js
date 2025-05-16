import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaSave, FaInfoCircle, FaCog, FaExchangeAlt, FaVolumeUp, FaVolumeMute, FaRobot, FaBrain } from 'react-icons/fa';
import { BsZoomIn, BsZoomOut } from 'react-icons/bs';
import { MdPhotoLibrary, MdOutlineInfo } from 'react-icons/md';
import { saveAs } from 'file-saver';
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

// Table de correspondance entre les noms anglais du modèle COCO-SSD et les noms français
const COCO_TO_FRENCH = {
  "person": "personne",
  "bicycle": "vélo",
  "car": "voiture",
  "motorcycle": "moto",
  "airplane": "avion",
  "bus": "bus",
  "train": "train",
  "truck": "camion",
  "boat": "bateau",
  "traffic light": "feu-tricolore",
  "fire hydrant": "bouche-incendie",
  "stop sign": "panneau-stop",
  "parking meter": "parcmètre",
  "bench": "banc",
  "bird": "oiseau",
  "cat": "chat",
  "dog": "chien",
  "horse": "cheval",
  "sheep": "mouton",
  "cow": "vache",
  "elephant": "éléphant",
  "bear": "ours",
  "zebra": "zèbre",
  "giraffe": "girafe",
  "backpack": "sac-à-dos",
  "umbrella": "parapluie",
  "handbag": "sac-à-main",
  "tie": "cravate",
  "suitcase": "valise",
  "frisbee": "frisbee",
  "skis": "skis",
  "snowboard": "snowboard",
  "sports ball": "ballon-sport",
  "kite": "cerf-volant",
  "baseball bat": "batte-baseball",
  "baseball glove": "gant-baseball",
  "skateboard": "skateboard",
  "surfboard": "planche-surf",
  "tennis racket": "raquette-tennis",
  "bottle": "bouteille",
  "wine glass": "verre-vin",
  "cup": "tasse",
  "fork": "fourchette",
  "knife": "couteau",
  "spoon": "cuillère",
  "bowl": "bol",
  "banana": "banane",
  "apple": "pomme",
  "sandwich": "sandwich",
  "orange": "orange",
  "broccoli": "brocoli",
  "carrot": "carotte",
  "hot dog": "hot-dog",
  "pizza": "pizza",
  "donut": "donut",
  "cake": "gâteau",
  "chair": "chaise",
  "couch": "canapé",
  "potted plant": "plante-en-pot",
  "bed": "lit",
  "dining table": "table-à-manger",
  "toilet": "toilettes",
  "tv": "téléviseur",
  "laptop": "ordinateur-portable",
  "mouse": "souris",
  "remote": "télécommande",
  "keyboard": "clavier",
  "cell phone": "téléphone",
  "microwave": "micro-ondes",
  "oven": "four",
  "toaster": "grille-pain",
  "sink": "évier",
  "refrigerator": "réfrigérateur",
  "book": "livre",
  "clock": "horloge",
  "vase": "vase",
  "scissors": "ciseaux",
  "teddy bear": "ours-en-peluche",
  "hair drier": "sèche-cheveux",
  "toothbrush": "brosse-à-dents",
  "computer": "ordinateur",
  "tree": "arbre"
};

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
 * Traduit les noms des classes COCO-SSD en français
 * @param {string} englishClass - Nom de classe en anglais
 * @returns {string} - Nom de classe en français
 */
const translateClassName = (englishClass) => {
  return COCO_TO_FRENCH[englishClass] || englishClass;
};

/**
 * Enrichit les prédictions de l'IA avec des informations supplémentaires
 * @param {Array} predictions - Prédictions brutes du modèle COCO-SSD
 * @returns {Array} - Prédictions enrichies avec données additionnelles
 */
const enrichPredictions = (predictions) => {
  return predictions.map(prediction => {
    // Déterminer si la prédiction vient du modèle YOLO ou COCO et traduire si nécessaire
    let className = prediction.class;
    let translatedClass = className;
    
    if (className.startsWith('custom-')) {
      // Utiliser notre liste personnalisée de noms de classes pour YOLO
      const classId = parseInt(className.replace('custom-', ''));
      if (classId >= 0 && classId < YOLO_CLASSES.length) {
        translatedClass = YOLO_CLASSES[classId];
      }
    } else {
      // Traduire les classes COCO-SSD
      translatedClass = translateClassName(className);
    }

    // On essaie d'abord de trouver la classe traduite dans objetInfos
    let baseInfo = objetInfos[translatedClass];
    
    // Si on ne trouve pas d'informations pour la classe traduite, on essaie avec la classe originale
    if (!baseInfo) {
      baseInfo = objetInfos[className];
    }
    
    // Si on ne trouve toujours pas, on utilise des valeurs par défaut
    if (!baseInfo) {
      baseInfo = {
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
    }
    
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
      class: translatedClass, // Utiliser le nom de classe traduit
      originalClass: className, // Conserver le nom de classe original
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
    dimensionsEstimees: prediction.dimensionsMoyennes || "Données non disponibles",
    position: {
      x: Math.round(x),
      y: Math.round(y),
      center: {
        x: Math.round(x + width/2),
        y: Math.round(y + height/2)
      },
      relativeCentre: {
        x: ((x + width/2) / videoWidth).toFixed(2),
        y: ((y + height/2) / videoHeight).toFixed(2)
      }
    }
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
   * Génère une description de la scène à partir des objets détectés
   * @param {Array} objets - Objets détectés dans la scène
   * @returns {string} - Description textuelle de la scène
   */
  const genererDescriptionScene = useCallback((objets) => {
    if (!objets || objets.length === 0) return "Aucun objet détecté dans la scène.";

    // Grouper les objets par classe
    const groupes = {};
    objets.forEach(obj => {
      if (!groupes[obj.class]) groupes[obj.class] = [];
      groupes[obj.class].push(obj);
    });

    // Formater les groupes en texte
    const descriptions = Object.keys(groupes).map(classe => {
      const nombre = groupes[classe].length;
      const pluriel = nombre > 1 ? "s" : "";
      return `${nombre} ${classe}${pluriel}`;
    });

    // Construction de la phrase selon le nombre d'objets détectés
    if (descriptions.length === 1) {
      return `Détecté: ${descriptions[0]}.`;
    } else if (descriptions.length === 2) {
      return `Détecté: ${descriptions[0]} et ${descriptions[1]}.`;
    } else {
      const dernier = descriptions.pop();
      return `Détecté: ${descriptions.join(', ')} et ${dernier}.`;
    }
  }, []);

  /**
   * Sauvegarde la description de la scène dans un fichier texte
   */
  const sauvegarderDescription = useCallback(() => {
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace(/:/g, '-');

    // Structure du fichier avec informations détaillées
    const contenu = `
Date : ${formattedDate}\n\n
Description de la scène :\n${lastSceneDescription}\n\n
Objets détectés : \n${predictions.map(pred => `
- Classe : ${pred.class}
  Confiance : ${(pred.score * 100).toFixed(2)}%
  Position (x, y, largeur, hauteur) : [${pred.bbox.join(', ')}]
  ${pred.dimensions ? `Dimensions : ${JSON.stringify(pred.dimensions, null, 2)}` : ''}
  Source : ${pred.source}
`).join('\n')}
`;

    // Créer un fichier Blob avec la description
    const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });

    // Sauvegarder le fichier avec FileSaver.js
    saveAs(blob, `analyse-scene-${formattedDate}.txt`);
    
    addLog("Description de la scène sauvegardée dans un fichier texte.", "success");

    if (audioEnabled) {
      speechManagerRef.current.speak("Description de la scène enregistrée avec succès.", 2);
    }
  }, [lastSceneDescription, predictions, audioEnabled, addLog]);

  /**
   * Prépare et traite une image pour la détection d'objets
   * @param {HTMLImageElement} image - Élément image à analyser
   * @returns {tf.Tensor3D} - Tensor prêt pour l'inférence
   */
  const preprocessImage = useCallback((image) => {
    // Conversion en tensor et normalisation
    const tensor = tf.browser.fromPixels(image);
    // Ajuster le zoom si nécessaire
    if (zoomLevel !== 1) {
      const [height, width] = tensor.shape;
      const centerHeight = height / 2;
      const centerWidth = width / 2;
      const newHeight = height / zoomLevel;
      const newWidth = width / zoomLevel;
      const startHeight = centerHeight - newHeight / 2;
      const startWidth = centerWidth - newWidth / 2;
      
      // Extraire la région zoomée
      const zoomedTensor = tf.image.cropAndResize(
        tf.expandDims(tensor),
        [[startHeight / height, startWidth / width, 
          (startHeight + newHeight) / height, (startWidth + newWidth) / width]],
        [0],
        [height, width]
      ).squeeze();
      
      tensor.dispose();
      return zoomedTensor;
    }
    return tensor;
  }, [zoomLevel]);

  /**
   * Prétraite et redimensionne l'image pour le modèle YOLO à la taille attendue
   * @param {HTMLImageElement|HTMLVideoElement} image - Élément image ou vidéo à prétraiter
   * @param {Object} model - Modèle YOLO chargé
   * @returns {tf.Tensor3D} - Tensor prêt pour l'inférence
   */
  const preprocessImageForYOLO = useCallback((image, model) => {
    if (!model) return null;
    
    // Récupérer la taille d'entrée attendue par le modèle YOLO
    const inputShape = model.inputs[0].shape;
    // La forme est généralement [null, height, width, channels]
    const yoloWidth = inputShape[2];
    const yoloHeight = inputShape[1];
    
    // Conversion de l'image en tensor
    const tensor = tf.browser.fromPixels(image);
    
    // Redimensionner pour correspondre à l'entrée du modèle YOLO
    const resized = tf.image.resizeBilinear(tensor, [yoloHeight, yoloWidth]);
    
    // Normaliser entre 0 et 1
    const normalized = resized.div(255.0);
    
    // Ajouter la dimension batch [1, height, width, 3]
    const batched = normalized.expandDims(0);
    
    // Nettoyer les tensors temporaires
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    
    return batched;
  }, []);

  /**
   * Traite les résultats du modèle YOLO et les convertit au format compatible avec COCO-SSD
   * @param {tf.Tensor} output - Sortie du modèle YOLO
   * @param {number} imgWidth - Largeur originale de l'image
   * @param {number} imgHeight - Hauteur originale de l'image
   * @param {number} scoreThreshold - Seuil de confiance minimal pour les détections
   * @returns {Array} - Prédictions au format compatible avec COCO-SSD
   */
  const processYOLOOutput = useCallback((output, imgWidth, imgHeight, scoreThreshold = 0.25) => {
    // Le format de sortie de YOLO dépend de l'implémentation exacte
    // Cet exemple suppose une sortie standard avec des boîtes de délimitation, des scores de confiance et des classes
    
    // Convertir le tensor en tableau JavaScript
    const outputArray = Array.from(output.dataSync());
    const modelWidth = output.shape[2];
    const modelHeight = output.shape[1];
    const numClasses = (output.shape[3] - 5); // 5 = x, y, w, h, confidence
    
    const predictions = [];
    const numBoxes = outputArray.length / (numClasses + 5);
    
    for (let i = 0; i < numBoxes; i++) {
      const baseIndex = i * (numClasses + 5);
      const confidence = outputArray[baseIndex + 4];
      
      if (confidence > scoreThreshold) {
        // Trouver la classe avec le score le plus élevé
        let maxClassScore = 0;
        let classIndex = 0;
        
        for (let c = 0; c < numClasses; c++) {
          const classScore = outputArray[baseIndex + 5 + c];
          if (classScore > maxClassScore) {
            maxClassScore = classScore;
            classIndex = c;
          }
        }
        
        const score = confidence * maxClassScore;
        
        if (score > scoreThreshold) {
          // Récupérer les coordonnées (format YOLO)
          let x = outputArray[baseIndex];
          let y = outputArray[baseIndex + 1];
          let w = outputArray[baseIndex + 2];
          let h = outputArray[baseIndex + 3];
          
          // Convertir de coordonnées normalisées à pixels
          x = (x - w/2) * imgWidth;
          y = (y - h/2) * imgHeight;
          w = w * imgWidth;
          h = h * imgHeight;
          
          predictions.push({
            bbox: [x, y, w, h],
            class: `custom-${classIndex}`, // Préfixe pour distinguer des classes COCO
            score: score,
            source: 'YOLO' // Marquer comme provenant de YOLO
          });
        }
      }
    }
    
    return predictions;
  }, []);

  /**
   * Fonction principale de détection d'objets
   */
  const detectObjects = useCallback(async () => {
    // Vérification des références nécessaires
    if (!isDetecting || !webcamRef.current || !webcamRef.current.video || 
        !webcamRef.current.video.readyState === 4 || !modelRef.current || !modelRef.current.cocoModel) {
      return;
    }

    const video = webcamRef.current.video;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    // Ne pas exécuter la détection si l'intervalle depuis la dernière détection est trop court
    const now = Date.now();
    if (now - lastDetectionTimeRef.current < detectionInterval) {
      // Planifier la prochaine frame d'animation
      animationFrameRef.current = requestAnimationFrame(detectObjects);
      return;
    }
    lastDetectionTimeRef.current = now;
    
    try {
      // Prétraitement d'image avec TensorFlow.js
      const tensor = preprocessImage(video);
      
      // Détection avec le modèle COCO-SSD
      const cocoResults = await modelRef.current.cocoModel.detect(tensor);

      // Libérer la mémoire du tensor après utilisation
      tensor.dispose();
      
      // Combiner les résultats des différents modèles
      let allResults = [...cocoResults];
      
      // Ajouter les prédictions du modèle YOLO si disponible
      if (modelRef.current.yoloModel) {
        try {
          // Prétraiter l'image spécifiquement pour YOLO
          const yoloTensor = preprocessImageForYOLO(video, modelRef.current.yoloModel);
          
          if (yoloTensor) {
            // Exécuter l'inférence avec le modèle YOLO
            const yoloOutput = modelRef.current.yoloModel.predict(yoloTensor);
            
            // Traiter les résultats de YOLO et les convertir en format compatible
            const yoloResults = processYOLOOutput(yoloOutput, videoWidth, videoHeight);
            
            // Libérer la mémoire
            yoloTensor.dispose();
            yoloOutput.dispose();
            
            // Ajouter les résultats de YOLO à nos prédictions
            allResults = [...allResults, ...yoloResults];
            
            addLog(`YOLO a détecté ${yoloResults.length} objets`, "info");
          }
        } catch (yoloError) {
          console.error("Erreur lors de la détection YOLO:", yoloError);
          addLog(`Erreur YOLO: ${yoloError.message}`, "error");
        }
      }
      
      // Enrichir les prédictions avec des informations supplémentaires
      const enrichedPredictions = enrichPredictions(allResults);
      
      // Mettre à jour l'état avec les nouvelles prédictions si elles sont différentes
      const predictionsChanged = JSON.stringify(enrichedPredictions) !== JSON.stringify(lastPredictionsRef.current);
      
      if (predictionsChanged) {
        // Mise à jour de la référence et de l'état
        lastPredictionsRef.current = enrichedPredictions;
        setPredictions(enrichedPredictions);
        
        // Mettre à jour les analyses dimensionnelles pour chaque objet
        const analysesObj = {};
        enrichedPredictions.forEach(pred => {
          analysesObj[pred.class + '-' + pred.bbox.join(',')] = analyserDimensionsObjets(pred, videoWidth, videoHeight);
        });
        setObjectAnalyses(analysesObj);
        
        // Mettre à jour la description de la scène toutes les 3 secondes
        if (now - lastDescriptionTimeRef.current > 3000) {
          const description = genererDescriptionScene(enrichedPredictions);
          setLastSceneDescription(description);
          lastDescriptionTimeRef.current = now;
          
          // Annoncer vocalement si audio activé
          if (audioEnabled && enrichedPredictions.length > 0) {
            speechManagerRef.current.speak(description, 2, 'scene-description', now);
          }
          
          addLog(`Analyse complète: ${description}`, "info");
        }
        
        // Annoncer vocalement les nouveaux objets avec forte confiance
        if (audioEnabled) {
          enrichedPredictions
            .filter(pred => pred.score > 0.7)
            .forEach(pred => {
              const objectId = pred.class;
              // Vérifier si c'est un nouvel objet ou s'il n'a pas été annoncé récemment
              if (!objectHistoryRef.current[objectId] || now - objectHistoryRef.current[objectId] > 5000) {
                const message = `${pred.icon || ''} ${pred.class} détecté${pred.class.endsWith('e') ? 'e' : ''}.`;
                speechManagerRef.current.speak(message, 1, objectId, now);
                objectHistoryRef.current[objectId] = now;
              }
            });
        }
      }
      
      // Dessiner les rectangles de détection sur le canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        // Ajuster les dimensions du canvas à celles de la vidéo
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        // Effacer le canvas précédent
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Appliquer les ajustements de luminosité au canvas
        if (brightness !== 100) {
          ctx.filter = `brightness(${brightness}%)`;
        }
        
        // Dessiner la vidéo d'abord
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        
        // Réinitialiser les filtres pour les détections
        ctx.filter = 'none';
        
        // Dessiner chaque détection
        enrichedPredictions.forEach((prediction) => {
          // Extraire les coordonnées et dimensions
          const [x, y, width, height] = prediction.bbox;
          
          // Définir le style du rectangle
          const isSelected = selectedObject && 
            selectedObject.class === prediction.class && 
            JSON.stringify(selectedObject.bbox) === JSON.stringify(prediction.bbox);
          
                   // Couleur basée sur la confiance et si l'objet est sélectionné
          const confidence = prediction.score;
          let color;
          if (isSelected) {
            color = 'rgba(255, 215, 0, 0.8)'; // Or pour sélection
          } else if (confidence > 0.8) {
            color = 'rgba(0, 255, 0, 0.6)'; // Vert pour haute confiance
          } else if (confidence > 0.6) {
            color = 'rgba(255, 255, 0, 0.6)'; // Jaune pour confiance moyenne
          } else {
            color = 'rgba(255, 0, 0, 0.6)'; // Rouge pour faible confiance
          }
          
          // Dessiner le rectangle
          ctx.strokeStyle = color;
          ctx.lineWidth = isSelected ? 4 : 2;
          ctx.strokeRect(x, y, width, height);
          
          // Dessiner l'étiquette avec fond semi-transparent
          const label = `${prediction.class} ${(confidence * 100).toFixed(1)}%`;
          const textWidth = ctx.measureText(label).width;
          
          // Fond de l'étiquette
          ctx.fillStyle = color;
          ctx.fillRect(x, y - 30, textWidth + 10, 30);
          
          // Texte de l'étiquette
          ctx.fillStyle = 'white';
          ctx.font = '18px Arial';
          ctx.fillText(label, x + 5, y - 8);
          
          // Ajouter une icône si disponible
          if (prediction.icon) {
            ctx.font = '20px Arial';
            ctx.fillText(prediction.icon, x + textWidth + 15, y - 8);
          }
        });
      }
    } catch (error) {
      console.error("Erreur lors de la détection:", error);
      addLog(`Erreur de détection: ${error.message}`, "error");
    }
    
    // Planifier la prochaine frame d'animation
    animationFrameRef.current = requestAnimationFrame(detectObjects);
  }, [isDetecting, zoomLevel, brightness, selectedObject, audioEnabled, detectionMode, detectionInterval, genererDescriptionScene, preprocessImage, preprocessImageForYOLO, processYOLOOutput, addLog]);

  // Démarrer la détection d'objets lorsque le composant est monté
  useEffect(() => {
    if (!loadingModel && isDetecting) {
      detectObjects();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detectObjects, loadingModel, isDetecting]);

  // Gérer la capture d'image
  const captureImage = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setIsDetecting(false);
      addLog("Image capturée pour analyse détaillée", "info");
      
      if (audioEnabled) {
        speechManagerRef.current.speak("Image capturée. Analyse détaillée en cours.", 2);
      }
    }
  }, [audioEnabled, addLog]);

  // Reprendre la détection en direct
  const resumeDetection = useCallback(() => {
    setCapturedImage(null);
    setIsDetecting(true);
    addLog("Reprise de la détection en temps réel", "info");
  }, [addLog]);

  // Basculer entre les caméras avant et arrière
  const toggleCamera = useCallback(() => {
    setCameraFacingMode(prevMode => 
      prevMode === "user" ? "environment" : "user"
    );
    addLog(`Changement de caméra: ${cameraFacingMode === "user" ? "arrière" : "avant"}`, "info");
  }, [cameraFacingMode, addLog]);

  // Gérer la sélection d'un objet détecté
  const handleObjectClick = useCallback((prediction) => {
    setSelectedObject(prediction);
    addLog(`Objet sélectionné: ${prediction.class}`, "info");
    
    if (audioEnabled) {
      const message = `${prediction.class} sélectionné. ${prediction.caracteristiques ? prediction.caracteristiques.substring(0, 100) : ''}`;
      speechManagerRef.current.speak(message, 2);
    }
  }, [audioEnabled, addLog]);

  // Rendu du composant
  return (
    <div className="analyse-container">
      {/* Overlay de chargement */}
      {loadingModel && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner"></div>
            <h2>Chargement des modèles d'IA...</h2>
            <p>Préparation de l'analyse visuelle</p>
          </div>
        </div>
      )}
      
      {/* Message d'erreur */}
      {errorMessage && (
        <div className="error-overlay">
          <div className="error-content">
            <h2>Erreur</h2>
            <p>{errorMessage}</p>
            <button onClick={() => window.location.reload()}>Réessayer</button>
          </div>
        </div>
      )}
      
      {/* Panneau principal */}
      <div className="main-panel">
        {/* Affichage de la webcam ou de l'image capturée */}
        <div className="camera-container" style={{ filter: `brightness(${brightness}%)` }}>
          {!capturedImage ? (
            <>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: cameraFacingMode,
                  aspectRatio: 4/3
                }}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center'
                }}
              />
              <canvas
                ref={canvasRef}
                className="detection-canvas"
              />
            </>
          ) : (
            <div className="captured-image-container">
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="captured-image"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center'
                }}
              />
            </div>
          )}
        </div>
        
        {/* Barre d'outils */}
        <div className="toolbar">
          <button 
            onClick={capturedImage ? resumeDetection : captureImage}
            className="tool-button"
            title={capturedImage ? "Reprendre la détection" : "Capturer l'image"}
          >
            {capturedImage ? <MdPhotoLibrary /> : <FaCamera />}
          </button>
          
          <button 
            onClick={toggleCamera} 
            className="tool-button"
            title="Changer de caméra"
          >
            <FaExchangeAlt />
          </button>
          
          <button 
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 2))}
            className="tool-button"
            title="Zoom avant"
          >
            <BsZoomIn />
          </button>
          
          <button 
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 1))}
            className="tool-button"
            title="Zoom arrière"
          >
            <BsZoomOut />
          </button>
          
          <button 
            onClick={() => setAudioEnabled(prev => !prev)}
            className={`tool-button ${audioEnabled ? 'active' : ''}`}
            title={audioEnabled ? "Désactiver l'audio" : "Activer l'audio"}
          >
            {audioEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          
          <button 
            onClick={() => setShowSettings(prev => !prev)}
            className={`tool-button ${showSettings ? 'active' : ''}`}
            title="Paramètres"
          >
            <FaCog />
          </button>
          
          <button 
            onClick={() => setShowAiLogs(prev => !prev)}
            className={`tool-button ${showAiLogs ? 'active' : ''}`}
            title="Logs d'IA"
          >
            <FaBrain />
          </button>
          
          <button 
            onClick={sauvegarderDescription}
            className="tool-button"
            title="Sauvegarder la description"
            disabled={!lastSceneDescription}
          >
            <FaSave />
          </button>
        </div>
        
        {/* Panneau de paramètres */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              className="settings-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <h3>Paramètres</h3>
              
              <div className="setting-item">
                <label>Luminosité: {brightness}%</label>
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  value={brightness} 
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                />
              </div>
              
              <div className="setting-item">
                <label>Zoom: {zoomLevel.toFixed(1)}x</label>
                <input 
                  type="range" 
                  min="1" 
                  max="2" 
                  step="0.1" 
                  value={zoomLevel} 
                  onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                />
              </div>
              
              <div className="setting-item">
                <label>Mode de détection:</label>
                <select 
                  value={detectionMode} 
                  onChange={(e) => setDetectionMode(e.target.value)}
                >
                  <option value="fast">Rapide (moins précis)</option>
                  <option value="normal">Normal</option>
                  <option value="detail">Détaillé (plus lent)</option>
                </select>
              </div>
              
              <div className="setting-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={darkMode} 
                    onChange={() => setDarkMode(prev => !prev)}
                  />
                  Mode sombre
                </label>
              </div>
              
              <div className="setting-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={enableCloudAnalysis} 
                    onChange={() => setEnableCloudAnalysis(prev => !prev)}
                  />
                  Analyse cloud avancée
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Panneau des logs d'IA */}
        <AnimatePresence>
          {showAiLogs && (
            <motion.div 
              className="ai-logs-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <h3>Logs d'IA <FaRobot /></h3>
              <div className="logs-container">
                {aiLogs.map((log, index) => (
                  <div key={index} className={`log-entry ${log.type}`}>
                    <span className="log-time">{log.timestamp}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Panneau d'informations */}
      <div className="info-panel">
        <div className="info-header">
          <h2>
            <FaInfoCircle /> {selectedObject ? `Détails: ${selectedObject.class}` : "Objets détectés"}
          </h2>
          {lastSceneDescription && (
            <div className="scene-description">
              <p>{lastSceneDescription}</p>
            </div>
          )}
        </div>
        
        {selectedObject ? (
          <div className="object-details">
            <div className="object-header">
              <h3>{selectedObject.icon} {selectedObject.class}</h3>
              <span className="confidence">
                Confiance: {(selectedObject.score * 100).toFixed(1)}% ({selectedObject.certainty})
              </span>
              <span className="source-model">
                Source: {selectedObject.source}
              </span>
            </div>
            
            <div className="details-grid">
              <div className="detail-section">
                <h4>Caractéristiques</h4>
                <p>{selectedObject.caracteristiques}</p>
              </div>
              
              <div className="detail-section">
                <h4>Utilisation</h4>
                <p>{selectedObject.utilisation}</p>
              </div>
              
              <div className="detail-section">
                <h4>Dimensions</h4>
                <p>
                  {objectAnalyses[selectedObject.class + '-' + selectedObject.bbox.join(',')] ? (
                    <>
                      <strong>Taille relative:</strong> {objectAnalyses[selectedObject.class + '-' + selectedObject.bbox.join(',')].proportionImage.surface} de l'image<br />
                      <strong>Distance estimée:</strong> {objectAnalyses[selectedObject.class + '-' + selectedObject.bbox.join(',')].distanceEstimee}<br />
                      {selectedObject.dimensions.estimationTailleReelle && (
                        <span><strong>Dimensions typiques:</strong> {JSON.stringify(selectedObject.dimensions.estimationTailleReelle)}</span>
                      )}
                    </>
                  ) : "Analyse dimensionnelle non disponible"}
                </p>
              </div>
              
              <div className="detail-section">
                <h4>Catégories</h4>
                <div className="tags">
                  {selectedObject.categories && selectedObject.categories.map((cat, idx) => (
                    <span key={idx} className="tag">{cat}</span>
                  ))}
                </div>
              </div>
              
              <div className="detail-section">
                <h4>Conseil</h4>
                <p>{selectedObject.conseil}</p>
              </div>
            </div>
            
            <button 
              className="close-details" 
              onClick={() => setSelectedObject(null)}
            >
              Retour à la liste
            </button>
          </div>
        ) : (
          <div className="objects-list">
            {predictions.length > 0 ? (
              predictions.map((prediction, index) => (
                <div 
                  key={index} 
                  className="object-item"
                  onClick={() => handleObjectClick(prediction)}
                >
                  <span className="object-icon">{prediction.icon || '📦'}</span>
                  <span className="object-name">{prediction.class}</span>
                  <span className="object-confidence">{(prediction.score * 100).toFixed(1)}%</span>
                </div>
              ))
            ) : (
              <div className="no-objects">
                <p>Aucun objet détecté</p>
                <p className="hint">Dirigez la caméra vers des objets pour les analyser</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analyse;

