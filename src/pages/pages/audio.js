import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaHistory, FaSave, FaInfoCircle, FaCog, FaExchangeAlt, FaCloudUploadAlt, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { BsFillLightningFill, BsFillLightningChargeFill, BsZoomIn, BsZoomOut } from 'react-icons/bs';
import { MdPhotoLibrary, MdFlashOff } from 'react-icons/md';
import './Analyse.css';

// Modèle pré-entraîné enrichi
const objetInfos = {
  person: {
    icon: '👤',
    caracteristiques: "Être humain avec capacités cognitives avancées, dotée d'une structure bipède, d'expressions faciales et d'une posture verticale distinctive.",
    utilisation: "Interaction sociale, travail, création artistique, recherche scientifique, sports, éducation.",
    categories: ["être vivant", "mammifère"],
    materiaux: ["organique"],
    histoire: "L'être humain moderne (Homo sapiens) existe depuis environ 300 000 ans.",
    conseil: "Respectez les personnes et leur espace personnel lors de vos prises de vue."
  },
  cell_phone: {
    icon: '📱',
    caracteristiques: "Appareil électronique portable rectangulaire avec écran tactile, caméras intégrées et diverses connectivités sans fil.",
    utilisation: "Communication (appels, messages), navigation web, réseaux sociaux, photographie, vidéo, jeux, applications diverses.",
    categories: ["électronique", "communication"],
    materiaux: ["métal", "verre", "plastique", "composants électroniques"],
    histoire: "Le premier smartphone largement commercialisé était l'iPhone d'Apple en 2007.",
    conseil: "Protégez votre téléphone avec une coque et un verre trempé pour prolonger sa durée de vie."
  },
  cup: {
    icon: '☕',
    caracteristiques: "Récipient creux généralement cylindrique ou conique avec une anse, conçu pour contenir des liquides.",
    utilisation: "Boire des boissons chaudes ou froides comme le café, le thé, l'eau ou autres liquides.",
    categories: ["récipient", "ustensile de cuisine"],
    materiaux: ["céramique", "verre", "plastique", "métal", "porcelaine"],
    histoire: "Les premières tasses datent d'environ 10 000 ans avant J.-C., fabriquées en argile.",
    conseil: "Les tasses en céramique conservent mieux la chaleur des boissons chaudes."
  },
  chair: {
    icon: '🪑',
    caracteristiques: "Meuble à quatre pieds avec dossier, conçu pour permettre à une personne de s'asseoir confortablement.",
    utilisation: "S'asseoir pour se reposer, manger, travailler, étudier ou socialiser.",
    categories: ["mobilier", "ameublement"],
    materiaux: ["bois", "métal", "plastique", "tissu", "cuir"],
    histoire: "Les chaises existent depuis l'Égypte ancienne, mais n'étaient utilisées que par les personnes de haut rang.",
    conseil: "Une bonne chaise ergonomique peut prévenir les douleurs dorsales lors d'une utilisation prolongée."
  },
  laptop: {
    icon: '💻',
    caracteristiques: "Ordinateur portable avec clavier intégré, écran rabattable, touchpad et webcam.",
    utilisation: "Travail, jeux, navigation internet, programmation, design, montage vidéo, éducation.",
    categories: ["électronique", "informatique"],
    materiaux: ["aluminium", "plastique", "composants électroniques", "verre"],
    histoire: "Le premier ordinateur portable commercial, l'Osborne 1, est apparu en 1981.",
    conseil: "Nettoyez régulièrement le clavier et les évents pour prolonger la durée de vie de votre ordinateur portable."
  },
  book: {
    icon: '📚',
    caracteristiques: "Ensemble de feuilles imprimées ou manuscrites reliées ensemble, contenant du texte et parfois des images.",
    utilisation: "Lecture, apprentissage, divertissement, référence, documentation.",
    categories: ["objet culturel", "média"],
    materiaux: ["papier", "carton", "encre", "colle", "fil"],
    histoire: "Les premiers livres imprimés datent de la Chine du 9ème siècle, avec l'invention de l'imprimerie par Bi Sheng.",
    conseil: "Gardez vos livres à l'abri de l'humidité et de la lumière directe du soleil pour préserver leur état."
  },
  bottle: {
    icon: '🍾',
    caracteristiques: "Récipient étroit avec un goulot, souvent cylindrique, conçu pour stocker et servir des liquides.",
    utilisation: "Contenir et transporter des boissons ou liquides comme l'eau, le vin, l'huile ou produits cosmétiques.",
    categories: ["contenant", "récipient"],
    materiaux: ["verre", "plastique", "métal", "céramique"],
    histoire: "Les bouteilles en verre sont utilisées depuis l'époque romaine, mais la production industrielle a commencé au 17ème siècle.",
    conseil: "Les bouteilles réutilisables sont écologiques et économiques à long terme."
  },
  keyboard: {
    icon: '⌨️',
    caracteristiques: "Périphérique d'entrée composé de touches organisées permettant la saisie de texte et commandes.",
    utilisation: "Saisie de texte, commandes informatiques, jeux vidéo, programmation, communication écrite.",
    categories: ["périphérique", "informatique"],
    materiaux: ["plastique", "métal", "composants électroniques", "caoutchouc"],
    histoire: "Le clavier moderne QWERTY a été inventé par Christopher Latham Sholes en 1868 pour les machines à écrire.",
    conseil: "Nettoyez régulièrement votre clavier pour éliminer poussière et débris qui peuvent affecter son fonctionnement."
  },
  backpack: {
    icon: '🎒',
    caracteristiques: "Sac à dos porté sur les épaules avec des bretelles, comportant généralement plusieurs compartiments.",
    utilisation: "Transport de livres, ordinateurs, vêtements, équipement de randonnée, fournitures scolaires.",
    categories: ["accessoire", "bagagerie"],
    materiaux: ["tissu", "nylon", "cuir", "polyester", "métal (pour les fermetures)"],
    histoire: "Le sac à dos moderne a été développé dans les années 1920 pour les activités de plein air.",
    conseil: "Répartissez le poids uniformément et utilisez les deux bretelles pour éviter les douleurs dorsales."
  },
  couch: {
    icon: '🛋️',
    caracteristiques: "Meuble rembourré pour s'asseoir, avec dossier et accoudoirs, pouvant accueillir plusieurs personnes.",
    utilisation: "S'asseoir, se détendre, regarder la télévision, faire la sieste, socialiser.",
    categories: ["mobilier", "ameublement"],
    materiaux: ["bois", "tissu", "cuir", "mousse", "métal"],
    histoire: "Le canapé moderne remonte au 17ème siècle en Europe, mais des meubles similaires existaient dans l'Antiquité.",
    conseil: "Tournez régulièrement les coussins pour assurer une usure uniforme et prolonger la durée de vie du canapé."
  },
  // Ajout de nouveaux objets
  clock: {
    icon: '🕰️',
    caracteristiques: "Instrument de mesure du temps avec cadran ou affichage numérique, mécanisme interne et souvent aiguilles.",
    utilisation: "Mesure et affichage du temps, réveil, décoration.",
    categories: ["instrument", "décoration"],
    materiaux: ["métal", "plastique", "verre", "bois", "composants électroniques"],
    histoire: "Les premières horloges mécaniques sont apparues en Europe au 13ème siècle.",
    conseil: "Les horloges traditionnelles nécessitent un remontage ou un changement de piles régulier."
  },
  tv: {
    icon: '📺',
    caracteristiques: "Appareil électronique avec écran plat capable d'afficher des images et du son provenant de diverses sources.",
    utilisation: "Visionnage de programmes télévisés, films, séries, jeux vidéo, présentation de contenus.",
    categories: ["électronique", "multimédia"],
    materiaux: ["plastique", "verre", "composants électroniques", "métal"],
    histoire: "La première télévision commerciale a été introduite dans les années 1920, mais la diffusion de masse a commencé après 1945.",
    conseil: "Maintenez une distance d'au moins 2.5 fois la diagonale de l'écran pour un confort visuel optimal."
  },
  mouse: {
    icon: '🖱️',
    caracteristiques: "Périphérique de pointage pour ordinateur, généralement avec au moins deux boutons et parfois une molette de défilement.",
    utilisation: "Navigation sur interface graphique, sélection, glisser-déposer, jeux vidéo.",
    categories: ["périphérique", "informatique"],
    materiaux: ["plastique", "composants électroniques", "métal"],
    histoire: "La première souris a été inventée par Douglas Engelbart en 1963 et présentée publiquement en 1968.",
    conseil: "Utilisez un tapis de souris pour améliorer la précision et protéger la surface de votre bureau."
  },
  remote: {
    icon: '🎮',
    caracteristiques: "Dispositif électronique portatif avec boutons permettant de contrôler un appareil à distance.",
    utilisation: "Contrôle de téléviseurs, systèmes audio, climatiseurs, projecteurs et autres appareils électroniques.",
    categories: ["électronique", "contrôle"],
    materiaux: ["plastique", "caoutchouc", "composants électroniques"],
    histoire: "Les premières télécommandes pour téléviseurs sont apparues dans les années 1950.",
    conseil: "Nettoyez régulièrement votre télécommande, car elle peut accumuler beaucoup de bactéries avec l'utilisation."
  },
  microwave: {
    icon: '📠',
    caracteristiques: "Appareil électroménager rectangulaire avec porte, panneau de contrôle et cavité interne pour chauffer les aliments.",
    utilisation: "Réchauffage et cuisson rapide d'aliments par micro-ondes.",
    categories: ["électroménager", "cuisine"],
    materiaux: ["métal", "plastique", "verre", "composants électroniques"],
    histoire: "Le premier four à micro-ondes commercial, le Radarange, a été lancé en 1947 par Raytheon.",
    conseil: "Évitez de mettre des objets métalliques dans un micro-ondes en fonctionnement pour éviter les arcs électriques."
  },
  umbrella: {
    icon: '☂️',
    caracteristiques: "Dispositif pliable avec toile tendue sur une armature pour protéger de la pluie ou du soleil.",
    utilisation: "Protection contre les intempéries (pluie, neige) et parfois contre le soleil.",
    categories: ["accessoire", "protection"],
    materiaux: ["tissu", "métal", "plastique", "fibre de verre"],
    histoire: "Les parapluies existent depuis plus de 4000 ans, d'abord utilisés comme protection solaire en Égypte et Chine anciennes.",
    conseil: "Laissez sécher votre parapluie ouvert après utilisation pour éviter la moisissure et la rouille."
  },
  // Ajoutez d'autres objets selon vos besoins
};

