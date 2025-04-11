import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  CircleMarker,
  ZoomControl,
  LayersControl,
  FeatureGroup
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { loginWithGoogle, getCurrentUser, saveUserLocation } from "./AppwriteConfig";
import axios from "axios";

// Import Leaflet routing machine pour les itinéraires réels
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// Pour regrouper les marqueurs quand ils sont nombreux
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import "@changey/react-leaflet-markercluster/dist/styles.min.css";

// Import des icônes personnalisées
import hospitalIcon from "./assets/hospital-marker.png";
import shopIcon from "./assets/shop-marker.png";
import stationIcon from "./assets/station-marker.png";
import userIcon from "./assets/user-marker.png";

// Custom markers avec des icônes personnalisées pour plus de clarté
const customIcons = {
  hospital: new L.Icon({
    iconUrl: hospitalIcon || "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  shop: new L.Icon({
    iconUrl: shopIcon || "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  station: new L.Icon({
    iconUrl: stationIcon || "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  user: new L.Icon({
    iconUrl: userIcon || "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  })
};

// Composant pour centrer automatiquement la carte sur l'utilisateur
function AutoCenterMap({ userLocation }) {
  const map = useMap();
  
  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [userLocation, map]);
  
  return null;
}

// Composant pour afficher les itinéraires avec Leaflet Routing Machine
function RoutingMachine({ userLocation, destination, setRouteInfo }) {
  const map = useMap();
  const routingControlRef = useRef(null);
  
  useEffect(() => {
    if (!userLocation || !destination) return;
    
    // Si un contrôle d'itinéraire existe déjà, le supprimer
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }
    
    // Créer un nouveau contrôle d'itinéraire
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation.lat, userLocation.lng),
        L.latLng(destination.latitude, destination.longitude)
      ],
      routeWhileDragging: false,
      showAlternatives: true,
      fitSelectedRoutes: true,
      lineOptions: {
        styles: [
          { color: '#6FA1EC', weight: 4 },
          { color: '#FFF', weight: 2, opacity: 0.7 }
        ]
      },
      createMarker: () => null // Déjà des marqueurs pour l'utilisateur et la destination
    }).addTo(map);
    
    // Récupérer les informations d'itinéraire
    routingControl.on('routesfound', function(e) {
      const routes = e.routes;
      const summary = routes[0].summary;
      
      setRouteInfo({
        distance: (summary.totalDistance / 1000).toFixed(2), // Distance en km
        duration: Math.round(summary.totalTime / 60), // Durée en minutes
        routeFound: true
      });
    });
    
    routingControlRef.current = routingControl;
    
    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }
    };
  }, [map, userLocation, destination, setRouteInfo]);
  
  return null;
}

