// pages/Map2D.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, Circle, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { databases, DATABASE_ID, COLLECTION_ID, ID } from './appwrite';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-contextmenu';
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css';
import 'leaflet-heatmap';
import debounce from 'lodash/debounce';

// Icon fix pour Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconComment from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let CommentIcon = L.icon({
  iconUrl: iconComment,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
  iconColor: 'gold'
});

L.Marker.prototype.options.icon = DefaultIcon;

// Composant pour mettre à jour la vue de carte quand la position change
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Composant pour gérer la géolocalisation
function LocationMarker({ setUserLocation, addToHistory }) {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const map = useMap();

  useEffect(() => {
    map.locate({ 
      watch: true, 
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    map.on('locationfound', (e) => {
      setPosition(e.latlng);
      setAccuracy(e.accuracy);
      setUserLocation([e.latlng.lat, e.latlng.lng]);
      
      // Ajouter le point à l'historique de navigation
      addToHistory([e.latlng.lat, e.latlng.lng]);
      
      map.flyTo(e.latlng, Math.max(16, map.getZoom()));
    });

    map.on('locationerror', (e) => {
      console.error("Erreur de géolocalisation:", e);
      alert("Impossible d'accéder à votre position. Vérifiez vos paramètres de géolocalisation.");
    });

    return () => {
      map.stopLocate();
      map.off('locationfound');
      map.off('locationerror');
    };
  }, [map, setUserLocation, addToHistory]);

  return position ? (
    <>
      <Marker position={position}>
        <Popup>
          Votre position<br/>
          Précision: {Math.round(accuracy)} mètres
        </Popup>
      </Marker>
      <Circle center={position} radius={accuracy} pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }} />
    </>
  ) : null;
}