// Fonction pour charger un modèle personnalisé en complément de coco-ssd
const loadCustomModel = async () => {
  // Simulation de chargement d'un modèle personnalisé
  // Dans une version réelle, vous chargeriez votre propre modèle TensorFlow.js ici
  console.log("Chargement du modèle personnalisé...");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulation
  console.log("Modèle personnalisé chargé");
  return true;
};

// Fonction pour enrichir les prédictions avec notre base de connaissances
const enrichPredictions = (predictions) => {
  return predictions.map(prediction => {
    const baseInfo = objetInfos[prediction.class] || {
      icon: '❓',
      caracteristiques: "Informations non disponibles dans notre base de connaissances.",
      utilisation: "Utilisation non spécifiée.",
      categories: ["non classifié"],
      materiaux: ["inconnu"],
      histoire: "Histoire non documentée.",
      conseil: "Aucun conseil disponible."
    };
    
    return {
      ...prediction,
      ...baseInfo,
      detectedAt: new Date().toISOString(),
      certainty: prediction.score > 0.8 ? "Élevée" : prediction.score > 0.6 ? "Moyenne" : "Faible",
    };
  });
};

const Analyse = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  
  // États de l'application
  const [predictions, setPredictions] = useState([]);
  const [history, setHistory] = useState([]);
  const [isDetecting, setIsDetecting] = useState(true);
  const [selectedObject, setSelectedObject] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState("environment");
  const [capturedImage, setCapturedImage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [detectionMode, setDetectionMode] = useState("normal"); // normal, detail, fast
  const [loadingModel, setLoadingModel] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Theme et UI
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  // Options de confidentialité
  const [saveHistory, setSaveHistory] = useState(true);
  const [enableCloudAnalysis, setEnableCloudAnalysis] = useState(false);
  
  // Effet pour le mode sombre
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Chargement du modèle
  useEffect(() => {
    const loadModel = async () => {
      try {
        setLoadingModel(true);
        
        // Assurer que TensorFlow.js utilise le backend WebGL pour des performances optimales
        await tf.setBackend('webgl');
        
        // Charger modèle COCO-SSD
        console.log("Chargement du modèle COCO-SSD...");
        const cocoModel = await cocoSsd.load({
          base: detectionMode === "fast" ? "lite_mobilenet_v2" : "mobilenet_v2"
        });
        
        // Charger notre modèle personnalisé en complément si nécessaire
        const customModelLoaded = await loadCustomModel();
        
        modelRef.current = {
          cocoModel,
          customModelLoaded,
          createdAt: new Date()
        };
        
        setLoadingModel(false);
        
        // Effectuer la synthèse vocale de bienvenue si l'audio est activé
        if (audioEnabled) {
          const speech = new SpeechSynthesisUtterance("Système d'analyse d'objets prêt à l'emploi");
          window.speechSynthesis.speak(speech);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des modèles:", error);
        setErrorMessage("Impossible de charger les modèles d'IA. Veuillez vérifier votre connexion internet et recharger la page.");
        setLoadingModel(false);
      }
    };
    
    loadModel();
    
    // Nettoyage à la fermeture
    return () => {
      if (modelRef.current) {
        console.log("Nettoyage des modèles...");
        // Ici, vous pourriez libérer les ressources si nécessaire
      }
    };
  }, [detectionMode, audioEnabled]);
  
  // Fonction de détection en boucle avec mémorisation pour optimisation
  const detectFrame = useCallback(async () => {
    if (
      !isDetecting || 
      !modelRef.current?.cocoModel || 
      !webcamRef.current || 
      !webcamRef.current.video || 
      webcamRef.current.video.readyState !== 4
    ) {
      return;
    }

    try {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Ajustement du canvas aux dimensions de la vidéo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Détection avec le modèle principal
      const rawPredictions = await modelRef.current.cocoModel.detect(video, 20); // Limiter à 20 détections max
      
      // Filtrer les prédictions avec un score minimum
      const filteredPredictions = rawPredictions
        .filter(prediction => prediction.score > 0.35) // Seuil de confiance minimum
        .sort((a, b) => b.score - a.score); // Trier par score décroissant
        
      // Enrichir les prédictions avec notre base de connaissances
      const enhancedPredictions = enrichPredictions(filteredPredictions);
      
      // Mise à jour des prédictions
      setPredictions(enhancedPredictions);
      
      // Sauvegarder dans l'historique si une nouvelle détection importante est faite
      if (saveHistory && enhancedPredictions.length > 0) {
        const topPrediction = enhancedPredictions[0];
        const alreadyInHistory = history.some(
          item => 
            item.class === topPrediction.class && 
            new Date().getTime() - new Date(item.timestamp).getTime() < 30000 // 30 secondes
        );
        
        if (!alreadyInHistory && topPrediction.score > 0.7) {
          setHistory(prev => {
            const newHistory = [
              { 
                ...topPrediction, 
                timestamp: new Date().toISOString(),
                thumbnailUrl: captureCurrentFrame(video)
              }, 
              ...prev.slice(0, 19)  // Garder les 20 dernières détections max
            ];
            // Sauvegarder l'historique dans le localStorage
            localStorage.setItem('objectDetectionHistory', JSON.stringify(newHistory));
            return newHistory;
          });
          
          // Notification vocale si activée
          if (audioEnabled) {
            const speech = new SpeechSynthesisUtterance(
              `Détecté: ${topPrediction.class} avec ${Math.round(topPrediction.score * 100)}% de confiance`
            );
            window.speechSynthesis.speak(speech);
          }
        }
      }

      // Nettoyer canevas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Appliquer les réglages (luminosité, zoom)
      ctx.filter = `brightness(${brightness}%)`;
      ctx.save();
      if (zoomLevel !== 1) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      
      // Dessiner la vidéo si on veut appliquer des filtres
      if (brightness !== 100 || zoomLevel !== 1) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Dessiner les rectangles de détection
      enhancedPredictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const isSelected = selectedObject && selectedObject.class === prediction.class;
        
        // Style rectangle avec animation fluide
        ctx.strokeStyle = isSelected ? '#FF3366' : '#00FFFF';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.lineJoin = 'round';
        
        // Rectangle avec coins arrondis
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 5);
        ctx.stroke();
        
        // Créer une info-bulle avec fond semi-transparent
        ctx.fillStyle = isSelected ? 'rgba(255, 51, 102, 0.8)' : 'rgba(0, 0, 0, 0.7)';
        
        const text = `${prediction.icon} ${prediction.class} : ${(prediction.score * 100).toFixed(0)}%`;
        const textWidth = ctx.measureText(text).width + 20;
        const bubbleHeight = 30;
        
        // Dessiner le fond de l'étiquette
        ctx.beginPath();
        ctx.roundRect(
          x - 5, 
          y > bubbleHeight + 10 ? y - bubbleHeight - 5 : y + height + 5, 
          textWidth, 
          bubbleHeight, 
          5
        );
        ctx.fill();
        
        // Texte de l'étiquette
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(
          text, 
          x + 5, 
          y > bubbleHeight + 10 ? y - bubbleHeight/2 - 5 : y + height + bubbleHeight/2 + 5
        );
        
        // Indicateur d'interaction
        if (detectionMode === "detail") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillText("Touchez pour plus d'infos", x + 5, y + height - 10);
        }
      });
      
      ctx.restore();
      ctx.filter = 'none';

    } catch (error) {
      console.error("Erreur pendant la détection:", error);
    }
    
    // Planifier la prochaine détection
    requestAnimationFrame(detectFrame);
  }, [
    isDetecting, 
    history, 
    selectedObject, 
    zoomLevel, 
    brightness, 
    audioEnabled, 
    detectionMode, 
    saveHistory
  ]);

  // Démarrer la détection en boucle
  useEffect(() => {
    if (!loadingModel) {
      detectFrame();
    }
  }, [detectFrame, loadingModel]);

  // Charger l'historique depuis le localStorage au démarrage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('objectDetectionHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Erreur lors du chargement de l'historique:", e);
    }
  }, []);

  // Fonction pour capturer une image de la webcam
  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setIsDetecting(false);
      
      if (audioEnabled) {
        const speech = new SpeechSynthesisUtterance("Photo capturée");
        window.speechSynthesis.speak(speech);
      }
    }
  };
  
  // Fonction pour analyser une image capturée
  const analyzeImage = async () => {
    if (!capturedImage || !modelRef.current?.cocoModel) return;
    
    try {
      // Créer un élément image pour l'analyse
      const img = new Image();
      img.src = capturedImage;
      
      // Attendre que l'image soit chargée
      await new Promise((resolve) => { img.onload = resolve; });
      
      // Détection sur l'image
      const rawPredictions = await modelRef.current.cocoModel.detect(img);
      const enhancedPredictions = enrichPredictions(
        rawPredictions.filter(p => p.score > 0.5)
      );
      
      setPredictions(enhancedPredictions);
      
      // Dessiner les résultats sur l'image capturée
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      // Dessiner les rectangles de détection
      enhancedPredictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        
        // Style rectangle
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        // Rectangle
        ctx.strokeRect(x, y, width, height);
        
        // Étiquette
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
      
      // Ajouter à l'historique
      if (saveHistory && enhancedPredictions.length > 0) {
        setHistory(prev => {
          const newHistory = [
            { 
              ...enhancedPredictions[0], 
              timestamp: new Date().toISOString(),
              thumbnailUrl: capturedImage
            }, 
            ...prev.slice(0, 19)
          ];
          localStorage.setItem('objectDetectionHistory', JSON.stringify(newHistory));
          return newHistory;
        });
      }
      
    } catch (error) {
      console.error("Erreur lors de l'analyse de l'image:", error);
    }
  };
  
  // Fonction pour reprendre la détection en direct
  const resumeLiveDetection = () => {
    setCapturedImage(null);
    setIsDetecting(true);
  };
  
  // Fonction utilitaire pour capturer une frame en base64
  const captureCurrentFrame = (videoElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.5); // Réduire la qualité pour économiser de l'espace
  };
  
  // Fonction pour changer la caméra (avant/arrière)
  const switchCamera = () => {
    setCameraFacingMode(prev => prev === "user" ? "environment" : "user");
  };
  
  // Fonction pour sauvegarder l'image courante dans la galerie
  const saveImage = () => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `detected-objects-${new Date().toISOString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (audioEnabled) {
      const speech = new SpeechSynthesisUtterance("Image sauvegardée dans votre galerie");
      window.speechSynthesis.speak(speech);
    }
  };
  
  // Fonction pour effacer l'historique
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('objectDetectionHistory');
    
    if (audioEnabled) {
      const speech = new SpeechSynthesisUtterance("Historique effacé");
      window.speechSynthesis.speak(speech);
    }
  };
  
  // Fonction pour charger une image depuis la galerie
  const loadImageFromGallery = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result);
        setIsDetecting(false);
        
        // Analyser l'image après chargement
        setTimeout(() => analyzeImage(), 100);
      };
      reader.readAsDataURL(file);
    }
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
        >
          <div className="loader"></div>
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
        >
          <FaInfoCircle size={24} />
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)}>Fermer</button>
        </motion.div>
      )}
      
      <div className="main-content">
        <div className="camera-container">
          {/* Conteneur de la caméra ou de l'image capturée */}
          <div className="camera-view">
            {!capturedImage ? (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    facingMode: cameraFacingMode,
                    aspectRatio: 4/3,
                  }}
                  className="webcam"
                  style={{ 
                    filter: `brightness(${brightness}%)`,
                    transform: `scale(${zoomLevel})` 
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
                />
                <canvas
                  ref={canvasRef}
                  className="detection-canvas"
                />
              </div>
            )}
            
            {/* Overlay d'information sur les objets sélectionnés */}
            {selectedObject && (
              <motion.div 
                className="object-detail-overlay"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <div className="object-detail-card">
                  <div className="object-header">
                    <div className="object-title">
                      <span className="object-icon">{selectedObject.icon}</span>
                      <h3>{selectedObject.class}</h3>
                    </div>
                    <span className="close-btn" onClick={() => setSelectedObject(null)}>×</span>
                  </div>
                  
                  <div className="object-body">
                    <div className="confidence-meter">
                      <span>Confiance: {(selectedObject.score * 100).toFixed(1)}%</span>
                      <div className="progress-bar">
                        <div 
                          className="progress" 
                          style={{ 
                            width: `${selectedObject.score * 100}%`,
                            backgroundColor: selectedObject.score > 0.7 ? '#4CAF50' : selectedObject.score > 0.5 ? '#FFC107' : '#F44336'
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
          
          {/* Barre d'outils de la caméra */}
          <div className="camera-toolbar">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={switchCamera}
              title="Changer de caméra"
            >
              <FaExchangeAlt />
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.1))}
              disabled={zoomLevel <= 1}
              title="Zoom arrière"
            >
              <BsZoomOut />
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className={`tool-button ${!capturedImage && "primary"}`}
              onClick={capturedImage ? analyzeImage : capturePhoto}
              title={capturedImage ? "Analyser l'image" : "Prendre une photo"}
            >
              <FaCamera />
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className="tool-button"
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}
              disabled={zoomLevel >= 3}
              title="Zoom avant"
            >
              <BsZoomIn />
            </motion.button>
            
            <label className="tool-button" title="Charger une image">
              <MdPhotoLibrary />
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={loadImageFromGallery}
              />
            </label>
          </div>
          
          {/* Contrôles supplémentaires quand une image est capturée */}
          {capturedImage && (
            <div className="capture-controls">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={resumeLiveDetection}
                className="control-button"
              >
                Retour à la caméra
              </motion.button>
              
                            <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={saveImage}
                className="control-button"
              >
                <FaSave /> Sauvegarder l'image
              </motion.button>
            </div>
          )}
        </div>

        {/* Liste des objets détectés en temps réel */}
        <div className="detected-list-container">
          <h2>Objets détectés</h2>
          {predictions.length === 0 && !loadingModel && <p>En attente de détection...</p>}

          <ul className="detected-list">
            <AnimatePresence>
              {predictions.map((item, index) => (
                <motion.li 
                  key={`${item.class}-${index}`}
                  className={`detected-item ${selectedObject?.class === item.class ? "selected" : ""}`}
                  onClick={() => {
                    if(selectedObject?.class === item.class) setSelectedObject(null);
                    else setSelectedObject(item);
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.05, backgroundColor: '#222' }}
                >
                  <span className="item-icon">{item.icon}</span>
                  <div className="item-text">
                    <strong>{item.class}</strong>
                    <span>{(item.score * 100).toFixed(1)}%</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {/* Historique des détections */}
<div className="history-section">
  <h3>Historique des analyses</h3>
  <div className="history-scrollbox">
    {history.length === 0 ? (
      <p>Aucune détection sauvegardée.</p>
    ) : (
      <ul className="history-list">
        {history.map((item, idx) => (
          <li key={`${item.class}-${idx}`} className="history-item">
            <img src={item.thumbnailUrl} alt={item.class} />
            <div className="history-item-info">
              <strong>{item.icon} {item.class}</strong>
              <small>{new Date(item.timestamp).toLocaleString()}</small>
            </div>
            <button 
              className="remove-btn" 
              onClick={(e) => {
                e.stopPropagation();
                const newHistory = history.filter((_, index) => index !== idx);
                setHistory(newHistory);
                localStorage.setItem('objectDetectionHistory', JSON.stringify(newHistory));
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
  <div className="history-actions">
    <motion.button 
      className="clear-history-btn"
      whileTap={{ scale: 0.9 }}
      onClick={clearHistory}
      disabled={history.length === 0}
      title="Effacer l'historique"
    >
      <FaHistory /> Effacer l'historique
    </motion.button>
  </div>
</div>

          {/* Paramètres et options */}
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
                <input 
                  type="checkbox" 
                  checked={saveHistory} 
                  onChange={() => setSaveHistory(!saveHistory)} 
                /> Sauvegarder historique des détections
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
                />&nbsp;{brightness}%
              </label>
            </div>
            <motion.button 
              className="settings-toggle-btn"
              onClick={() => setShowSettings(!showSettings)}
              whileTap={{ scale: 0.9 }}
            >
              <FaCog /> {showSettings ? "Cacher" : "Afficher"} paramètres avancés
            </motion.button>

            {/* Options avancées */}
            <AnimatePresence>
              {showSettings && (
                <motion.div 
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
                      /> Analyse dans le cloud (bientôt disponible)
                    </label>
                    <small className="coming-soon">⚠️</small>
                  </div>
                  {/* Ici vous pouvez ajouter d’autres fonctionnalités avancées */}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analyse;

