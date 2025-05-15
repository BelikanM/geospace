import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaSave, FaInfoCircle, FaCog, FaExchangeAlt, FaVolumeUp, FaVolumeMute, FaRobot, FaBrain } from 'react-icons/fa';
import { BsZoomIn, BsZoomOut } from 'react-icons/bs';
import './Analyse.css';

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

// On initialise avec un objet vide qui sera remplacé par les données du fichier JSON
let objetInfos = {};

const Analyse = () => {
  // Références
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const speechManagerRef = useRef(new SpeechManager());
  const animationFrameRef = useRef(null);
  
  // Références pour optimisation
  const lastPredictionsRef = useRef([]);
  const objectHistoryRef = useRef({});
  const lastDetectionTimeRef = useRef(0);
  const lastDescriptionTimeRef = useRef(0);

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
  const [aiLogs, setAiLogs] = useState([]);
  const [showAiLogs, setShowAiLogs] = useState(false);

  // Dérivé des états
  const detectionInterval = detectionMode === "fast" ? 300 : detectionMode === "detail" ? 100 : 200;

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
        
        // Optimisation de la mémoire GPU/WebGL
        tf.env().set('WEBGL_FLUSH_THRESHOLD', 2);
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_PACK', true);
        tf.env().set('WEBGL_LAZILY_UNPACK', true);
        
        // Activer WebGL explicitement
        await tf.setBackend('webgl');
        addLog(`Backend TensorFlow.js: ${tf.getBackend()}`, "success");
        
        // Chargement dynamique du fichier JSON avec les données des objets
        addLog("Chargement des données des objets...", "system");
        try {
          const module = await import('./objetInfos.json');
          objetInfos = module.default;
          addLog("Données des objets chargées avec succès", "success");
        } catch (error) {
          console.error("Erreur lors du chargement des infos d'objets:", error);
          addLog("Impossible de charger les données des objets, fonctionnement limité", "warning");
          objetInfos = {};
        }
        
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
          yoloDebugAttempted: false,
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
   * Traite les sorties du modèle YOLO pour obtenir les détections
   * Optimisé pour différents formats de sortie YOLO
   */
  const processYOLOOutput = async (outputTensor, imgWidth, imgHeight, confThreshold = 0.35) => {
    try {
      // Créer un tableau pour stocker nos détections formatées
      let yoloDetections = [];
      
      // Première chose à vérifier : convertir le tenseur en tableau JavaScript
      const detections = await outputTensor.array();

      // Récupérer la forme du tenseur de sortie
      const outputShape = outputTensor.shape;
      
      // Analyser la sortie selon les formes les plus courantes pour YOLO
      if (detections && detections.length > 0) {
        // Si c'est un tableau 3D [1, N, M] où N est le nombre de boîtes
        // et M le nombre de valeurs par boîte (coordonnées, score, classes)
        const valueCount = detections[0][0].length;
        
        // Format typique YOLO v5/v8: [x, y, w, h, conf, class1, class2...]
        if (valueCount > 5) {
          addLog(`Format YOLO standard détecté: ${valueCount} valeurs`, "info");

          for (let i = 0; i < detections[0].length; i++) {
            const detection = detections[0][i];
            const [x, y, w, h, confidence, ...classProbs] = detection;
            
            // Trouver la classe avec la probabilité maximale
            const classIndex = classProbs.indexOf(Math.max(...classProbs));
            const classId = classIndex;
            
            // Ne garder que les détections avec un score suffisant (seuil abaissé)
            if (confidence > confThreshold) {
              // Normaliser les coordonnées si nécessaire
              const normalizedX = x >= 0 && x <= 1 ? x * imgWidth : x;
              const normalizedY = y >= 0 && y <= 1 ? y * imgHeight : y;
              const normalizedW = w >= 0 && w <= 1 ? w * imgWidth : w;
              const normalizedH = h >= 0 && h <= 1 ? h * imgHeight : h;
              
              yoloDetections.push({
                bbox: [
                  normalizedX - normalizedW/2, // Conversion au format xywh (coin supérieur gauche)
                  normalizedY - normalizedH/2,
                  normalizedW,
                  normalizedH
                ],
                class: `custom-${Math.round(classId)}`,
                score: confidence
              });
            }
          }
        }
        // Format YOLO alternatifu: [x, y, w, h, conf, classId]
        else if (valueCount >= 6) {
          addLog(`Format YOLO alternatif détecté: ${valueCount} valeurs`, "info");
          
          for (let i = 0; i < detections[0].length; i++) {
            const [x, y, w, h, confidence, classId] = detections[0][i];
            
            if (confidence > confThreshold) {
              // Normaliser les coordonnées
              const normalizedX = x >= 0 && x <= 1 ? x * imgWidth : x;
              const normalizedY = y >= 0 && y <= 1 ? y * imgHeight : y;
              const normalizedW = w >= 0 && w <= 1 ? w * imgWidth : w;
              const normalizedH = h >= 0 && h <= 1 ? h * imgHeight : h;
              
              yoloDetections.push({
                bbox: [
                  normalizedX - normalizedW/2,
                  normalizedY - normalizedH/2,
                  normalizedW,
                  normalizedH
                ],
                class: `custom-${Math.round(classId)}`,
                score: confidence
              });
            }
          }
        }
        // Format spécial: directement des boîtes délimitantes - certains modèles YOLO optimisés
        else {
          addLog(`Format YOLO non standard détecté: ${valueCount} valeurs`, "warning");
          // Essayer d'extraire les informations minimums nécessaires
          for (let i = 0; i < detections.length; i++) {
            // Tenter d'extraire les informations essentielles 
            // en fonction du nombre de valeurs disponibles
            if (valueCount >= 4) {
              let x, y, w, h, confidence = 0.6, classId = 0;
              
              if (valueCount >= 4) {
                [x, y, w, h] = detections[i].slice(0, 4);
              }
              
              if (valueCount >= 5) {
                confidence = detections[i][4];
              }
              
              if (valueCount >= 6) {
                classId = Math.round(detections[i][5]);
              }
              
              if (confidence > confThreshold) {
                // Normaliser les coordonnées si nécessaire
                const normalizedX = x >= 0 && x <= 1 ? x * imgWidth : x;
                const normalizedY = y >= 0 && y <= 1 ? y * imgHeight : y;
                const normalizedW = w >= 0 && w <= 1 ? w * imgWidth : w;
                const normalizedH = h >= 0 && h <= 1 ? h * imgHeight : h;
                
                yoloDetections.push({
                  bbox: [
                    normalizedX - normalizedW/2,
                    normalizedY - normalizedH/2,
                    normalizedW,
                    normalizedH
                  ],
                  class: `custom-${classId}`,
                  score: confidence
                });
              }
            }
          }
        }
      }
      
      return yoloDetections;
    } catch (error) {
      addLog(`Erreur lors du traitement des sorties YOLO: ${error.message}`, "error");
      console.error("Erreur traitement YOLO:", error);
      return [];
    }
  };

  /**
   * Débogue le modèle YOLO pour identifier le format d'entrée/sortie correct
   */
  const debugYoloModel = async () => {
    if (!modelRef.current || !modelRef.current.yoloModel) {
      addLog("Pas de modèle YOLO disponible pour le débogage", "error");
      return;
    }
    
    try {
      addLog("Début du débogage YOLO...", "system");
      
      // Afficher les informations sur le modèle
      const inputs = modelRef.current.yoloModel.inputs;
      const outputs = modelRef.current.yoloModel.outputs;
      
      // Enregistrer la structure d'entrée/sortie
      let modelStructure = {
        inputs: inputs.map(input => ({
          name: input.name,
          shape: input.shape,
          dtype: input.dtype
        })),
        outputs: outputs.map(output => ({
          name: output.name,
          shape: output.shape,
          dtype: output.dtype
        }))
      };
      
      addLog(`Structure YOLO: ${JSON.stringify(modelStructure)}`, "debug");
      
      // Tester le modèle avec différents formats d'entrée
      const testTensor = tf.zeros([1, 640, 640, 3]);
      
      // Les formats d'entrée à tester
      const inputFormats = [
        { images: testTensor },
        { inputs: testTensor },
        { input_1: testTensor },
        testTensor
      ];
      
      for (let i = 0; i < inputFormats.length; i++) {
        try {
          addLog(`Test format d'entrée #${i}...`, "system");
          const result = await modelRef.current.yoloModel.executeAsync(inputFormats[i]);
          
          // Si on arrive ici, le format a fonctionné
          let outputInfo = "Format de sortie: ";
          if (Array.isArray(result)) {
            outputInfo += `Array de ${result.length} tenseurs`;
            result.forEach(t => t.dispose());
          } else {
            outputInfo += `Tenseur unique shape: ${result.shape}`;
            result.dispose();
          }
          
          addLog(`Format d'entrée #${i} RÉUSSI! ${outputInfo}`, "success");
          break;
        } catch (e) {
          addLog(`Format d'entrée #${i} ÉCHEC: ${e.message}`, "error");
        }
      }
      
      // Nettoyage
      testTensor.dispose();
      addLog("Débogage YOLO terminé", "system");
      
    } catch (error) {
      addLog(`Erreur débogage YOLO: ${error.message}`, "error");
    }
  };

  /**
   * Enrichit les prédictions avec des informations supplémentaires
   * @param {Array} predictions - Prédictions brutes du modèle 
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
   * Traite les prédictions pour détecter et analyser les objets
   */
  const processPredictions = useCallback(async () => {
    if (!isDetecting || loadingModel || !webcamRef.current || !modelRef.current?.cocoModel) {
      return;
    }
    
    const video = webcamRef.current.video;
    if (!video || !video.readyState === 4) {
      return;
    }
    
    const now = performance.now();
    // Limiter la fréquence des détections selon le mode
    if (now - lastDetectionTimeRef.current < detectionInterval) {
      // Planifier la prochaine détection
      animationFrameRef.current = requestAnimationFrame(processPredictions);
      return;
    }
    lastDetectionTimeRef.current = now;
    
    let allPredictions = [];
    
    try {
      // Exécuter COCO-SSD pour la détection d'objets standard
      const startTime = performance.now();
      const cocoDetections = await modelRef.current.cocoModel.detect(video);
      const detectionTime = performance.now() - startTime;
      
      // Log de performance pour COCO-SSD
      if (cocoDetections.length > 0) {
        addLog(`COCO-SSD: ${cocoDetections.length} objets en ${detectionTime.toFixed(0)}ms`, "performance");
      }
      
      // Ajouter les détections COCO-SSD
      allPredictions = [...cocoDetections];
      
      // Si le modèle YOLO est disponible, l'utiliser également
      if (modelRef.current.yoloModel) {
        try {
          const yoloStartTime = performance.now();
          
          // Préparation de l'entrée pour YOLO
          const inputTensor = tf.browser.fromPixels(video)
            .resizeBilinear([640, 640])  // Redimensionnement à 640x640
            .div(255.0)                  // Normalisation entre 0 et 1
            .expandDims(0);              // Ajout d'une dimension de batch
          
          // Exécuter l'inférence YOLO avec le format d'entrée approprié
          const yoloOutput = await modelRef.current.yoloModel.executeAsync({ images: inputTensor });
          
          // Nettoyer le tenseur d'entrée pour éviter les fuites mémoire
          inputTensor.dispose();
          
          // Traitement des sorties YOLO en fonction de la structure du modèle
          const yoloDetections = await processYOLOOutput(
            Array.isArray(yoloOutput) ? yoloOutput[0] : yoloOutput,
            video.videoWidth,
            video.videoHeight,
            0.35 // Seuil de confiance abaissé pour détecter plus facilement
          );
          
          // Libérer les ressources de sortie
          if (Array.isArray(yoloOutput)) {
            yoloOutput.forEach(tensor => tensor.dispose());
          } else {
            yoloOutput.dispose();
          }
          
          const yoloTime = performance.now() - yoloStartTime;
          
          // Log de performance pour YOLO
          if (yoloDetections.length > 0) {
            addLog(`YOLO: ${yoloDetections.length} objets en ${yoloTime.toFixed(0)}ms`, "performance");
          }
          
          // Fusionner les détections YOLO avec les autres
          allPredictions = [...allPredictions, ...yoloDetections];
          
        } catch (yoloError) {
          console.error("Erreur lors de l'inférence YOLO:", yoloError);
          addLog(`Erreur YOLO: ${yoloError.message}`, "error");
          
          // Tenter de déboguer le modèle en cas d'erreur
          if (!modelRef.current.yoloDebugAttempted) {
            modelRef.current.yoloDebugAttempted = true;
            debugYoloModel();
          }
        }
      }
      
      // Enrichir les prédictions avec des informations supplémentaires
      if (allPredictions.length > 0) {
        allPredictions = enrichPredictions(allPredictions);
        
        // Mettre à jour l'historique des objets détectés
        const currentTimestamp = Date.now();
        const objectIds = new Set();
        
        allPredictions.forEach(prediction => {
          const objectId = `${prediction.class}-${Math.round(prediction.bbox[0])}-${Math.round(prediction.bbox[1])}`;
          objectIds.add(objectId);
          
          // Si c'est un nouvel objet ou si l'objet n'a pas été vu récemment
          if (!objectHistoryRef.current[objectId] || 
              currentTimestamp - objectHistoryRef.current[objectId].lastSeen > 2000) {
            
            // Annoncer le nouvel objet
            const confidence = prediction.score > 0.80 ? "avec certitude" : 
                              prediction.score > 0.60 ? "probablement" : "possiblement";
            
            // Améliorer les annonces vocales avec plus de contexte
            const size = (prediction.bbox[2] * prediction.bbox[3]) / (video.videoWidth * video.videoHeight);
            const position = prediction.bbox[1] < video.videoHeight / 3 ? "en haut" : 
                           prediction.bbox[1] > video.videoHeight * 2/3 ? "en bas" : "au centre";
            
            // Seulement annoncer si l'objet est suffisamment grand et confiant
            if (size > 0.03 && prediction.score > 0.35) { // Seuil abaissé
              const message = `${confidence} un ${prediction.class} ${position} de l'image`;
              speechManagerRef.current.speak(message, 2, objectId, now);
            }
            
                        // Enregistrer l'analyse d'objet
            setObjectAnalyses(prev => ({
              ...prev,
              [objectId]: {
                classe: prediction.class,
                confiance: prediction.score,
                timestamp: currentTimestamp,
                dimensions: analyserDimensionsObjets(prediction, video.videoWidth, video.videoHeight)
              }
            }));
          }
          
          // Mettre à jour l'historique de l'objet
          objectHistoryRef.current[objectId] = {
            lastSeen: currentTimestamp,
            count: (objectHistoryRef.current[objectId]?.count || 0) + 1,
            confidence: prediction.score,
            position: {
              x: prediction.bbox[0] + prediction.bbox[2] / 2,
              y: prediction.bbox[1] + prediction.bbox[3] / 2
            }
          };
        });
        
        // Supprimer les objets qui n'ont pas été vus depuis un certain temps
        Object.keys(objectHistoryRef.current).forEach(key => {
          if (!objectIds.has(key) && currentTimestamp - objectHistoryRef.current[key].lastSeen > 5000) {
            delete objectHistoryRef.current[key];
          }
        });
      }
      
      // Mettre à jour l'état des prédictions
      setPredictions(allPredictions);
      lastPredictionsRef.current = allPredictions;
      
      // Générer une description de la scène périodiquement
      if (allPredictions.length > 0 && now - lastDescriptionTimeRef.current > 10000) {
        generateSceneDescription(allPredictions, video.videoWidth, video.videoHeight);
        lastDescriptionTimeRef.current = now;
      }
      
      // Dessiner les prédictions sur le canvas
      drawPredictions(allPredictions);
      
      // Planifier la prochaine détection
      animationFrameRef.current = requestAnimationFrame(processPredictions);
      
    } catch (error) {
      console.error("Erreur lors du traitement des prédictions:", error);
      addLog(`Erreur de détection: ${error.message}`, "error");
      // En cas d'erreur, continuer à essayer
      animationFrameRef.current = requestAnimationFrame(processPredictions);
    }
  }, [isDetecting, loadingModel, detectionInterval, addLog]);

  /**
   * Génère une description de la scène basée sur les objets détectés
   */
  const generateSceneDescription = useCallback((predictions, width, height) => {
    if (!predictions || predictions.length === 0) return;
    
    // Regrouper les objets par classe
    const objectsByClass = {};
    predictions.forEach(pred => {
      if (!objectsByClass[pred.class]) {
        objectsByClass[pred.class] = [];
      }
      objectsByClass[pred.class].push(pred);
    });
    
    // Compter les objets et les trier par taille
    const countByClass = {};
    const mainObjects = [];
    
    Object.entries(objectsByClass).forEach(([className, preds]) => {
      countByClass[className] = preds.length;
      
      // Trier par taille (surface de la boîte englobante)
      const sortedBySize = [...preds].sort((a, b) => {
        const areaA = a.bbox[2] * a.bbox[3];
        const areaB = b.bbox[2] * b.bbox[3];
        return areaB - areaA; // Du plus grand au plus petit
      });
      
      // Ajouter l'objet le plus grand de chaque classe
      if (sortedBySize.length > 0) {
        const largest = sortedBySize[0];
        const area = largest.bbox[2] * largest.bbox[3];
        const relativeSize = area / (width * height);
        
        // Seulement inclure les objets relativement grands
        if (relativeSize > 0.05) {
          mainObjects.push({
            class: className,
            count: preds.length,
            size: relativeSize,
            position: {
              x: largest.bbox[0] + largest.bbox[2] / 2,
              y: largest.bbox[1] + largest.bbox[3] / 2
            }
          });
        }
      }
    });
    
    // Trier les objets principaux par taille
    mainObjects.sort((a, b) => b.size - a.size);
    
    // Construire la description
    let description = "";
    
    if (mainObjects.length === 0) {
      description = "Je ne détecte pas d'objets significatifs dans cette scène.";
    } else if (mainObjects.length === 1) {
      const obj = mainObjects[0];
      description = `Je vois principalement ${obj.count > 1 ? `${obj.count} ${obj.class}s` : `un ${obj.class}`} ${getPositionDescription(obj.position, width, height)}.`;
    } else {
      // Décrire jusqu'à 3 objets principaux
      const topObjects = mainObjects.slice(0, 3);
      
      description = "Je vois ";
      description += topObjects.map((obj, idx) => {
        const isLast = idx === topObjects.length - 1;
        const connector = isLast ? (topObjects.length > 1 ? " et " : "") : ", ";
        return `${idx === 0 ? "" : connector}${obj.count > 1 ? `${obj.count} ${obj.class}s` : `un ${obj.class}`} ${getPositionDescription(obj.position, width, height)}`;
      }).join("");
      
      // Ajouter le nombre total d'objets détectés si pertinent
      const totalObjectCount = predictions.length;
      if (totalObjectCount > topObjects.length + 2) {
        description += `, ainsi que ${totalObjectCount - topObjects.length} autres objets moins visibles.`;
      } else {
        description += ".";
      }
    }
    
    // Mettre à jour l'état de la description
    setLastSceneDescription(description);
    
    // Annoncer la description
    if (audioEnabled) {
      speechManagerRef.current.speak(description, 1, "scene_description");
    }
    
    return description;
  }, [audioEnabled]);

  /**
   * Retourne une description de la position d'un objet dans l'image
   */
  const getPositionDescription = (position, width, height) => {
    const { x, y } = position;
    let horizontal = "";
    let vertical = "";
    
    // Position horizontale
    if (x < width * 0.33) horizontal = "à gauche";
    else if (x > width * 0.66) horizontal = "à droite";
    else horizontal = "au centre";
    
    // Position verticale
    if (y < height * 0.33) vertical = "en haut";
    else if (y > height * 0.66) vertical = "en bas";
    else vertical = "au milieu";
    
    return `${horizontal} ${vertical}`;
  };

  /**
   * Dessine les prédictions sur le canvas
   */
  const drawPredictions = useCallback((predictions) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || video.readyState !== 4) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    // Mettre à jour les dimensions du canvas pour correspondre à la vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Effacer le canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Dessiner chaque prédiction
    predictions.forEach(prediction => {
      // Calculer la couleur basée sur la confiance
      const confidentColor = darkMode ? 'rgba(0, 255, 180, 0.8)' : 'rgba(0, 200, 120, 0.8)';
      const uncertainColor = darkMode ? 'rgba(255, 180, 0, 0.7)' : 'rgba(255, 150, 0, 0.7)';
      const boxColor = prediction.score > 0.5 ? confidentColor : uncertainColor;
      
      // Dessiner le rectangle autour de l'objet
      const [x, y, width, height] = prediction.bbox;
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Vérifier si l'objet est sélectionné
      const isSelected = selectedObject && 
                         selectedObject.class === prediction.class && 
                         Math.abs(selectedObject.bbox[0] - x) < 20 &&
                         Math.abs(selectedObject.bbox[1] - y) < 20;
      
      // Style pour le texte
      ctx.fillStyle = isSelected ? (darkMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)') : boxColor;
      ctx.font = isSelected ? 'bold 14px Arial' : '12px Arial';
      
      // Dessiner un fond pour le texte
      const label = `${prediction.class} ${(prediction.score * 100).toFixed(0)}%`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = isSelected ? 'rgba(0, 150, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y - 20, textWidth + 10, 20);
      
      // Dessiner le texte
      ctx.fillStyle = 'white';
      ctx.fillText(label, x + 5, y - 5);
      
      // Si l'objet est sélectionné, dessiner un halo
      if (isSelected) {
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.6)';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
      }
    });
  }, [selectedObject, darkMode]);

  /**
   * Capture l'image actuelle de la webcam
   */
  const captureImage = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      
      // Annoncer la capture
      if (audioEnabled) {
        speechManagerRef.current.speak("Image capturée", 2);
      }
      
      setIsDetecting(false);
      addLog("Image capturée pour analyse", "info");
    }
  }, [audioEnabled, addLog]);

  /**
   * Sauvegarde l'image capturée
   */
  const saveImage = useCallback(() => {
    if (capturedImage) {
      const link = document.createElement('a');
      link.href = capturedImage;
      link.download = `analyse-objets-${new Date().toISOString().replace(/:/g, '-')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addLog("Image sauvegardée", "success");
      
      if (audioEnabled) {
        speechManagerRef.current.speak("Image sauvegardée", 2);
      }
    }
  }, [capturedImage, audioEnabled, addLog]);

  /**
   * Reprend la détection en temps réel
   */
  const resumeLiveDetection = useCallback(() => {
    setCapturedImage(null);
    setIsDetecting(true);
    
    // Redémarrer la détection
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(processPredictions);
    
    addLog("Détection en direct reprise", "info");
  }, [processPredictions, addLog]);

  /**
   * Gère le clic sur un objet détecté
   */
  const handleObjectClick = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas || predictions.length === 0) return;
    
    // Calculer la position du clic relative au canvas
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    // Vérifier quel objet a été cliqué
    for (const prediction of predictions) {
      const [predX, predY, predWidth, predHeight] = prediction.bbox;
      if (x >= predX && x <= predX + predWidth && y >= predY && y <= predY + predHeight) {
        // Si l'objet est déjà sélectionné, le désélectionner
        if (selectedObject && 
            selectedObject.class === prediction.class && 
            Math.abs(selectedObject.bbox[0] - predX) < 20 && 
            Math.abs(selectedObject.bbox[1] - predY) < 20) {
          setSelectedObject(null);
        } else {
          // Sélectionner l'objet
          setSelectedObject(prediction);
          
          // Annoncer l'objet sélectionné
          if (audioEnabled) {
            const message = `${prediction.class} sélectionné. Certitude: ${prediction.certainty.toLowerCase()}.`;
            speechManagerRef.current.speak(message, 2);
          }
        }
        return;
      }
    }
    
    // Si on clique en dehors de tout objet, désélectionner
    setSelectedObject(null);
  }, [predictions, selectedObject, audioEnabled]);

  /**
   * Change la caméra entre avant et arrière
   */
  const switchCamera = useCallback(() => {
    setCameraFacingMode(prev => prev === "user" ? "environment" : "user");
    addLog(`Changement de caméra: ${cameraFacingMode === "user" ? "arrière" : "avant"}`, "info");
  }, [cameraFacingMode, addLog]);

  /**
   * Initialise la détection lors du chargement de la webcam
   */
  const handleWebcamLoad = useCallback(() => {
    if (!loadingModel && webcamRef.current && isDetecting) {
      // Démarrer la détection d'objets
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(processPredictions);
      
      addLog("Webcam prête, démarrage de la détection", "info");
    }
  }, [loadingModel, isDetecting, processPredictions, addLog]);

  // Configuration de la webcam
  const videoConstraints = {
    facingMode: cameraFacingMode,
    width: 1280,
    height: 720
  };

  // Rendu conditionnel en fonction de l'état de chargement
  if (loadingModel) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h2>Chargement des modèles d'intelligence artificielle...</h2>
        <p>Cette opération peut prendre quelques instants.</p>
        <div className="logs-container">
          {aiLogs.slice(-5).map((log, index) => (
            <div key={index} className={`log-entry log-${log.type}`}>
              <span className="log-time">{log.timestamp}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Affichage de message d'erreur
  if (errorMessage) {
    return (
      <div className="error-container">
        <FaInfoCircle size={40} className="error-icon" />
        <h2>Problème lors du chargement</h2>
        <p>{errorMessage}</p>
        <button onClick={() => window.location.reload()}>Recharger l'application</button>
      </div>
    );
  }

  return (
    <div className={`analyse-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* Barre d'outils supérieure */}
      <div className="toolbar">
        <button onClick={() => setShowSettings(!showSettings)}>
          <FaCog /> Paramètres
        </button>
        <button onClick={switchCamera}>
          <FaExchangeAlt /> Changer caméra
        </button>
        <button onClick={() => setAudioEnabled(!audioEnabled)}>
          {audioEnabled ? <FaVolumeUp /> : <FaVolumeMute />} Audio
        </button>
        <button onClick={() => setShowAiLogs(!showAiLogs)}>
          <FaBrain /> Logs IA
        </button>
      </div>
      
      {/* Panneau des paramètres */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            className="settings-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <h3>Paramètres</h3>
            
            <div className="settings-group">
              <label>Mode de détection:</label>
              <div className="radio-group">
                <label>
                  <input 
                    type="radio" 
                    value="fast" 
                    checked={detectionMode === "fast"} 
                    onChange={() => setDetectionMode("fast")} 
                  />
                  Rapide
                </label>
                <label>
                  <input 
                    type="radio" 
                    value="normal" 
                    checked={detectionMode === "normal"} 
                    onChange={() => setDetectionMode("normal")} 
                  />
                  Normal
                </label>
                <label>
                  <input 
                    type="radio" 
                    value="detail" 
                    checked={detectionMode === "detail"} 
                    onChange={() => setDetectionMode("detail")} 
                  />
                  Détaillé
                </label>
              </div>
            </div>
            
            <div className="settings-group">
              <label>Zoom: {zoomLevel.toFixed(1)}x</label>
              <div className="range-with-buttons">
                <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.1))}>
                  <BsZoomOut />
                </button>
                <input 
                  type="range" 
                  min="1" 
                  max="3" 
                  step="0.1" 
                  value={zoomLevel} 
                  onChange={e => setZoomLevel(parseFloat(e.target.value))} 
                />
                <button onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.1))}>
                  <BsZoomIn />
                </button>
              </div>
            </div>
            
            <div className="settings-group">
              <label>Luminosité: {brightness}%</label>
              <input 
                type="range" 
                min="50" 
                max="150" 
                value={brightness} 
                onChange={e => setBrightness(parseInt(e.target.value))} 
              />
            </div>
            
            <div className="settings-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={() => setDarkMode(!darkMode)} 
                />
                Mode sombre
              </label>
            </div>
            
            <div className="settings-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={enableCloudAnalysis} 
                  onChange={() => setEnableCloudAnalysis(!enableCloudAnalysis)} 
                />
                Analyse avancée (cloud)
              </label>
            </div>
            
            <button className="close-button" onClick={() => setShowSettings(false)}>
              Fermer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Zone principale avec webcam et détection */}
      <div className="main-content">
        <div className="webcam-container" style={{ transform: `scale(${zoomLevel})` }}>
          {capturedImage ? (
            <img 
              src={capturedImage} 
              alt="Captured" 
              className="captured-image"
              style={{ filter: `brightness(${brightness}%)` }}
            />
          ) : (
            <Webcam
              ref={webcamRef}
              videoConstraints={videoConstraints}
              onLoadedData={handleWebcamLoad}
              screenshotFormat="image/jpeg"
              mirrored={cameraFacingMode === "user"}
              className="webcam"
              style={{ filter: `brightness(${brightness}%)` }}
            />
          )}
          <canvas 
            ref={canvasRef} 
            className="detection-canvas"
            onClick={handleObjectClick}
          />
        </div>
        
        {/* Panneau d'information sur l'objet sélectionné */}
        <AnimatePresence>
          {selectedObject && (
            <motion.div 
              className="object-info-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="object-header">
                <span className="object-icon">{selectedObject.icon || '🔍'}</span>
                <h3>{selectedObject.class}</h3>
                <span className={`confidence-badge confidence-${selectedObject.certainty.toLowerCase()}`}>
                  {selectedObject.certainty} ({(selectedObject.score * 100).toFixed(0)}%)
                </span>
              </div>
              
              <div className="object-details">
                <p><strong>Caractéristiques:</strong> {selectedObject.caracteristiques}</p>
                <p><strong>Utilisation:</strong> {selectedObject.utilisation}</p>
                
                <div className="tags-container">
                  <strong>Catégories:</strong>
                  <div className="tags">
                    {selectedObject.categories?.map((cat, index) => (
                      <span key={index} className="tag category-tag">{cat}</span>
                    ))}
                  </div>
                </div>
                
                <div className="tags-container">
                  <strong>Matériaux:</strong>
                  <div className="tags">
                    {selectedObject.materiaux?.map((mat, index) => (
                      <span key={index} className="tag material-tag">{mat}</span>
                    ))}
                  </div>
                </div>
                
                <p><strong>Conseil:</strong> {selectedObject.conseil}</p>
                
                <div className="dimensions-info">
                  <strong>Dimensions:</strong>
                  <ul>
                    <li>Largeur: {selectedObject.dimensions.pixels.width}px</li>
                    <li>Hauteur: {selectedObject.dimensions.pixels.height}px</li>
                    {selectedObject.dimensions.estimationTailleReelle && (
                      <li className="estimation">
                        Estimation réelle: {selectedObject.dimensions.estimationTailleReelle.notes || "Non disponible"}
                      </li>
                    )}
                  </ul>
                </div>
                
                {selectedObject.source && (
                  <p className="source-info">
                    <strong>Source:</strong> {selectedObject.source}
                  </p>
                )}
              </div>
              
              <button className="close-info-button" onClick={() => setSelectedObject(null)}>
                Fermer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Description de la scène */}
      {lastSceneDescription && (
        <div className="scene-description">
          <FaRobot className="scene-icon" />
          <p>{lastSceneDescription}</p>
        </div>
      )}
      
      {/* Contrôles de capture */}
      <div className="capture-controls">
        {capturedImage ? (
          <>
            <button className="control-button" onClick={saveImage}>
              <FaSave /> Sauvegarder
            </button>
            <button className="control-button" onClick={resumeLiveDetection}>
              <FaCamera /> Reprendre
            </button>
          </>
        ) : (
          <button className="control-button capture-button" onClick={captureImage}>
            <FaCamera /> Capturer
          </button>
        )}
      </div>
      
      {/* Logs IA */}
      <AnimatePresence>
        {showAiLogs && (
          <motion.div 
            className="ai-logs-panel"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
          >
            <h3>Logs d'Intelligence Artificielle</h3>
            <div className="logs-container">
              {aiLogs.map((log, index) => (
                <div key={index} className={`log-entry log-${log.type}`}>
                  <span className="log-time">{log.timestamp}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
            </div>
            <button className="close-button" onClick={() => setShowAiLogs(false)}>
              Fermer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Classe pour gérer la synthèse vocale avec file d'attente
 */
class SpeechManager {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.enabled = true;
    this.utterance = null;
    this.lastSpokenMessages = {};
  }
  
  initialize() {
    // Vérifier si la synthèse vocale est disponible
    if (!('speechSynthesis' in window)) {
      console.warn("La synthèse vocale n'est pas supportée par ce navigateur.");
      this.enabled = false;
    }
  }
  
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }
  
  speak(text, priority = 1, id = null, timestamp = Date.now()) {
    if (!this.enabled) return;
    
    // Si un ID est fourni, vérifier si le message a déjà été dit récemment
    if (id && this.lastSpokenMessages[id] && 
        timestamp - this.lastSpokenMessages[id] < 5000) {
      return; // Ne pas répéter le même message trop rapidement
    }
    
    // Ajouter à la file d'attente
    this.queue.push({ text, priority, id, timestamp });
    
    // Trier la file par priorité (1 est la plus haute)
    this.queue.sort((a, b) => a.priority - b.priority);
    
    // Si rien n'est en cours de lecture, commencer
    if (!this.speaking) {
      this.processQueue();
    }
  }
  
  processQueue() {
    if (this.queue.length === 0 || !this.enabled) {
      this.speaking = false;
      return;
    }
    
    this.speaking = true;
    const item = this.queue.shift();
    
    // Enregistrer ce message comme récemment dit
    if (item.id) {
      this.lastSpokenMessages[item.id] = item.timestamp;
    }
    
    // Créer et configurer l'élément de synthèse vocale
    this.utterance = new SpeechSynthesisUtterance(item.text);
    this.utterance.lang = 'fr-FR';
    this.utterance.rate = 1.1;  // Légèrement plus rapide
    this.utterance.pitch = 1.0;
    
    // Quand la parole est terminée, passer au message suivant
    this.utterance.onend = () => {
      this.utterance = null;
      // Attendre un court instant avant de passer au message suivant
      setTimeout(() => this.processQueue(), 100);
    };
    
    // En cas d'erreur, continuer la file
    this.utterance.onerror = (e) => {
      console.error("Erreur de synthèse vocale:", e);
      this.utterance = null;
      setTimeout(() => this.processQueue(), 100);
    };
    
    // Commencer la synthèse
    window.speechSynthesis.speak(this.utterance);
  }
  
  cancel() {
    // Arrêter toute synthèse en cours
    window.speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
    this.utterance = null;
  }
}

export default Analyse;