export default function Map2D({ initialCenter = [48.8566, 2.3522] }) {
  const [userLocation, setUserLocation] = useState(initialCenter);
  const [buildings, setBuildings] = useState([]);
  const [roads, setRoads] = useState([]);
  const [water, setWater] = useState([]);
  const [landUse, setLandUse] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [elementData, setElementData] = useState({});
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    buildings: true,
    roads: true,
    water: true,
    landUse: true
  });
  
  // 1. Mode nuit / jour
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 2. Historique de navigation
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [showNavigationHistory, setShowNavigationHistory] = useState(false);
  
  // 3. Commentaires sur la carte
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(true);
  const [commentForm, setCommentForm] = useState({
    show: false,
    location: null,
    comment: '',
    rating: 3,
    title: ''
  });
  
  // 4. Favoris / lieux enregistrés
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(true);
  
  // 5. Filtrage avancé
  const [filters, setFilters] = useState({
    showFilters: false,
    types: {
      residential: true,
      commercial: true,
      educational: true,
      healthcare: true,
      restaurant: true,
      others: true
    }
  });

  // 6. Détails du plan d'urbanisme
  const [urbanPlan, setUrbanPlan] = useState(null);
  const [showUrbanPlan, setShowUrbanPlan] = useState(false);
  
  // 7. Données de l'écosystème
  const [ecosystemData, setEcosystemData] = useState(null);

  // 8. Dernière position analysée pour éviter des requêtes trop fréquentes
  const [lastAnalyzedPosition, setLastAnalyzedPosition] = useState(null);
  
  const mapRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const dataCacheRef = useRef({
    lastFetch: null,
    lastPosition: null,
    isFetching: false
  });
  
  // Gérer le mode jour/nuit automatiquement selon l'heure
  useEffect(() => {
    const checkDayNightMode = () => {
      const hours = new Date().getHours();
      // Mode nuit entre 19h et 6h du matin
      setIsDarkMode(hours >= 19 || hours < 6);
    };
    
    // Vérifier au démarrage
    checkDayNightMode();
    
    // Vérifier toutes les heures
    const interval = setInterval(checkDayNightMode, 3600000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Charger les commentaires, favoris et historique depuis localStorage au démarrage
  useEffect(() => {
    const loadSavedData = () => {
      try {
        // Charger les commentaires
        const savedComments = localStorage.getItem('mapComments');
        if (savedComments) {
          setComments(JSON.parse(savedComments));
        }
        
        // Charger les favoris
        const savedFavorites = localStorage.getItem('mapFavorites');
        if (savedFavorites) {
          setFavorites(JSON.parse(savedFavorites));
        }
        
        // Charger l'historique de navigation
        const savedHistory = localStorage.getItem('navigationHistory');
        if (savedHistory) {
          setNavigationHistory(JSON.parse(savedHistory));
        }
        
        // Charger le plan d'urbanisme
        const savedUrbanPlan = localStorage.getItem('urbanPlan');
        if (savedUrbanPlan) {
          setUrbanPlan(JSON.parse(savedUrbanPlan));
        }
        
        // Charger les données d'écosystème
        const savedEcosystemData = localStorage.getItem('ecosystemData');
        if (savedEcosystemData) {
          setEcosystemData(JSON.parse(savedEcosystemData));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données sauvegardées:", error);
      }
    };
    
    loadSavedData();
  }, []);
  
  // Fonction pour ajouter un point à l'historique
  const addToHistory = (position) => {
    // Limiter l'historique à 100 points pour éviter des problèmes de performance
    const updatedHistory = [...navigationHistory, {
      position,
      timestamp: new Date().toISOString()
    }].slice(-100);
    
    setNavigationHistory(updatedHistory);
    localStorage.setItem('navigationHistory', JSON.stringify(updatedHistory));
  };
  
  // Fonction pour ajouter un commentaire
  const addComment = () => {
    if (!commentForm.title || !commentForm.comment || !commentForm.location) {
      alert("Veuillez remplir tous les champs");
      return;
    }
    
    const newComment = {
      id: Date.now().toString(),
      title: commentForm.title,
      comment: commentForm.comment,
      rating: commentForm.rating,
      location: commentForm.location,
      timestamp: new Date().toISOString()
    };
    
    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    localStorage.setItem('mapComments', JSON.stringify(updatedComments));
    
    // Réinitialiser le formulaire
    setCommentForm({
      show: false,
      location: null,
      comment: '',
      rating: 3,
      title: ''
    });
  };
  
  // Fonction pour ajouter un favori
  const toggleFavorite = (element) => {
    const existingIndex = favorites.findIndex(fav => fav.id === element.id);
    
    let updatedFavorites;
    if (existingIndex >= 0) {
      // Supprimer des favoris
      updatedFavorites = favorites.filter(fav => fav.id !== element.id);
    } else {
      // Ajouter aux favoris
      updatedFavorites = [...favorites, {
        id: element.id,
        name: element.info.name || `${element.info.type} sans nom`,
        type: element.info.type,
        center: element.info.center,
        timestamp: new Date().toISOString()
      }];
    }
    
    setFavorites(updatedFavorites);
    localStorage.setItem('mapFavorites', JSON.stringify(updatedFavorites));
  };
  
  // Vérifier si un élément est dans les favoris
  const isFavorite = (elementId) => {
    return favorites.some(fav => fav.id === elementId);
  };

  // Vérifier si nous sommes trop près de la dernière position analysée
  const isCloseToLastAnalyzedPosition = (newLat, newLon) => {
    if (!lastAnalyzedPosition) return false;
    
    const [lastLat, lastLon] = lastAnalyzedPosition;
    
    // Calcul de la distance approximative en mètres
    const R = 6371e3; // rayon de la Terre en mètres
    const φ1 = lastLat * Math.PI/180;
    const φ2 = newLat * Math.PI/180;
    const Δφ = (newLat-lastLat) * Math.PI/180;
    const Δλ = (newLon-lastLon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Si moins de 200 mètres de différence, considérer comme trop proche
    return distance < 200;
  };

  // Version optimisée de fetchMapData avec retardement et déduplication
  const fetchMapData = useCallback(debounce(async (lat, lon, forceUpdate = false) => {
    // Vérifier si nous avons déjà analysé cette zone récemment
    if (!forceUpdate && isCloseToLastAnalyzedPosition(lat, lon)) {
      console.log("Zone déjà analysée récemment. Utilisation des données en cache.");
      return;
    }
    
    // Vérifier si une requête est déjà en cours
    if (dataCacheRef.current.isFetching) {
      console.log("Une requête est déjà en cours. Annulation de cette requête.");
      return;
    }

    dataCacheRef.current.isFetching = true;
    setLoading(true);
    
    try {
      // Récupérer les bâtiments, routes, eau et terrains avec Overpass API
      const query = `
        [out:json];
        (
          way[building](around:800,${lat},${lon});
          way[highway][highway!~"footway|path|service|track"](around:800,${lat},${lon});
          way[natural=water](around:800,${lat},${lon});
          way[landuse](around:800,${lat},${lon});
          node[amenity](around:800,${lat},${lon});
          way[amenity](around:800,${lat},${lon});
        );
        out geom;
      `;
      
      const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      const buildingsData = [];
      const roadsData = [];
      const waterData = [];
      const landUseData = [];
      const allElementsData = {};
      
      data.elements.forEach(el => {
        // Ignorer les nœuds qui ne sont pas des POI
        if (el.type === 'node' && !el.tags?.amenity) return;

        // Si c'est une voie, elle doit avoir une géométrie
        if (el.type === 'way' && (!el.geometry || el.geometry.length < 3)) return;
        
        let coords;
        let center;

        // Traitement selon le type d'élément
        if (el.type === 'way') {
          coords = el.geometry.map(pt => [pt.lat, pt.lon]);
          
          // Calculer le centre de l'élément
          center = coords.reduce(
            (acc, curr) => [acc[0] + curr[0]/coords.length, acc[1] + curr[1]/coords.length], 
            [0, 0]
          );
        } else if (el.type === 'node') {
          // Pour les nœuds, on utilise directement la position
          coords = [[el.lat, el.lon]];
          center = [el.lat, el.lon];
        }
        
        // Extraire les informations
        const info = {
          id: el.id,
          name: el.tags?.name || '',
          type: el.tags?.building || el.tags?.highway || el.tags?.natural || el.tags?.landuse || el.tags?.amenity || 'Type inconnu',
          address: el.tags['addr:street'] ? 
            `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street'] || ''}, ${el.tags['addr:postcode'] || ''}` 
            : '',
          amenity: el.tags?.amenity || '',
          height: el.tags?.height || '',
          center: center,
          tags: el.tags || {},
          elementType: el.type // 'way' ou 'node'
        };
        
        const element = { 
          id: el.id,
          coords: coords, 
          info: info 
        };
        
        // Classifier et stocker
        if (el.tags.building) {
          buildingsData.push(element);
        } else if (el.tags.highway) {
          roadsData.push(element);
        } else if (el.tags.natural === 'water') {
          waterData.push(element);
        } else if (el.tags.landuse) {
          landUseData.push(element);
        } else if (el.tags.amenity && !el.tags.building) {
          // POI qui ne sont pas des bâtiments
          if (element.info.elementType === 'way') {
            buildingsData.push(element); // Amenities délimités par des polygones
          }
        }
        
        allElementsData[el.id] = info;
      });
      
      setBuildings(buildingsData);
      setRoads(roadsData);
      setWater(waterData);
      setLandUse(landUseData);
      setElementData(allElementsData);
      setLastAnalyzedPosition([lat, lon]);
      
      // Enregistrer les éléments dans Appwrite (en background)
      saveElementsToAppwrite([...buildingsData, ...roadsData, ...waterData, ...landUseData]);
      
      // Analyser les données avec l'API Flask
      runAIAnalysis(lat, lon, buildingsData, roadsData, waterData, landUseData);
      
    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
      alert("Problème lors du chargement des données de la carte.");
    } finally {
      setLoading(false);
      dataCacheRef.current.isFetching = false;
      dataCacheRef.current.lastFetch = new Date();
      dataCacheRef.current.lastPosition = [lat, lon];
    }
  }, 60000), [lastAnalyzedPosition]); // Délai de 60 secondes (1 minute) entre les analyses
  
  const saveElementsToAppwrite = async (elements) => {
    try {
      // Limiter le nombre d'éléments à sauvegarder pour éviter une surcharge
      const elementsToSave = elements.slice(0, 100);
      
      const promises = elementsToSave.map(element => {
        return databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          {
            elementId: element.id.toString(),
            type: element.info.type,
            coords: JSON.stringify(element.coords),
            info: JSON.stringify(element.info),
            location: [element.info.center[0], element.info.center[1]],
            timestamp: new Date().toISOString()
          }
        );
      });
      
      await Promise.all(promises);
      console.log(`${elementsToSave.length} éléments enregistrés dans la base de données`);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des éléments:", error);
    }
  };
  
  const runAIAnalysis = async (lat, lon, buildings, roads, water, landUse) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: [lat, lon],
          buildings: buildings,
          roads: roads,
          water: water,
          landUse: landUse,
          detailed: true, // Demander une analyse détaillée
          generateUrbanPlan: true, // Demander un plan d'urbanisme
          generateEcosystemData: true // Demander des données sur l'écosystème
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAnalysisData(data);
      
      // Mettre à jour les données du plan d'urbanisme si disponibles
      if (data.urban_plan) {
        setUrbanPlan(data.urban_plan);
        localStorage.setItem('urbanPlan', JSON.stringify(data.urban_plan));
      }
      
      // Mettre à jour les données d'écosystème si disponibles
      if (data.ecosystem_data) {
        setEcosystemData(data.ecosystem_data);
        localStorage.setItem('ecosystemData', JSON.stringify(data.ecosystem_data));
      }
      
      // Si la carte est prête et qu'on a des données de densité
      if (mapRef.current && data.density_heatmap) {
        updateHeatmap(data.density_heatmap);
      }
      
    } catch (error) {
      console.error("Erreur lors de l'analyse IA:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const updateHeatmap = (heatmapData) => {
    const map = mapRef.current;
    
    // Supprimer l'ancienne heatmap si elle existe
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
    }
    
    // Formater les données pour la heatmap
    const points = heatmapData.map(point => ({
      lat: point[0],
      lng: point[1],
      value: point[2]
    }));
    
    // Configurer la nouvelle heatmap
    const heatmapConfig = {
      radius: 25,
      maxOpacity: 0.8,
      scaleRadius: false,
      useLocalExtrema: true,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'value'
    };
    
    // Créer la nouvelle heatmap
    const heatmapLayer = new L.HeatmapOverlay(heatmapConfig);
    heatmapLayer.setData({
      max: 10,
      data: points
    });
    
    // Ajouter la heatmap si l'option est activée
    if (showHeatmap) {
      map.addLayer(heatmapLayer);
      heatmapLayerRef.current = heatmapLayer;
    }
  };
  
  // Quand la position de l'utilisateur change, mettre à jour les données
  // mais avec un traitement plus intelligent pour éviter les requêtes trop fréquentes
  useEffect(() => {
    // Vérifier si une mise à jour est nécessaire
    const shouldUpdate = () => {
      // Si c'est la première requête ou si nous forçons l'actualisation
      if (!dataCacheRef.current.lastFetch) return true;
      
      // Si la dernière requête date de plus d'une minute
      const minutesSinceLastFetch = (new Date() - dataCacheRef.current.lastFetch) / (1000 * 60);
      if (minutesSinceLastFetch > 1) return true;
      
      // Si la position a changé significativement
      if (dataCacheRef.current.lastPosition) {
        const [lastLat, lastLon] = dataCacheRef.current.lastPosition;
        const [newLat, newLon] = userLocation;
        
        // Calcul d'une distance approximative
        const latDiff = Math.abs(lastLat - newLat);
        const lonDiff = Math.abs(lastLon - newLon);
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000; // approximation en mètres
        
        return distance > 200; // Si on s'est déplacé de plus de 200 mètres
      }
      
      return false;
    };
    
    if (shouldUpdate()) {
      fetchMapData(userLocation[0], userLocation[1]);
    }
  }, [userLocation, fetchMapData]);
  
  // Gérer l'affichage de la heatmap quand le statut change
  useEffect(() => {
    if (mapRef.current && analysisData?.density_heatmap) {
      if (showHeatmap) {
        updateHeatmap(analysisData.density_heatmap);
      } else if (heatmapLayerRef.current) {
        mapRef.current.removeLayer(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
    }
  }, [showHeatmap, analysisData]);
  
  // Vérifier si un élément passe les filtres
  const passesFilters = (info) => {
    if (!filters.showFilters) return true;
    
    // Éducation
    if (info.amenity === 'school' || info.amenity === 'university' || info.amenity === 'kindergarten') {
      return filters.types.educational;
    }
    // Santé
    else if (info.amenity === 'hospital' || info.amenity === 'clinic' || info.amenity === 'doctors') {
      return filters.types.healthcare;
    }
    // Restaurants
    else if (info.amenity === 'restaurant' || info.amenity === 'cafe' || info.amenity === 'bar') {
      return filters.types.restaurant;
    }
    // Commerces
    else if (info.amenity === 'shop' || info.tags?.shop) {
      return filters.types.commercial;
    }
    // Résidentiel
    else if (info.type === 'residential' || info.type === 'apartments') {
      return filters.types.residential;
    }
    // Autres
    else {
      return filters.types.others;
    }
  };
  
  const handleElementClick = (id) => {
    setSelectedElement(id);
  };
  
  const createRouteTo = (elementId) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    // Supprimer l'ancien itinéraire s'il existe
    if (map._routingControl) {
      map.removeControl(map._routingControl);
    }
    
    const element = elementData[elementId];
    if (!element) return;
    
    // Créer un nouvel itinéraire
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(element.center[0], element.center[1])
      ],
      routeWhileDragging: true,
      showAlternatives: true,
      lineOptions: {
        styles: [{ color: '#6FA1EC', weight: 4 }]
      },
      altLineOptions: {
        styles: [{ color: '#9CC1FF', weight: 3 }]
      }
    }).addTo(map);
    
    map._routingControl = routingControl;
  };
  
  const toggleLayer = (layer) => {
    setVisibleLayers({
      ...visibleLayers,
      [layer]: !visibleLayers[layer]
    });
  };
  
  const toggleFilter = (filterType) => {
    setFilters({
      ...filters,
      types: {
        ...filters.types,
        [filterType]: !filters.types[filterType]
      }
    });
  };
  
  // Fonction pour déterminer la couleur en fonction du type d'élément
  const getBuildingColor = (info) => {
    if (info.amenity === 'school' || info.amenity === 'university' || info.amenity === 'kindergarten') {
      return '#3388FF'; // Bleu pour éducation
    } else if (info.amenity === 'hospital' || info.amenity === 'clinic' || info.amenity === 'doctors') {
      return '#FF3333'; // Rouge pour santé
    } else if (info.amenity === 'restaurant' || info.amenity === 'cafe' || info.amenity === 'bar') {
      return '#FF9933'; // Orange pour restaurants
    } else if (info.amenity === 'shop' || info.tags?.shop) {
      return '#33CC33'; // Vert pour commerces
    } else if (info.type === 'residential' || info.type === 'apartments') {
      return '#CC33CC'; // Violet pour résidentiel  
    } else {
      return '#777777'; // Gris par défaut
    }
  };
  
  // Gérer le clic droit sur la carte pour ajouter un commentaire
  const handleMapContextMenu = (e) => {
    setCommentForm({
      ...commentForm,
      show: true,
      location: [e.latlng.lat, e.latlng.lng]
    });
  };

  // Forcer une mise à jour des données
  const handleForceRefresh = () => {
    fetchMapData(userLocation[0], userLocation[1], true);
  };
  
  return (
    <div className="map-container" style={{ position: 'relative', height: "100vh", width: "100%" }}>
      {loading && (
        <div className="loading-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="loading-spinner">Chargement des données cartographiques...</div>
        </div>
      )}
      
      {isAnalyzing && (
        <div className="analyzing-overlay" style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          <div>Analyse IA en cours... Cela peut prendre une minute.</div>
        </div>
      )}
      
      {/* Formulaire pour ajouter un commentaire */}
      {commentForm.show && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          zIndex: 1100,
          width: '300px'
        }}>
          <h3>Ajouter un commentaire</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Titre:</label>
            <input
              type="text"
              value={commentForm.title}
              onChange={(e) => setCommentForm({...commentForm, title: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Commentaire:</label>
            <textarea
              value={commentForm.comment}
              onChange={(e) => setCommentForm({...commentForm, comment: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Note (1-5):</label>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => setCommentForm({...commentForm, rating})}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    background: commentForm.rating === rating ? '#4CAF50' : '#e0e0e0',
                    color: commentForm.rating === rating ? 'white' : 'black',
                    cursor: 'pointer'
                  }}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setCommentForm({...commentForm, show: false})}
              style={{
                padding: '8px 16px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              onClick={addComment}
              style={{
                padding: '8px 16px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
      
      <MapContainer 
        center={userLocation} 
        zoom={17} 
        style={{ height: "100%", width: "100%" }}
        whenCreated={mapInstance => {
          mapRef.current = mapInstance;
          
          // Ajouter l'événement de clic droit
          mapInstance.on('contextmenu', handleMapContextMenu);
        }}
        contextmenu={true}
        contextmenuItems={[
          {
            text: 'Analyser cette zone',
            callback: (e) => {
              setUserLocation([e.latlng.lat, e.latlng.lng]);
            }
          },
          {
            text: 'Ajouter un commentaire ici',
            callback: (e) => {
              setCommentForm({
                ...commentForm,
                show: true,
                location: [e.latlng.lat, e.latlng.lng]
              });
            }
          },
          {
            text: 'Ajouter ce lieu aux favoris',
            callback: (e) => {
              const newFavorite = {
                id: `fav_${Date.now()}`,
                name: 'Lieu marqué',
                type: 'custom',
                center: [e.latlng.lat, e.latlng.lng],
                timestamp: new Date().toISOString()
              };
              
              const updatedFavorites = [...favorites, newFavorite];
              setFavorites(updatedFavorites);
              localStorage.setItem('mapFavorites', JSON.stringify(updatedFavorites));
            }
          }
        ]}
      >
        {/* 1. Mode nuit / jour */}
        {isDarkMode ? (
          <TileLayer 
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" 
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        ) : (
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        )}
        
        <LocationMarker setUserLocation={setUserLocation} addToHistory={addToHistory} />
        <MapUpdater center={userLocation} />
        
        {/* 2. Historique de navigation - trace GPS */}
        {showNavigationHistory && navigationHistory.length > 1 && (
          <Polyline 
            positions={navigationHistory.map(point => point.position)} 
            pathOptions={{ color: '#9d00ff', weight: 3, opacity: 0.7 }}
          />
        )}
        
        {/* 3. Commentaires sur la carte */}
        {showComments && comments.map(comment => (
          <Marker 
            key={`comment-${comment.id}`} 
            position={comment.location}
            icon={CommentIcon}
          >
            <Popup>
              <div>
                <h3>{comment.title}</h3>
                <div style={{ display: 'flex', marginBottom: '5px' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: i < comment.rating ? 'gold' : 'gray', marginRight: '2px' }}>★</span>
                  ))}
                </div>
                <p>{comment.comment}</p>
                <small>Ajouté le {new Date(comment.timestamp).toLocaleDateString()}</small>
              </div>
            </Popup>
          </Marker>
        ))}
        {/* 4. Afficher les favoris */}
        {showFavorites && favorites.filter(fav => fav.type === 'custom').map(favorite => (
          <Marker 
            key={`fav-${favorite.id}`} 
            position={favorite.center}
            icon={L.divIcon({
              html: '⭐',
              className: 'favorite-marker',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
          >
            <Popup>
              <div>
                <h3>{favorite.name}</h3>
                <p>Favori ajouté le {new Date(favorite.timestamp).toLocaleDateString()}</p>
                <button 
                  onClick={() => {
                    const updatedFavorites = favorites.filter(fav => fav.id !== favorite.id);
                    setFavorites(updatedFavorites);
                    localStorage.setItem('mapFavorites', JSON.stringify(updatedFavorites));
                  }}
                  style={{
                    padding: '5px 10px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Supprimer
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* 5. Filtrage avancé - appliquer les filtres sur les bâtiments et autres éléments */}
        {visibleLayers.buildings && buildings.filter(building => passesFilters(building.info)).map((building) => (
          <Polygon 
            key={`building-${building.id}`}
            positions={building.coords} 
            pathOptions={{ 
              color: selectedElement === building.id ? "#FF5733" : getBuildingColor(building.info),
              weight: selectedElement === building.id ? 3 : 1.5, 
              fillOpacity: 0.6 
            }} 
            eventHandlers={{
              click: () => handleElementClick(building.id)
            }}
          >
            <Popup>
              <div className="building-popup">
                <h3>{building.info.name || 'Bâtiment'}</h3>
                <p><strong>Type:</strong> {building.info.type}</p>
                {building.info.address && <p><strong>Adresse:</strong> {building.info.address}</p>}
                {building.info.amenity && <p><strong>Équipement:</strong> {building.info.amenity}</p>}
                {building.info.height && <p><strong>Hauteur:</strong> {building.info.height}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <button 
                    onClick={() => createRouteTo(building.id)}
                    style={{
                      padding: '8px 12px',
                      background: '#4285F4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Itinéraire
                  </button>
                  <button 
                    onClick={() => toggleFavorite(building)}
                    style={{
                      padding: '8px 12px',
                      background: isFavorite(building.id) ? '#f44336' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {isFavorite(building.id) ? 'Retirer favori' : 'Ajouter favori'}
                  </button>
                </div>
              </div>
            </Popup>
          </Polygon>
        ))}
        
        {/* Afficher les routes */}
        {visibleLayers.roads && roads.map((road) => (
          <Polyline 
            key={`road-${road.id}`}
            positions={road.coords} 
            pathOptions={{ 
              color: selectedElement === road.id ? "#FF5733" : "#333333", 
              weight: selectedElement === road.id ? 5 : 3,
              fillOpacity: 0.2
            }} 
            eventHandlers={{
              click: () => handleElementClick(road.id)
            }}
          >
            <Popup>
              <div className="road-popup">
                <h3>{road.info.name || 'Route'}</h3>
                <p><strong>Type:</strong> {road.info.type}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <button 
                    onClick={() => createRouteTo(road.id)}
                    style={{
                      padding: '8px 12px',
                      background: '#4285F4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Naviguer
                  </button>
                  <button 
                    onClick={() => toggleFavorite(road)}
                    style={{
                      padding: '8px 12px',
                      background: isFavorite(road.id) ? '#f44336' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {isFavorite(road.id) ? 'Retirer favori' : 'Ajouter favori'}
                  </button>
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}
        
        {/* Afficher les plans d'eau */}
        {visibleLayers.water && water.map((waterBody) => (
          <Polygon 
            key={`water-${waterBody.id}`}
            positions={waterBody.coords} 
            pathOptions={{ 
              color: selectedElement === waterBody.id ? "#FF5733" : "#0066CC", 
              weight: selectedElement === waterBody.id ? 3 : 1,
              fillColor: '#99CCFF',
              fillOpacity: 0.6
            }} 
            eventHandlers={{
              click: () => handleElementClick(waterBody.id)
            }}
          >
            <Popup>
              <div className="water-popup">
                <h3>{waterBody.info.name || 'Plan d\'eau'}</h3>
                <p><strong>Type:</strong> {waterBody.info.tags.water || 'Eau'}</p>
                <button 
                  onClick={() => toggleFavorite(waterBody)}
                  style={{
                    padding: '8px 12px',
                    background: isFavorite(waterBody.id) ? '#f44336' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  {isFavorite(waterBody.id) ? 'Retirer favori' : 'Ajouter favori'}
                </button>
              </div>
            </Popup>
          </Polygon>
        ))}
        
        {/* Afficher les terrains */}
        {visibleLayers.landUse && landUse.map((area) => {
          let fillColor = '#CCCCCC';
          if (area.info.tags.landuse === 'forest' || area.info.tags.landuse === 'wood') fillColor = '#99CC99';
          else if (area.info.tags.landuse === 'residential') fillColor = '#FFCCCC';
          else if (area.info.tags.landuse === 'industrial') fillColor = '#CCCCFF';
          else if (area.info.tags.landuse === 'commercial') fillColor = '#FFFFCC';
          
          return (
            <Polygon 
              key={`landuse-${area.id}`}
              positions={area.coords} 
              pathOptions={{ 
                color: selectedElement === area.id ? "#FF5733" : "#666666", 
                weight: selectedElement === area.id ? 3 : 1,
                fillColor: fillColor,
                fillOpacity: 0.4
              }} 
              eventHandlers={{
                click: () => handleElementClick(area.id)
              }}
            >
              <Popup>
                <div className="landuse-popup">
                  <h3>{area.info.name || 'Terrain'}</h3>
                  <p><strong>Type:</strong> {area.info.type}</p>
                  <button 
                    onClick={() => toggleFavorite(area)}
                    style={{
                      padding: '8px 12px',
                      background: isFavorite(area.id) ? '#f44336' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginTop: '8px'
                    }}
                  >
                    {isFavorite(area.id) ? 'Retirer favori' : 'Ajouter favori'}
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
      
      {/* Panneau de contrôle */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'white',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Couches</div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input 
              type="checkbox" 
              checked={visibleLayers.buildings} 
              onChange={() => toggleLayer('buildings')} 
            /> 
            Bâtiments
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input 
              type="checkbox" 
              checked={visibleLayers.roads} 
              onChange={() => toggleLayer('roads')} 
            /> 
            Routes
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input 
              type="checkbox" 
              checked={visibleLayers.water} 
              onChange={() => toggleLayer('water')} 
            /> 
            Eau
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input 
              type="checkbox" 
              checked={visibleLayers.landUse} 
              onChange={() => toggleLayer('landUse')} 
            /> 
            Terrains
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input 
              type="checkbox" 
              checked={showComments} 
              onChange={() => setShowComments(!showComments)} 
            /> 
            Commentaires
          </label>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <input 
              type="checkbox" 
              checked={showHeatmap} 
              onChange={() => setShowHeatmap(!showHeatmap)} 
            /> 
            Densité (heatmap)
          </label>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <input 
              type="checkbox" 
              checked={showNavigationHistory} 
              onChange={() => setShowNavigationHistory(!showNavigationHistory)} 
            /> 
            Historique de navigation
          </label>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <input 
              type="checkbox" 
              checked={showFavorites} 
              onChange={() => setShowFavorites(!showFavorites)}
            /> 
            Favoris
          </label>
          {/* Ajout d'un bouton pour déclencher une mise à jour forcée */}
          <button 
            onClick={() => setFilters({ ...filters, showFilters: !filters.showFilters })}
            style={{
              padding: '8px 16px',
              background: '#607D8B',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px',
              width: '100%'
            }}
          >
            {filters.showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
          </button>

          <button 
            onClick={handleForceRefresh}
            style={{
              padding: '8px 16px',
              background: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px',
              width: '100%'
            }}
          >
            Forcer la mise à jour
          </button>
        </div>

        {filters.showFilters && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Types</div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input 
                type="checkbox"
                checked={filters.types.residential}
                onChange={() => toggleFilter('residential')}
              />
              Résidentiel
            </label>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input 
                type="checkbox"
                checked={filters.types.commercial}
                onChange={() => toggleFilter('commercial')}
              />
              Commercial
            </label>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input 
                type="checkbox"
                checked={filters.types.educational}
                onChange={() => toggleFilter('educational')}
              />
              Éducation
            </label>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input 
                type="checkbox"
                checked={filters.types.healthcare}
                onChange={() => toggleFilter('healthcare')}
              />
              Santé
            </label>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input 
                type="checkbox"
                checked={filters.types.restaurant}
                onChange={() => toggleFilter('restaurant')}
              />
              Restaurant
            </label>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input 
                type="checkbox"
                checked={filters.types.others}
                onChange={() => toggleFilter('others')}
              />
              Autres
            </label>
          </div>
        )}
      </div>
      
      {/* Panneau d'analyse */}
      {analysisData && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'white',
          padding: '15px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          zIndex: 1000,
          maxWidth: '300px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Analyse de la zone</h3>
          <div>
            <p><strong>Bâtiments:</strong> {analysisData.stats.building_count}</p>
            <p><strong>Routes:</strong> {analysisData.stats.road_count}</p>
            <p><strong>Plans d'eau:</strong> {analysisData.stats.water_count}</p>
            <p><strong>Densité urbaine:</strong> {analysisData.stats.urban_density_score}/10</p>
            <p><strong>Accessibilité:</strong> {analysisData.stats.accessibility_score}/10</p>
          </div>
          {analysisData.recommendations && (
            <div>
              <h4 style={{ marginBottom: '5px' }}>Recommandations</h4>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                {analysisData.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          {/* Afficher le plan d'urbanisme si disponible */}
          {urbanPlan && showUrbanPlan && (
            <div style={{ marginTop: '15px' }}>
              <h4>Plan d'urbanisme</h4>
              <p>{urbanPlan}</p>
            </div>
          )}
          {/* Afficher les données d'écosystème si disponibles */}
          {ecosystemData && (
            <div style={{ marginTop: '15px' }}>
              <h4>Écosystème</h4>
              <p>{ecosystemData}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

