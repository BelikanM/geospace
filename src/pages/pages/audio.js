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

// Base de données des objets enrichie
const objetInfos = {
  person: {
    icon: '👤',
    caracteristiques: "Être humain avec capacités cognitives avancées, dotée d'une structure bipède, d'expressions faciales et d'une posture verticale distinctive.",
    utilisation: "Interaction sociale, travail, création artistique, recherche scientifique, sports, éducation.",
    categories: ["être vivant", "mammifère"],
    materiaux: ["organique"],
    histoire: "L'être humain moderne (Homo sapiens) existe depuis environ 300 000 ans.",
    conseil: "Respectez les personnes et leur espace personnel lors de vos prises de vue.",
    dimensionsMoyennes: { hauteur: "1.75m", largeur: "0.5m", profondeur: "0.25m" },
    poidsEstime: "70kg",
    textePotentiel: "Vêtements, accessoires, badges"
  },
  cell_phone: {
    icon: '📱',
    caracteristiques: "Appareil électronique portable rectangulaire avec écran tactile, caméras intégrées et diverses connectivités sans fil.",
    utilisation: "Communication (appels, messages), navigation web, réseaux sociaux, photographie, vidéo, jeux, applications diverses.",
    categories: ["électronique", "communication"],
    materiaux: ["métal", "verre", "plastique", "composants électroniques"],
    histoire: "Le premier smartphone largement commercialisé était l'iPhone d'Apple en 2007.",
    conseil: "Protégez votre téléphone avec une coque et un verre trempé pour prolonger sa durée de vie.",
    dimensionsMoyennes: { hauteur: "15cm", largeur: "7cm", profondeur: "0.8cm" },
    poidsEstime: "170g",
    textePotentiel: "Marque, modèle, notifications à l'écran"
  },
  cup: {
    icon: '☕',
    caracteristiques: "Récipient creux généralement cylindrique ou conique avec une anse, conçu pour contenir des liquides.",
    utilisation: "Boire des boissons chaudes ou froides comme le café, le thé, l'eau ou autres liquides.",
    categories: ["récipient", "ustensile de cuisine"],
    materiaux: ["céramique", "verre", "plastique", "métal", "porcelaine"],
    histoire: "Les premières tasses datent d'environ 10 000 ans avant J.-C., fabriquées en argile.",
    conseil: "Les tasses en céramique conservent mieux la chaleur des boissons chaudes.",
    dimensionsMoyennes: { hauteur: "10cm", diametre: "8cm" },
    poidsEstime: "300g",
    textePotentiel: "Logo, nom de marque, inscriptions décoratives"
  },
  chair: {
    icon: '🪑',
    caracteristiques: "Meuble à quatre pieds avec dossier, conçu pour permettre à une personne de s'asseoir confortablement.",
    utilisation: "S'asseoir pour se reposer, manger, travailler, étudier ou socialiser.",
    categories: ["mobilier", "ameublement"],
    materiaux: ["bois", "métal", "plastique", "tissu", "cuir"],
    histoire: "Les chaises existent depuis l'Égypte ancienne, mais n'étaient utilisées que par les personnes de haut rang.",
    conseil: "Une bonne chaise ergonomique peut prévenir les douleurs dorsales lors d'une utilisation prolongée.",
    dimensionsMoyennes: { hauteur: "85cm", largeur: "45cm", profondeur: "50cm" },
    poidsEstime: "5-10kg",
    textePotentiel: "Marque, étiquette de fabrication, code-barre"
  },
  laptop: {
    icon: '💻',
    caracteristiques: "Ordinateur portable avec clavier intégré, écran rabattable, touchpad et webcam.",
    utilisation: "Travail, jeux, navigation internet, programmation, design, montage vidéo, éducation.",
    categories: ["électronique", "informatique"],
    materiaux: ["aluminium", "plastique", "composants électroniques", "verre"],
    histoire: "Le premier ordinateur portable commercial, l'Osborne 1, est apparu en 1981.",
    conseil: "Nettoyez régulièrement le clavier et les évents pour prolonger la durée de vie de votre ordinateur portable.",
    dimensionsMoyennes: { hauteur: "1.5-2.5cm", largeur: "30-40cm", profondeur: "20-30cm" },
    poidsEstime: "1.2-2.5kg",
    textePotentiel: "Marque, modèle, autocollants, touches de clavier"
  },
  book: {
    icon: '📚',
    caracteristiques: "Ensemble de feuilles imprimées ou manuscrites reliées ensemble, contenant du texte et parfois des images.",
    utilisation: "Lecture, apprentissage, divertissement, référence, documentation.",
    categories: ["objet culturel", "média"],
    materiaux: ["papier", "carton", "encre", "colle", "fil"],
    histoire: "Les premiers livres imprimés datent de la Chine du 9ème siècle, avec l'invention de l'imprimerie par Bi Sheng.",
    conseil: "Gardez vos livres à l'abri de l'humidité et de la lumière directe du soleil pour préserver leur état.",
    dimensionsMoyennes: { hauteur: "20-30cm", largeur: "15-20cm", epaisseur: "1-5cm" },
    poidsEstime: "300-1000g",
    textePotentiel: "Titre, auteur, éditeur, texte des pages"
  },
  bottle: {
    icon: '🍾',
    caracteristiques: "Récipient étroit avec un goulot, souvent cylindrique, conçu pour stocker et servir des liquides.",
    utilisation: "Contenir et transporter des boissons ou liquides comme l'eau, le vin, l'huile ou produits cosmétiques.",
    categories: ["contenant", "récipient"],
    materiaux: ["verre", "plastique", "métal", "céramique"],
    histoire: "Les bouteilles en verre sont utilisées depuis l'époque romaine, mais la production industrielle a commencé au 17ème siècle.",
    conseil: "Les bouteilles réutilisables sont écologiques et économiques à long terme.",
    dimensionsMoyennes: { hauteur: "20-30cm", diametre: "5-10cm" },
    poidsEstime: "Vide: 100-500g, Pleine: 500-1500g",
    textePotentiel: "Marque, étiquette, informations nutritionnelles, volume"
  },
  keyboard: {
    icon: '⌨️',
    caracteristiques: "Périphérique d'entrée composé de touches organisées permettant la saisie de texte et commandes.",
    utilisation: "Saisie de texte, commandes informatiques, jeux vidéo, programmation, communication écrite.",
    categories: ["périphérique", "informatique"],
    materiaux: ["plastique", "métal", "composants électroniques", "caoutchouc"],
    histoire: "Le clavier moderne QWERTY a été inventé par Christopher Latham Sholes en 1868 pour les machines à écrire.",
    conseil: "Nettoyez régulièrement votre clavier pour éliminer poussière et débris qui peuvent affecter son fonctionnement.",
    dimensionsMoyennes: { hauteur: "2-4cm", largeur: "30-45cm", profondeur: "12-18cm" },
    poidsEstime: "500-1200g",
    textePotentiel: "Touches, marque, modèle, indications fonctionnelles"
  },
  backpack: {
    icon: '🎒',
    caracteristiques: "Sac à dos porté sur les épaules avec des bretelles, comportant généralement plusieurs compartiments.",
    utilisation: "Transport de livres, ordinateurs, vêtements, équipement de randonnée, fournitures scolaires.",
    categories: ["accessoire", "bagagerie"],
    materiaux: ["tissu", "nylon", "cuir", "polyester", "métal (pour les fermetures)"],
    histoire: "Le sac à dos moderne a été développé dans les années 1920 pour les activités de plein air.",
    conseil: "Répartissez le poids uniformément et utilisez les deux bretelles pour éviter les douleurs dorsales.",
    dimensionsMoyennes: { hauteur: "40-55cm", largeur: "30-40cm", profondeur: "15-30cm" },
    poidsEstime: "Vide: 500-1500g",
    textePotentiel: "Marque, logo, étiquettes de propriété"
  },
  couch: {
    icon: '🛋️',
    caracteristiques: "Meuble rembourré pour s'asseoir, avec dossier et accoudoirs, pouvant accueillir plusieurs personnes.",
    utilisation: "S'asseoir, se détendre, regarder la télévision, faire la sieste, socialiser.",
    categories: ["mobilier", "ameublement"],
    materiaux: ["bois", "tissu", "cuir", "mousse", "métal"],
    histoire: "Le canapé moderne remonte au 17ème siècle en Europe, mais des meubles similaires existaient dans l'Antiquité.",
    conseil: "Tournez régulièrement les coussins pour assurer une usure uniforme et prolonger la durée de vie du canapé.",
    dimensionsMoyennes: { hauteur: "80-100cm", largeur: "180-250cm", profondeur: "80-120cm" },
    poidsEstime: "50-150kg",
    textePotentiel: "Étiquette du fabricant, instructions d'entretien"
  },
  clock: {
    icon: '🕰️',
    caracteristiques: "Instrument de mesure du temps avec cadran ou affichage numérique, mécanisme interne et souvent aiguilles.",
    utilisation: "Mesure et affichage du temps, réveil, décoration.",
    categories: ["instrument", "décoration"],
    materiaux: ["métal", "plastique", "verre", "bois", "composants électroniques"],
    histoire: "Les premières horloges mécaniques sont apparues en Europe au 13ème siècle.",
    conseil: "Les horloges traditionnelles nécessitent un remontage ou un changement de piles régulier.",
    dimensionsMoyennes: { hauteur: "10-30cm", largeur: "10-30cm", profondeur: "3-10cm" },
    poidsEstime: "500-3000g",
    textePotentiel: "Chiffres, marque, indications horaires"
  },
  tv: {
    icon: '📺',
    caracteristiques: "Appareil électronique avec écran plat capable d'afficher des images et du son provenant de diverses sources.",
    utilisation: "Visionnage de programmes télévisés, films, séries, jeux vidéo, présentation de contenus.",
    categories: ["électronique", "multimédia"],
    materiaux: ["plastique", "verre", "composants électroniques", "métal"],
    histoire: "La première télévision commerciale a été introduite dans les années 1920, mais la diffusion de masse a commencé après 1945.",
    conseil: "Maintenez une distance d'au moins 2.5 fois la diagonale de l'écran pour un confort visuel optimal.",
    dimensionsMoyennes: { hauteur: "40-80cm", largeur: "60-200cm", profondeur: "3-10cm" },
    poidsEstime: "5-50kg selon la taille",
    textePotentiel: "Marque, modèle, boutons d'interface, menus à l'écran"
  },
  mouse: {
    icon: '🖱️',
    caracteristiques: "Périphérique de pointage pour ordinateur, généralement avec au moins deux boutons et parfois une molette de défilement.",
    utilisation: "Navigation sur interface graphique, sélection, glisser-déposer, jeux vidéo.",
    categories: ["périphérique", "informatique"],
    materiaux: ["plastique", "composants électroniques", "métal"],
    histoire: "La première souris a été inventée par Douglas Engelbart en 1963 et présentée publiquement en 1968.",
    conseil: "Utilisez un tapis de souris pour améliorer la précision et protéger la surface de votre bureau.",
    dimensionsMoyennes: { hauteur: "3-4cm", largeur: "6-8cm", longueur: "10-13cm" },
    poidsEstime: "80-150g",
    textePotentiel: "Marque, modèle, indications des boutons"
  },
  remote: {
    icon: '🎮',
    caracteristiques: "Dispositif électronique portatif avec boutons permettant de contrôler un appareil à distance.",
    utilisation: "Contrôle de téléviseurs, systèmes audio, climatiseurs, projecteurs et autres appareils électroniques.",
    categories: ["électronique", "contrôle"],
    materiaux: ["plastique", "caoutchouc", "composants électroniques"],
    histoire: "Les premières télécommandes pour téléviseurs sont apparues dans les années 1950.",
    conseil: "Nettoyez régulièrement votre télécommande, car elle peut accumuler beaucoup de bactéries avec l'utilisation.",
    dimensionsMoyennes: { hauteur: "1-2cm", largeur: "4-6cm", longueur: "15-20cm" },
    poidsEstime: "100-200g avec piles",
    textePotentiel: "Boutons numérotés, indications de fonctions, marque"
  },
  microwave: {
    icon: '📠',
    caracteristiques: "Appareil électroménager rectangulaire avec porte, panneau de contrôle et cavité interne pour chauffer les aliments.",
    utilisation: "Réchauffage et cuisson rapide d'aliments par micro-ondes.",
    categories: ["électroménager", "cuisine"],
    materiaux: ["métal", "plastique", "verre", "composants électroniques"],
    histoire: "Le premier four à micro-ondes commercial, le Radarange, a été lancé en 1947 par Raytheon.",
    conseil: "Évitez de mettre des objets métalliques dans un micro-ondes en fonctionnement pour éviter les arcs électriques.",
    dimensionsMoyennes: { hauteur: "30-40cm", largeur: "45-60cm", profondeur: "30-45cm" },
    poidsEstime: "10-20kg",
    textePotentiel: "Marque, modèle, boutons de contrôle, indications de puissance"
  },
  umbrella: {
    icon: '☂️',
    caracteristiques: "Dispositif pliable avec toile tendue sur une armature pour protéger de la pluie ou du soleil.",
    utilisation: "Protection contre les intempéries (pluie, neige) et parfois contre le soleil.",
    categories: ["accessoire", "protection"],
    materiaux: ["tissu", "métal", "plastique", "fibre de verre"],
    histoire: "Les parapluies existent depuis plus de 4000 ans, d'abord utilisés comme protection solaire en Égypte et Chine anciennes.",
    conseil: "Laissez sécher votre parapluie ouvert après utilisation pour éviter la moisissure et la rouille.",
    dimensionsMoyennes: { hauteur: "60-100cm (fermé)", diametre: "80-120cm (ouvert)" },
    poidsEstime: "300-800g",
    textePotentiel: "Marque, motifs décoratifs"
  }
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
 * Composant principal d'analyse d'objets en temps réel
 */
const Analyse = () => {
  // Références
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const speechSynthesisRef = useRef(null);

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
    }
  }, [audioEnabled]);

  // Charger le modèle
  useEffect(() => {
    const loadModel = async () => {
      try {
        setLoadingModel(true);
        
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
        if (audioEnabled) {
          window.speechSynthesis.cancel(); // Annuler tout message en cours
          const speech = new SpeechSynthesisUtterance("Système d'analyse d'objets prêt à l'emploi");
          window.speechSynthesis.speak(speech);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des modèles:", error);
        setErrorMessage(`Impossible de charger les modèles d'IA. ${error.message || "Veuillez vérifier votre connexion internet et recharger l'application."}`);
        setLoadingModel(false);
      }
    };
    
    loadModel();
    
    return () => {
      // Nettoyage à la fermeture
      window.speechSynthesis.cancel();
      console.log("Nettoyage des ressources...");
    };
  }, [detectionMode, audioEnabled]);
  
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
        
        // Notification vocale pour la détection principale
        if (audioEnabled && enhancedPredictions.length > 0 && enhancedPredictions[0].score > 0.7) {
          // Annuler toute synthèse en cours
          window.speechSynthesis.cancel();
          
          const topPrediction = enhancedPredictions[0];
          const speech = new SpeechSynthesisUtterance(
            `Détecté: ${topPrediction.class} avec ${Math.round(topPrediction.score * 100)}% de confiance`
          );
          window.speechSynthesis.speak(speech);
        }
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
  }, [isDetecting, selectedObject, zoomLevel, brightness, audioEnabled, detectionInterval]);

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

        if (audioEnabled) {
          window.speechSynthesis.cancel();
          const speech = new SpeechSynthesisUtterance("Photo capturée");
          window.speechSynthesis.speak(speech);
        }
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
    }
  };

  /**
   * Retour au mode de détection en direct
   */
  const resumeLiveDetection = () => {
    setCapturedImage(null);
    setIsDetecting(true);
  };

  /**
   * Change la caméra (avant/arrière sur mobile)
   */
  const switchCamera = () => {
    setCameraFacingMode(prev => (prev === "user" ? "environment" : "user"));
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
                  if (audioEnabled) {
                    window.speechSynthesis.cancel();
                    const speech = new SpeechSynthesisUtterance("Image sauvegardée dans votre galerie");
                    window.speechSynthesis.speak(speech);
                  }
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
                    onClick={() => setSelectedObject(isSelected ? null : item)}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Analyse;