function MapHospital() {
  const [locations, setLocations] = useState({
    hospitals: [],
    shops: [],
    stations: []
  });
  const [userLocation, setUserLocation] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeLocationType, setActiveLocationType] = useState("hospitals");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clusters, setClusters] = useState({});
  const watchPositionId = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState({
    distance: null,
    duration: null,
    routeFound: false
  });
  const [analytics, setAnalytics] = useState({
    averageDistance: 0,
    nearestLocation: null,
    busyAreas: [],
    density: {}
  });
  const dataUpdateInterval = useRef(null);
  const [mapLayers, setMapLayers] = useState({
    base: "OpenStreetMap",
    overlay: ["Heatmap"] // Active par défaut
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Fonction pour chercher des lieux par nom
  const searchPlaces = async (query) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    try {
      // Utilise l'API Nominatim d'OpenStreetMap pour la recherche
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      
      const results = response.data.map(item => ({
        id: item.place_id,
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
        distance: userLocation ? 
          calculateHaversineDistance(
            userLocation.lat, userLocation.lng,
            parseFloat(item.lat), parseFloat(item.lon)
          ) : null
      }));
      
      setSearchResults(results);
    } catch (error) {
      console.error("Erreur lors de la recherche de lieux:", error);
    }
  };

  // Gestion de la saisie dans le champ de recherche avec debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Effacer le timeout précédent
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Définir un nouveau timeout
    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 500);
  };

  // Aller vers un lieu recherché
  const goToSearchResult = (result) => {
    // Créer un emplacement au format attendu
    const location = {
      id: `search-${result.id}`,
      name: result.name.split(',')[0], // Prendre juste le nom principal
      latitude: result.latitude,
      longitude: result.longitude,
      type: getTypeFromSearchResult(result),
      distance: result.distance,
      details: {
        address: result.name,
        type: result.type
      }
    };
    
    setSelectedLocation(location);
    setSearchResults([]);
    setSearchQuery("");
  };

  // Déterminer le type d'icône à utiliser pour les résultats de recherche
  const getTypeFromSearchResult = (result) => {
    const name = result.name.toLowerCase();
    const type = result.type;
    
    if (name.includes("hôpital") || name.includes("hospital") || 
        name.includes("clinique") || name.includes("médical") || 
        type.includes("health")) {
      return "hospital";
    }
    
    if (name.includes("gare") || name.includes("station") || 
        name.includes("arrêt") || name.includes("métro") || 
        type.includes("station") || type.includes("public_transport")) {
      return "station";
    }
    
    if (name.includes("magasin") || name.includes("shop") || 
        name.includes("supermarché") || name.includes("pharmacie") || 
        type.includes("shop") || type.includes("commercial")) {
      return "shop";
    }
    
    // Par défaut
    return "shop";
  };

  // Fonction pour activer le GPS et mettre à jour la position de l'utilisateur
  const getUserLocation = () => {
    if (navigator.geolocation) {
      // Nettoyer toute surveillance existante
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
      
      setIsLoading(true);
      
      watchPositionId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          
          // Sauvegarder la position si l'utilisateur est connecté
          if (loggedInUser) {
            saveUserLocation(loggedInUser.$id, newLocation, {
              timestamp: new Date().toISOString()
            });
          }
          
          // Récupération initiale des emplacements à proximité
          if (!locations.hospitals.length) {
            fetchNearbyLocations(newLocation);
          }
          
          // Configurer un intervalle pour mettre à jour les données toutes les 3 minutes
          if (!dataUpdateInterval.current) {
            dataUpdateInterval.current = setInterval(() => {
              fetchNearbyLocations(newLocation);
            }, 3 * 60000); // 3 minutes
          }
          
          setIsLoading(false);
        },
        (error) => {
          console.error("Erreur lors de l'obtention de la position :", error);
          setError("Impossible d'accéder à votre position. Veuillez vérifier vos paramètres de localisation.");
          setIsLoading(false);
        },
        { 
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 30000
        }
      );
    } else {
      setError("La géolocalisation n'est pas prise en charge par votre navigateur.");
    }
  };

  // Récupérer les emplacements à proximité à partir d'APIs réelles
  const fetchNearbyLocations = async (location) => {
    try {
      setIsLoading(true);
      
      // Récupération parallèle des trois types d'emplacements
      const [hospitalsData, shopsData, stationsData] = await Promise.all([
        fetchNearbyHospitals(location),
        fetchNearbyShops(location),
        fetchNearbyStations(location)
      ]);
      
      const newLocations = {
        hospitals: hospitalsData,
        shops: shopsData,
        stations: stationsData
      };
      
      setLocations(newLocations);
      
      // Calculer les analyses sur les nouvelles données
      calculateAnalytics(newLocations, location);
      
      // Envoyer les hôpitaux à l'API de prédiction pour le clustering
      if (hospitalsData.length > 0) {
        predictHospitalClusters(hospitalsData);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la récupération des emplacements :", error);
      setError("Impossible de charger tous les emplacements à proximité. Certaines données peuvent être incomplètes.");
      setIsLoading(false);
    }
  };

  // Récupérer les hôpitaux à proximité depuis l'API Overpass
  const fetchNearbyHospitals = async (location) => {
    try {
      const radius = 5000; // 5 km de rayon
      
      // Requête Overpass QL pour obtenir les hôpitaux
      const query = `
      [out:json];
      (
        node["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
        node["amenity"="clinic"](around:${radius},${location.lat},${location.lng});
        way["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
        way["amenity"="clinic"](around:${radius},${location.lat},${location.lng});
        relation["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
        relation["amenity"="clinic"](around:${radius},${location.lat},${location.lng});
      );
      out center;
      `;
      
      const response = await axios.post('https://overpass-api.de/api/interpreter', query);
      
      // Transformer les résultats en format standard
      const hospitals = response.data.elements.map((element, index) => {
        // Extraire lat/long en fonction du type d'élément
        const lat = element.lat || element.center.lat;
        const lon = element.lon || element.center.lon;
        
        // Calculer la distance réelle
        const distance = calculateHaversineDistance(
          location.lat, location.lng,
          lat, lon
        );
        
        // Obtenir le quartier/zone si disponible
        const neighborhood = element.tags.suburb || 
                            element.tags.neighbourhood || 
                            element.tags.district || 
                            "Zone non spécifiée";
        
        // Déterminer les spécialités si disponibles
        const rawSpecialties = element.tags.healthcare ? 
          (typeof element.tags.healthcare === 'string' ? 
            [element.tags.healthcare] : 
            Object.keys(element.tags.healthcare)) : 
          [];
        
        const specialties = rawSpecialties.length > 0 ? 
          rawSpecialties : ["Médecine générale"];
        
        return {
          id: `hospital-${element.id || index}`,
          name: element.tags.name || `Hôpital ${index + 1}`,
          latitude: lat,
          longitude: lon,
          distance: distance,
          type: 'hospital',
          neighborhood: neighborhood,
          details: {
            capacity: element.tags.beds || "Non spécifié",
            occupancyRate: element.tags.occupancy_rate || "Non disponible",
            specialties: specialties,
            phone: element.tags.phone || element.tags['contact:phone'] || "Non disponible",
            website: element.tags.website || element.tags['contact:website'] || "Non disponible",
            emergency: element.tags.emergency === "yes" ? "Oui" : "Non spécifié",
            wheelchair: element.tags.wheelchair === "yes" ? "Accessible" : "Non spécifié"
          }
        };
      });
      
      return hospitals;
    } catch (error) {
      console.error("Erreur lors de la récupération des hôpitaux:", error);
      // En cas d'erreur, renvoyer un tableau vide
      return [];
    }
  };

  // Récupérer les commerces à proximité depuis l'API Overpass
  const fetchNearbyShops = async (location) => {
    try {
      const radius = 2000; // 2 km de rayon (plus petit pour les commerces car nombreux)
      
      // Requête Overpass QL pour obtenir les pharmacies et supermarchés
      const query = `
      [out:json];
      (
        node["shop"="pharmacy"](around:${radius},${location.lat},${location.lng});
        node["shop"="supermarket"](around:${radius},${location.lat},${location.lng});
        node["shop"="convenience"](around:${radius},${location.lat},${location.lng});
        node["shop"="bakery"](around:${radius},${location.lat},${location.lng});
        way["shop"="pharmacy"](around:${radius},${location.lat},${location.lng});
        way["shop"="supermarket"](around:${radius},${location.lat},${location.lng});
        way["shop"="convenience"](around:${radius},${location.lat},${location.lng});
        way["shop"="bakery"](around:${radius},${location.lat},${location.lng});
      );
      out center;
      `;
      
      const response = await axios.post('https://overpass-api.de/api/interpreter', query);
      
      // Transformer les résultats en format standard
      const shops = response.data.elements.map((element, index) => {
        // Extraire lat/long en fonction du type d'élément
        const lat = element.lat || element.center.lat;
        const lon = element.lon || element.center.lon;
        
        // Calculer la distance réelle
        const distance = calculateHaversineDistance(
          location.lat, location.lng,
          lat, lon
        );
        
        // Obtenir le quartier/zone si disponible
        const neighborhood = element.tags.suburb || 
                            element.tags.neighbourhood || 
                            element.tags.district || 
                            "Zone non spécifiée";
        
        // Déterminer la catégorie
        const category = element.tags.shop || "Commerce";
        
        // Déterminer les heures d'ouverture
        const openHours = element.tags.opening_hours || "Horaires non spécifiés";
        
        return {
          id: `shop-${element.id || index}`,
          name: element.tags.name || `${category.charAt(0).toUpperCase() + category.slice(1)} ${index + 1}`,
          latitude: lat,
          longitude: lon,
          distance: distance,
          type: 'shop',
          neighborhood: neighborhood,
          details: {
            category: category.charAt(0).toUpperCase() + category.slice(1),
            openHours: openHours,
            phone: element.tags.phone || element.tags['contact:phone'] || "Non disponible",
            brand: element.tags.brand || "Non spécifié",
            wheelchair: element.tags.wheelchair === "yes" ? "Accessible" : "Non spécifié"
          }
        };
      });
      
      return shops;
    } catch (error) {
      console.error("Erreur lors de la récupération des commerces:", error);
      // En cas d'erreur, renvoyer un tableau vide
      return [];
    }
  };

  // Récupérer les stations à proximité depuis l'API Overpass
  const fetchNearbyStations = async (location) => {
    try {
      const radius = 3000; // 3 km de rayon
      
      // Requête Overpass QL pour obtenir les stations de transport
      const query = `
      [out:json];
      (
        node["public_transport"="station"](around:${radius},${location.lat},${location.lng});
        node["public_transport"="stop_position"](around:${radius},${location.lat},${location.lng});
        node["railway"="station"](around:${radius},${location.lat},${location.lng});
        node["railway"="subway_entrance"](around:${radius},${location.lat},${location.lng});
        node["amenity"="bus_station"](around:${radius},${location.lat},${location.lng});
        way["public_transport"="station"](around:${radius},${location.lat},${location.lng});
        relation["public_transport"="station"](around:${radius},${location.lat},${location.lng});
      );
      out center;
      `;
      
      const response = await axios.post('https://overpass-api.de/api/interpreter', query);
      
      // Transformer les résultats en format standard
      const stations = response.data.elements.map((element, index) => {
        // Extraire lat/long en fonction du type d'élément
        const lat = element.lat || element.center.lat;
        const lon = element.lon || element.center.lon;
        
        // Calculer la distance réelle
        const distance = calculateHaversineDistance(
          location.lat, location.lng,
          lat, lon
        );
        
        // Obtenir le quartier/zone si disponible
        const neighborhood = element.tags.suburb || 
                            element.tags.neighbourhood || 
                            element.tags.district || 
                            "Zone non spécifiée";
        
        // Déterminer le type de transport
        let transportType = "Station";
        if (element.tags.railway === "station") transportType = "Gare";
        else if (element.tags.railway === "subway_entrance") transportType = "Métro";
        else if (element.tags.amenity === "bus_station") transportType = "Bus";
        else if (element.tags.public_transport === "station") transportType = "Transport en commun";
        else if (element.tags.public_transport === "stop_position") transportType = "Arrêt";
        
        // Obtenir les lignes desservies
        const lines = [];
        if (element.tags.ref) lines.push(element.tags.ref);
        if (element.tags.route_ref) lines.push(element.tags.route_ref);
        if (element.tags.line) lines.push(element.tags.line);
        
        return {
          id: `station-${element.id || index}`,
          name: element.tags.name || `${transportType} ${index + 1}`,
          latitude: lat,
          longitude: lon,
          distance: distance,
          type: 'station',
          neighborhood: neighborhood,
          details: {
            type: transportType,
            lines: lines.length > 0 ? lines : ["Non spécifié"],
            operator: element.tags.operator || "Non spécifié",
            frequency: element.tags.interval || element.tags.frequency || "Non spécifié",
            wheelchair: element.tags.wheelchair === "yes" ? "Accessible" : "Non spécifié"
          }
        };
      });
      
      return stations;
    } catch (error) {
      console.error("Erreur lors de la récupération des stations:", error);
      // En cas d'erreur, renvoyer un tableau vide
      return [];
    }
  };

  // Calculer la distance de Haversine entre deux points
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance en km
  };

  // Fonction pour calculer des analyses à partir des données de localisation
  const calculateAnalytics = (locationsData, userLocation) => {
    const allLocations = [
      ...locationsData.hospitals,
      ...locationsData.shops,
      ...locationsData.stations
    ];
    
    // Trouver l'emplacement le plus proche
    let nearestLocation = null;
    let minDistance = Infinity;
    
    allLocations.forEach(location => {
      const distance = calculateHaversineDistance(
        userLocation.lat, userLocation.lng,
        location.latitude, location.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = location;
      }
    });
    
    // Calculer la distance moyenne à tous les emplacements
    const totalDistance = allLocations.reduce((sum, location) => {
      return sum + calculateHaversineDistance(
        userLocation.lat, userLocation.lng,
        location.latitude, location.longitude
      );
    }, 0);
    
    const averageDistance = allLocations.length > 0 
      ? totalDistance / allLocations.length 
      : 0;
    
    // Déterminer les zones occupées (zones avec plusieurs emplacements)
    const neighborhoodCount = {};
    allLocations.forEach(location => {
      if (location.neighborhood) {
        neighborhoodCount[location.neighborhood] = (neighborhoodCount[location.neighborhood] || 0) + 1;
      }
    });
    
    const busyAreas = Object.entries(neighborhoodCount)
      .filter(([_, count]) => count >= 2)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    // Calculer la densité des points d'intérêt par catégorie
    const density = {
      hospitals: locationsData.hospitals.length > 0 ? 
        (locationsData.hospitals.length / (Math.PI * 25)).toFixed(2) : 0, // POI par km²
      shops: locationsData.shops.length > 0 ? 
        (locationsData.shops.length / (Math.PI * 4)).toFixed(2) : 0, // Rayon de 2km
      stations: locationsData.stations.length > 0 ? 
        (locationsData.stations.length / (Math.PI * 9)).toFixed(2) : 0, // Rayon de 3km
    };
    
    setAnalytics({
      averageDistance: averageDistance.toFixed(2),
      nearestLocation,
      busyAreas,
      density
    });
  };

  // Appeler l'API de prédiction pour regrouper les hôpitaux
  const predictHospitalClusters = async (hospitals) => {
    // Cette fonction simule un clustering côté serveur
    // Dans un environnement réel, vous feriez appel à votre API d'analyse
    try {
      // Préparer le corps de la requête
      const requestData = {
        hospitals: hospitals.map(hospital => ({
          id: hospital.id,
          latitude: hospital.latitude,
          longitude: hospital.longitude,
          specialties: hospital.details.specialties
        }))
      };
      
      // Appel à votre API de clustering (simulation pour le débogage)
      const response = await axios.post('https://votre-api-analytique.com/predict_hospital', requestData);
      
      // Traiter la réponse
      const newClusters = {};
      response.data.clusters.forEach((cluster, index) => {
        newClusters[hospitals[index].id] = cluster;
      });
      
      setClusters(newClusters);
    } catch (error) {
      console.error("Erreur lors de la prédiction des clusters d'hôpitaux:", error);
      
      // Simuler des clusters pour démonstration si l'API échoue
      // Utiliser un algorithme de clustering simplifié basé sur la proximité
      const newClusters = {};
      
      // Clusteriser basé sur la proximité géographique (algorithme simplifié)
      const clusterPoints = [];
      
      // Choisir quelques centres de cluster aléatoirement
      const clusterCenters = hospitals
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(3, Math.ceil(hospitals.length / 3)))
        .map(hospital => ({
          id: hospital.id,
          lat: hospital.latitude, 
          lng: hospital.longitude
        }));
      
      // Attribuer chaque hôpital au cluster le plus proche
      hospitals.forEach(hospital => {
        let minDist = Infinity;
        let clusterId = 0;
        
        clusterCenters.forEach((center, idx) => {
          const dist = calculateHaversineDistance(
            center.lat, center.lng,
            hospital.latitude, hospital.longitude
          );
          
          if (dist < minDist) {
            minDist = dist;
            clusterId = idx;
          }
        });
        
        newClusters[hospital.id] = clusterId;
      });
      
      setClusters(newClusters);
    }
  };

  // Authentification avec Google via Appwrite
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      const user = await getCurrentUser();
      setLoggedInUser(user);
      
      // Si la position de l'utilisateur existe, la sauvegarder après la connexion
      if (userLocation) {
        saveUserLocation(user.$id, userLocation, {
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Erreur lors de la connexion Google : ", error);
      setError("Échec de la connexion avec Google. Veuillez réessayer.");
    }
  };
  
  // Gestion du changement de type d'emplacement
  const handleLocationTypeChange = (type) => {
    setActiveLocationType(type);
    setSelectedLocation(null);
    setRouteInfo({
      distance: null,
      duration: null,
      routeFound: false
    });
  };
  
  // Fonction de nettoyage
  useEffect(() => {
    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
      
      if (dataUpdateInterval.current) {
        clearInterval(dataUpdateInterval.current);
      }
      
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Configuration initiale
  useEffect(() => {
    // Essayer d'obtenir l'utilisateur actuel d'abord
    const checkCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setLoggedInUser(user);
        }
      } catch (error) {
        console.log("Aucun utilisateur actuellement connecté");
      }
    };
    
    checkCurrentUser();
    getUserLocation();
  }, []);

  // Obtenir la couleur du cluster en fonction de l'ID du cluster
  const getClusterColor = (clusterId) => {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
    return colors[clusterId % colors.length];
  };

  // Trier les emplacements par distance
  const sortedLocations = locations[activeLocationType]
    ? [...locations[activeLocationType]].sort((a, b) => a.distance - b.distance)
    : [];
    
  // Regrouper les emplacements par quartier pour l'analyse
  const locationsByNeighborhood = {};
  
  sortedLocations.forEach(location => {
    if (!locationsByNeighborhood[location.neighborhood]) {
      locationsByNeighborhood[location.neighborhood] = [];
    }
    locationsByNeighborhood[location.neighborhood].push(location);
  });

  return (
    <div className="map-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Fermer</button>
        </div>
      )}
      
      <div className="map-controls">
        <div className="control-row">
          {!loggedInUser ? (
            <button onClick={handleGoogleLogin} className="login-button">
              Se connecter avec Google
            </button>
          ) : (
            <div className="user-info">
              Connecté: {loggedInUser.name || loggedInUser.email}
            </div>
          )}
          
          <div className="search-container">
            <input
              type="text"
              placeholder="Rechercher un lieu..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(result => (
                  <div 
                    key={result.id} 
                    className="search-result-item"
                    onClick={() => goToSearchResult(result)}
                  >
                    <div className="result-name">{result.name.split(',')[0]}</div>
                    <div className="result-address">{result.name.split(',').slice(1, 3).join(',')}</div>
                    {result.distance && <div className="result-distance">{result.distance.toFixed(2)} km</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="data-refresh-info">
            Données mises à jour: {new Date().toLocaleTimeString()}
          </div>
        </div>
        
        <div className="control-row">
          <div className="location-type-selector">
            <button 
              className={activeLocationType === "hospitals" ? "active" : ""} 
              onClick={() => handleLocationTypeChange("hospitals")}
            >
              Hôpitaux ({locations.hospitals.length})
            </button>
            <button 
              className={activeLocationType === "shops" ? "active" : ""} 
              onClick={() => handleLocationTypeChange("shops")}
            >
              Boutiques ({locations.shops.length})
            </button>
            <button 
              className={activeLocationType === "stations" ? "active" : ""} 
              onClick={() => handleLocationTypeChange("stations")}
            >
              Stations ({locations.stations.length})
            </button>
          </div>
        </div>
      </div>
      
      {isLoading && <div className="loading-indicator">Chargement des données...</div>}
      
      <div className="map-analytics-container">
        {/* Zone de carte */}
        <div className="map-area">
          {userLocation ? (
            <MapContainer 
              center={[userLocation.lat, userLocation.lng]} 
              zoom={14} 
              style={{ height: "600px", width: "100%" }}
              zoomControl={false}
            >
              <LayersControl position="topright">
                <LayersControl.BaseLayer name="OpenStreetMap" checked={mapLayers.base === "OpenStreetMap"}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="OpenTopoMap" checked={mapLayers.base === "OpenTopoMap"}>
                  <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite" checked={mapLayers.base === "Satellite"}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                </LayersControl.BaseLayer>
              </LayersControl>
              
              <ZoomControl position="bottomright" />
              <AutoCenterMap userLocation={userLocation} />
              
              {/* Marqueur de la position de l'utilisateur */}
              <Marker 
                position={[userLocation.lat, userLocation.lng]}
                icon={customIcons.user}
              >
                <Popup>
                  <strong>Votre position actuelle</strong>
                  <br />
                  {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  {analytics.nearestLocation && (
                    <div className="nearest-location">
                      Point d'intérêt le plus proche: {analytics.nearestLocation.name} ({analytics.nearestLocation.distance.toFixed(2)} km)
                    </div>
                  )}
                </Popup>
              </Marker>
              
              {/* Regrouper les marqueurs par type pour une meilleure organisation */}
              <FeatureGroup>
                <MarkerClusterGroup 
                  disableClusteringAtZoom={15}
                  spiderfyOnMaxZoom={true}
                  showCoverageOnHover={false}
                  zoomToBoundsOnClick={true}
                >
                  {/* Marqueurs d'emplacement */}
                  {sortedLocations.map((location) => (
                    <Marker
                      key={location.id}
                      position={[
                      location.latitude, location.longitude]}
                      icon={customIcons[location.type]}
                      eventHandlers={{
                        click: () => setSelectedLocation(location),
                      }}
                    >
                      <Popup>
                        <div className="popup-content">
                          <h3>{location.name}</h3>
                          <p>
                            <strong>Quartier:</strong> {location.neighborhood}
                          </p>
                          <p>
                            <strong>Distance:</strong> {location.distance.toFixed(2)} km
                          </p>

                          {/* Affichage des détails selon le type */}
                          {location.type === "hospital" && (
                            <div className="details">
                              <p>
                                <strong>Capacité:</strong> {location.details.capacity}
                              </p>
                              <p>
                                <strong>Taux d'occupation:</strong>{" "}
                                {location.details.occupancyRate}
                              </p>
                              <p>
                                <strong>Spécialités:</strong>{" "}
                                {location.details.specialties.join(", ")}
                              </p>
                              {clusters[location.id] !== undefined && (
                                <span
                                  style={{
                                    color: "#FFF",
                                    backgroundColor: getClusterColor(clusters[location.id]),
                                    padding: "5px 10px",
                                    borderRadius: "15px",
                                    fontSize: "12px",
                                    marginTop: "5px",
                                    display: "inline-block",
                                  }}
                                >
                                  Cluster: {clusters[location.id]}
                                </span>
                              )}
                            </div>
                          )}

                          {location.type === "shop" && (
                            <div className="details">
                              <p>
                                <strong>Catégorie:</strong> {location.details.category}
                              </p>
                              <p>
                                <strong>Horaires d'ouverture:</strong>{" "}
                                {location.details.openHours}
                              </p>
                              <p>
                                <strong>Accessibilité:</strong>{" "}
                                {location.details.wheelchair}
                              </p>
                            </div>
                          )}

                          {location.type === "station" && (
                            <div className="details">
                              <p>
                                <strong>Type:</strong> {location.details.type}
                              </p>
                              <p>
                                <strong>Lignes:</strong> {location.details.lines.join(", ")}
                              </p>
                              <p>
                                <strong>Accessibilité:</strong>{" "}
                                {location.details.wheelchair}
                              </p>
                            </div>
                          )}

                          <button onClick={() => setSelectedLocation(location)}>
                            Obtenir l'itinéraire
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              </FeatureGroup>
              {/* Afficher l'itinéraire vers un emplacement sélectionné */}
              {selectedLocation && userLocation && (
                <RoutingMachine
                  userLocation={userLocation}
                  destination={selectedLocation}
                  setRouteInfo={setRouteInfo}
                />
              )}
            </MapContainer>
          ) : (
            <div className="location-prompt">
              Veuillez autoriser l'accès à votre position pour afficher la carte.
              <button onClick={getUserLocation}>Activer la localisation</button>
            </div>
          )}
        </div>

        {/* Panneau d'analyse */}
        <div className="analytics-panel">
          <h3>Analyse des données</h3>

          <div className="analytics-item">
            <strong>Distance moyenne:</strong> {analytics.averageDistance} km
          </div>

          {analytics.nearestLocation && (
            <div className="analytics-item">
              <strong>Point d'intérêt le plus proche:</strong>
              <p>{analytics.nearestLocation.name}</p>
              <p>
                <strong>Type:</strong> {analytics.nearestLocation.type}
              </p>
              <p>
                <strong>Distance:</strong>{" "}
                {analytics.nearestLocation.distance.toFixed(2)} km
              </p>
            </div>
          )}

          <div className="analytics-item">
            <strong>Zones les plus fréquentées:</strong>
            {analytics.busyAreas.length > 0 ? (
              <ul className="busy-areas-list">
                {analytics.busyAreas.map((area, index) => (
                  <li key={index}>
                    {area.name} ({area.count} points d'intérêt)
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune zone fréquentée détectée</p>
            )}
          </div>

          <div className="analytics-item">
            <strong>Densité des points d'intérêt:</strong>
            <ul className="density-list">
              <li>Hôpitaux: {analytics.density.hospitals} / km²</li>
              <li>Boutiques: {analytics.density.shops} / km²</li>
              <li>Stations: {analytics.density.stations} / km²</li>
            </ul>
          </div>

          {activeLocationType === "hospitals" && (
            <div className="analytics-item">
              <strong>Clusters d'hôpitaux:</strong>
              <div className="clusters-visualization">
                {Object.entries(clusters).length > 0 ? (
                  Object.entries(clusters).map(([id, cluster]) => {
                    const hospital = locations.hospitals.find((h) => h.id === id);
                    return hospital ? (
                      <div
                        key={id}
                        className="cluster-item"
                        style={{ backgroundColor: getClusterColor(cluster) }}
                      >
                        {hospital.name} (C{cluster})
                      </div>
                    ) : null;
                  })
                ) : (
                  <p>Analyse des clusters en cours...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Détails sur l'emplacement sélectionné */}
      {selectedLocation && (
        <div className="selected-location-info">
          <div className="location-header">
            <h3>{selectedLocation.name}</h3>
            <button
              onClick={() => {
                setSelectedLocation(null);
                setRouteInfo({
                  distance: null,
                  duration: null,
                  routeFound: false,
                });
              }}
            >
              Fermer
            </button>
          </div>
          <div className="location-details">
            <div className="location-column">
              <p>
                <strong>Type:</strong>{" "}
                {selectedLocation.type.charAt(0).toUpperCase() +
                  selectedLocation.type.slice(1)}
              </p>
              <p>
                <strong>Quartier:</strong> {selectedLocation.neighborhood}
              </p>

              {selectedLocation.type === "hospital" && (
                <>
                  <p>
                    <strong>Capacité:</strong> {selectedLocation.details.capacity}
                  </p>
                  <p>
                    <strong>Taux d'occupation:</strong>{" "}
                    {selectedLocation.details.occupancyRate}
                  </p>
                  <p>
                    <strong>Spécialités:</strong>{" "}
                    {selectedLocation.details.specialties.join(", ")}
                  </p>
                </>
              )}

              {selectedLocation.type === "shop" && (
                <>
                  <p>
                    <strong>Catégorie:</strong>{" "}
                    {selectedLocation.details.category}
                  </p>
                  <p>
                    <strong>Horaires d'ouverture:</strong>{" "}
                    {selectedLocation.details.openHours}
                  </p>
                </>
              )}

              {selectedLocation.type === "station" && (
                <>
                  <p>
                    <strong>Type:</strong> {selectedLocation.details.type}
                  </p>
                  <p>
                    <strong>Lignes:</strong>{" "}
                    {selectedLocation.details.lines.join(", ")}
                  </p>
                  <p>
                    <strong>Fréquence:</strong>{" "}
                    {selectedLocation.details.frequency}
                  </p>
                </>
              )}
            </div>

            <div className="location-column">
              <p>
                <strong>Distance:</strong>{" "}
                {routeInfo.routeFound
                  ? `${routeInfo.distance} km`
                  : `${selectedLocation.distance.toFixed(2)} km`}
              </p>
              {routeInfo.routeFound && (
                <p>
                  <strong>Temps estimé:</strong> {routeInfo.duration} min
                </p>
              )}
              <p>
                <strong>Coordonnées:</strong>
                <br />
                {selectedLocation.latitude.toFixed(6)},{" "}
                {selectedLocation.longitude.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapHospital;

// Ajoutez la feuille de style (CSS) pour accompagner les fonctionnalités

