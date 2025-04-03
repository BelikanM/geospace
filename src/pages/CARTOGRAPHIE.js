import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import styled from 'styled-components';
import { databases, DATABASE_ID, COLLECTION_ID, ID } from './appwriteConfig'; // Assurez-vous que le chemin est correct

const CanvasContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: ${props => props.interactive ? 'auto' : 'none'};
  z-index: 500;
`;

const InfoOverlay = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 300px;
  z-index: 501;
`;

const ToggleButton = styled.button`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: ${props => props.active ? '#4CAF50' : '#555'};
  color: white;
  border: none;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 502;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);

  &:hover {
    transform: scale(1.1);
  }
`;

// Composant qui dessine un point pour chaque location
const LocationPoint = ({ position, color, isRecent }) => {
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current && isRecent) {
      meshRef.current.rotation.y += 0.01;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[isRecent ? 0.15 : 0.08, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={isRecent ? 0.9 : 0.6}
      />
      {isRecent && (
        <mesh position={[0, 0.3, 0]}>
          <Text
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            Vous êtes ici
          </Text>
        </mesh>
      )}
    </mesh>
  );
};

// Visualiseur 3D de l'environnement
const Environment = ({ locations, currentPosition, sensorData }) => {
  const groupRef = useRef();
  
  useFrame(() => {
    if (groupRef.current && sensorData) {
      // Convertir les degrés en radians pour la rotation
      if (sensorData.alpha !== undefined) {
        groupRef.current.rotation.z = THREE.MathUtils.degToRad(sensorData.alpha); // autour de l'axe z
      }
      if (sensorData.beta !== undefined) {
        groupRef.current.rotation.x = THREE.MathUtils.degToRad(sensorData.beta); // autour de l'axe x
      }
      if (sensorData.gamma !== undefined) {
        groupRef.current.rotation.y = THREE.MathUtils.degToRad(sensorData.gamma); // autour de l'axe y
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Grille de référence */}
      <gridHelper args={[20, 20, 0x888888, 0x444444]} />
      
      {/* Points de la trajectoire */}
      {locations.map((loc, index) => {
        // Calcule la position relative au point actuel
        const relPos = [
          (loc.latitude - currentPosition.lat) * 100,
          0, // Hauteur fixe pour simplifier
          (loc.longitude - currentPosition.lng) * 100
        ];
        
        return (
          <LocationPoint 
            key={loc.$id || index}
            position={relPos}
            color={index === 0 ? "#FF4500" : "#1E90FF"}
            isRecent={index === 0}
          />
        );
      })}
      
      {/* Direction du Nord */}
      <mesh position={[0, 0, -5]}>
        <boxGeometry args={[0.2, 0.2, 1]} />
        <meshStandardMaterial color="red" />
        <Text position={[0, 0.3, 0]} fontSize={0.3} color="red">N</Text>
      </mesh>
    </group>
  );
};

// Gestionnaire des données des capteurs
const SensorDataManager = ({ onDataUpdate }) => {
  useEffect(() => {
    let lastAlpha = null;
    let calibrated = false;
    let calibrationOffset = 0;

    const handleOrientation = (event) => {
      if (!calibrated && event.alpha !== null) {
        calibrationOffset = event.alpha;
        calibrated = true;
      }
      
      // Calculer l'angle ajusté (relatif à la calibration initiale)
      let adjustedAlpha = event.alpha - calibrationOffset;
      if (adjustedAlpha < 0) adjustedAlpha += 360;
      
      // Appliquer un lissage pour éviter les sauts brusques
      if (lastAlpha !== null) {
        // Limiter le changement maximum par mise à jour
        let diff = adjustedAlpha - lastAlpha;
        if (Math.abs(diff) > 180) {
          if (diff > 0) diff -= 360;
          else diff += 360;
        }
        
        // Lissage
        const smoothingFactor = 0.2;
        adjustedAlpha = lastAlpha + diff * smoothingFactor;
      }
      
      lastAlpha = adjustedAlpha;
      
      onDataUpdate({
        alpha: adjustedAlpha,
        beta: event.beta,   // rotation autour de l'axe x (-180-180)
        gamma: event.gamma  // rotation autour de l'axe y (-90-90)
      });
    };
    
    // Gestionnaire pour l'accéléromètre - pourrait être utilisé pour détecter les mouvements
    const handleMotion = (event) => {
      const accel = event.accelerationIncludingGravity;
      if (accel) {
        // Détection de mouvement de marche
        const magnitude = Math.sqrt(
          Math.pow(accel.x || 0, 2) + 
          Math.pow(accel.y || 0, 2) + 
          Math.pow(accel.z || 0, 2)
        );
        
        // Détecter les pas en analysant les pics d'accélération
        if (magnitude > 15) { // Seuil de détection de pas - à ajuster
          // On pourrait utiliser ceci pour estimer la distance parcourue
        }
      }
    };
    
    // Initialiser les capteurs
    if ('DeviceOrientationEvent' in window) {
      // Demande de permission pour les appareils iOS 13+
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
              window.addEventListener('devicemotion', handleMotion, true);
            } else {
              console.warn("Permission d'accès aux capteurs refusée");
            }
          })
          .catch(console.error);
      } else {
        // Pour les autres navigateurs qui ne nécessitent pas de permission explicite
        window.addEventListener('deviceorientation', handleOrientation, true);
        window.addEventListener('devicemotion', handleMotion, true);
      }
    } else {
      console.warn("L'orientation de l'appareil n'est pas prise en charge");
    }
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('devicemotion', handleMotion, true);
    };
  }, [onDataUpdate]);
  
  return null;
};

// Composant principal Space3DVisualizer
const Space3DVisualizer = ({ geoData = {} }) => {
  const [sensorData, setSensorData] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [spatialMapping, setSpatialMapping] = useState([]);
  const [infoMessage, setInfoMessage] = useState('');
  
  const { locationHistory = [], currentLocation } = geoData;
  
  // Convertir l'historique de localisation pour la visualisation
  const locations = locationHistory.length > 0 
    ? locationHistory.map(loc => ({
        latitude: loc.position.lat,
        longitude: loc.position.lng,
        $id: loc.id
      }))
    : [];
    
  // Ajouter la position actuelle si disponible
  if (currentLocation && currentLocation.lat && currentLocation.lng) {
    locations.unshift({
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      $id: 'current'
    });
  }

  // Gestionnaire des données de capteur
  const handleSensorUpdate = (data) => {
    setSensorData(data);
    
    if (isActive && currentLocation) {
      // Ajouter les données au mapping spatial
      const newMapping = {
        position: {
          lat: currentLocation.lat,
          lng: currentLocation.lng
        },
        orientation: {
          alpha: data.alpha,
          beta: data.beta,
          gamma: data.gamma
        },
        timestamp: new Date().toISOString()
      };
      
      setSpatialMapping(prev => [...prev.slice(-100), newMapping]); // Garder les 100 derniers points
      
      // Informations sur la détection
      setInfoMessage(`Orientation: α=${data.alpha.toFixed(1)}° β=${data.beta.toFixed(1)}° γ=${data.gamma.toFixed(1)}°`);
      
      // Enregistrer occasionnellement dans Appwrite
      if (Math.random() < 0.05) { // ~5% de chance pour limiter les écritures
        saveSpatialData(newMapping);
      }
    }
  };
  
  // Enregistrer les données dans Appwrite
  const saveSpatialData = async (mappingData) => {
    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        {
          user_id: 'anonymous', // Utilisez l'ID de l'utilisateur connecté si disponible
          latitude: mappingData.position.lat,
          longitude: mappingData.position.lng,
          orientation_alpha: mappingData.orientation.alpha,
          orientation_beta: mappingData.orientation.beta,
          orientation_gamma: mappingData.orientation.gamma,
          timestamp: mappingData.timestamp,
          data_type: 'spatial_mapping'
        }
      );
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement des données spatiales:', error);
    }
  };

  // Activer/désactiver la visualisation 3D
  const toggleVisualization = () => {
    if (!isActive) {
      setIsActive(true);
      setInfoMessage('Visualisation 3D activée. Tournez-vous pour explorer l\'espace.');
    } else {
      setIsActive(false);
      setInfoMessage('');
    }
  };
  
  // Activer/désactiver l'interaction
  const toggleInteraction = () => {
    setIsInteractive(!isInteractive);
  };

  if (!isActive) {
    return (
      <ToggleButton 
        active={isActive} 
        onClick={toggleVisualization}
      >
        Activer 3D
      </ToggleButton>
    );
  }

  return (
    <>
      <CanvasContainer interactive={isInteractive}>
        <Canvas 
          camera={{ position: [0, 3, 5], fov: 75 }}
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          
          {/* Étoiles en arrière-plan */}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
          
          {/* Environnement 3D */}
          <Environment 
            locations={locations} 
            currentPosition={currentLocation} 
            sensorData={sensorData} 
          />
          
          {/* Contrôles de la caméra - actifs uniquement en mode interactif */}
          <OrbitControls enabled={isInteractive} />
        </Canvas>
      </CanvasContainer>
      
      {/* Afficher des informations sur les capteurs */}
      <InfoOverlay>
        {infoMessage}
        <div>Points capturés: {spatialMapping.length}</div>
        <div style={{ marginTop: '5px', fontSize: '10px' }}>
          Double-tap pour {isInteractive ? 'désactiver' : 'activer'} les contrôles
        </div>
      </InfoOverlay>
      
      {/* Bouton pour désactiver */}
      <ToggleButton
        active={isActive}
        onClick={toggleVisualization}
        style={{ bottom: 90 }}
      >
        Désactiver 3D
      </ToggleButton>
      
      {/* Bouton pour basculer l'interaction */}
      <ToggleButton
        active={isInteractive}
        onClick={toggleInteraction}
      >
        {isInteractive ? 'Auto' : 'Manuel'}
      </ToggleButton>
      
      {/* Gestionnaire de capteurs */}
      <SensorDataManager onDataUpdate={handleSensorUpdate} />
    </>
  );
};

export default Space3DVisualizer;



