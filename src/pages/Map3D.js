import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { loginWithGoogle, getCurrentUser, saveUserLocation } from "./AppwriteConfig";
import axios from "axios";

// Custom markers for different location types
const customIcons = {
  hospital: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  shop: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  station: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  user: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  })
};

// Component to auto-center map on user location
function AutoCenterMap({ userLocation }) {
  const map = useMap();
  
  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [userLocation, map]);
  
  return null;
}

function MapHospital() {
  const [locations, setLocations] = useState({
    hospitals: [],
    shops: [],
    stations: []
  });
  const [userLocation, setUserLocation] = useState(null);
  const [directions, setDirections] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeLocationType, setActiveLocationType] = useState("hospitals");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clusters, setClusters] = useState({});
  const watchPositionId = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [analytics, setAnalytics] = useState({
    averageDistance: 0,
    nearestLocation: null,
    busyAreas: []
  });
  const dataUpdateInterval = useRef(null);

  // Fonction pour activer le GPS et mettre à jour la position de l'utilisateur
  const getUserLocation = () => {
    if (navigator.geolocation) {
      // Clear any existing watch
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
      
      watchPositionId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          
          // Save location if user is logged in
          if (loggedInUser) {
            saveUserLocation(loggedInUser.$id, newLocation, {
              timestamp: new Date().toISOString()
            });
          }
          
          // Initial fetch of nearby locations
          if (!locations.hospitals.length) {
            fetchNearbyLocations(newLocation);
          }
          
          // Set up interval to update data every minute (60000 ms)
          if (!dataUpdateInterval.current) {
            dataUpdateInterval.current = setInterval(() => {
              fetchNearbyLocations(newLocation);
            }, 60000);
          }
        },
        (error) => {
          console.error("Erreur lors de l'obtention de la position :", error);
          setError("Impossible d'accéder à votre position. Veuillez vérifier vos paramètres de localisation.");
        },
        { 
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 10000
        }
      );
    } else {
      setError("La géolocalisation n'est pas prise en charge par votre navigateur.");
    }
  };

  // Fetch nearby locations based on user position
  const fetchNearbyLocations = async (location) => {
    try {
      setIsLoading(true);
      
      // In a real application, you would fetch actual data from a backend API
      // This is a simulation for demonstration purposes
      const response = await mockFetchLocations(location);
      
      setLocations(response);
      
      // Calculate analytics on the new data
      calculateAnalytics(response, location);
      
      // Send hospitals to prediction API for clustering
      if (response.hospitals.length > 0) {
        predictHospitalClusters(response.hospitals);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la récupération des emplacements :", error);
      setError("Impossible de charger les emplacements à proximité.");
      setIsLoading(false);
    }
  };

  // Mock function to simulate API call for locations with more meaningful names
  const mockFetchLocations = async (location) => {
    // Simulating network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Real hospital names
    const hospitalNames = [
      "Hôpital Saint-Antoine", 
      "Clinique Pasteur", 
      "Centre Hospitalier Universitaire", 
      "Hôpital Américain", 
      "Clinique du Parc", 
      "Centre Médical Saint-Joseph",
      "Hôpital Privé Jacques Cartier",
      "Clinique des Cèdres"
    ];
    
    // Real shop names
    const shopNames = [
      "Pharmacie Centrale",
      "Carrefour Express", 
      "Franprix", 
      "Monoprix", 
      "Pharmacie de la Gare", 
      "Boulangerie Paul",
      "Auchan City",
      "Picard Surgelés",
      "Bio c' Bon",
      "Naturalia"
    ];
    
    // Real station names
    const stationNames = [
      "Gare du Nord", 
      "Station Château d'Eau", 
      "Arrêt République", 
      "Station Bastille", 
      "Terminal Montparnasse", 
      "Station Hôtel de Ville",
      "Arrêt de bus Opéra"
    ];
    
    // Neighborhoods for location context
    const neighborhoods = [
      "Quartier Latin", 
      "Montmartre", 
      "La Défense", 
      "Marais", 
      "Bastille", 
      "Montparnasse",
      "Belleville"
    ];

    // Generate some random locations around the user
    const generateRandomLocations = (count, type, namesArray) => {
      return Array.from({ length: count }, (_, i) => {
        const offsetLat = (Math.random() - 0.5) * 0.02;
        const offsetLng = (Math.random() - 0.5) * 0.02;
        const newLat = location.lat + offsetLat;
        const newLng = location.lng + offsetLng;
        
        // Calculate actual distance in km using Haversine formula
        const distance = calculateHaversineDistance(
          location.lat, location.lng,
          newLat, newLng
        );
        
        // Select a name from the array, or create a generic one if needed
        const name = i < namesArray.length 
          ? namesArray[i] 
          : `${type.charAt(0).toUpperCase() + type.slice(1)} ${neighborhoods[Math.floor(Math.random() * neighborhoods.length)]}`;
          
        return {
          id: `${type}-${i+1}`,
          name: name,
          latitude: newLat,
          longitude: newLng,
          distance: distance,
          type: type,
          neighborhood: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
          details: type === 'hospital' 
            ? { 
                capacity: Math.floor(Math.random() * 200) + 50,
                occupancyRate: Math.floor(Math.random() * 100) + "%",
                specialties: ["Cardiologie", "Pédiatrie", "Neurologie", "Urgences"].slice(0, Math.floor(Math.random() * 3) + 1)
              } 
            : type === 'shop' 
            ? { 
                category: ['Supermarché', 'Pharmacie', 'Boutique', 'Boulangerie', 'Épicerie'][Math.floor(Math.random() * 5)],
                openHours: `${7 + Math.floor(Math.random() * 3)}h - ${19 + Math.floor(Math.random() * 3)}h`
              } 
            : { 
                type: ['Bus', 'Train', 'Métro', 'Tramway'][Math.floor(Math.random() * 4)],
                lines: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => 
                  ['Ligne ' + (Math.floor(Math.random() * 14) + 1), 'Bus ' + (Math.floor(Math.random() * 90) + 10)][Math.floor(Math.random() * 2)]
                ),
                frequency: `Toutes les ${Math.floor(Math.random() * 10) + 3} minutes`
              }
        };
      });
    };
    
    return {
      hospitals: generateRandomLocations(5, 'hospital', hospitalNames),
      shops: generateRandomLocations(8, 'shop', shopNames),
      stations: generateRandomLocations(4, 'station', stationNames)
    };
  };

  // Calculate Haversine distance between two points
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Function to calculate analytics from location data
  const calculateAnalytics = (locationsData, userLocation) => {
    const allLocations = [
      ...locationsData.hospitals,
      ...locationsData.shops,
      ...locationsData.stations
    ];
    
    // Find nearest location
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
    
    // Calculate average distance to all locations
    const totalDistance = allLocations.reduce((sum, location) => {
      return sum + calculateHaversineDistance(
        userLocation.lat, userLocation.lng,
        location.latitude, location.longitude
      );
    }, 0);
    
    const averageDistance = allLocations.length > 0 
      ? totalDistance / allLocations.length 
      : 0;
    
    // Determine busy areas (areas with multiple locations)
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
    
    setAnalytics({
      averageDistance: averageDistance.toFixed(2),
      nearestLocation,
      busyAreas
    });
  };

  // Call the prediction API to cluster hospitals
  const predictHospitalClusters = async (hospitals) => {
    try {
      const response = await axios.post('http://localhost:5006/predict_hospital', {
        hospitals: hospitals
      });
      
      const newClusters = {};
      response.data.clusters.forEach((cluster, index) => {
        newClusters[hospitals[index].id] = cluster;
      });
      
      setClusters(newClusters);
    } catch (error) {
      console.error("Erreur lors de la prédiction des clusters d'hôpitaux :", error);
    }
  };

  // Fonction pour calculer les directions vers un emplacement
  const calculateDirections = async (location) => {
    try {
      setSelectedLocation(location);
      setIsLoading(true);
      
      // Using Google Directions API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${userLocation.lat},${userLocation.lng}&destination=${location.latitude},${location.longitude}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error('Erreur lors de la requête de directions');
      }
      
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Erreur API: ${data.status}`);
      }
      
      // Get route points
      const route = data.routes[0].overview_polyline.points;
      const decodedRoute = decodePolyline(route);
      setDirections(decodedRoute);
      
      // Get distance and duration
      const distanceText = data.routes[0].legs[0].distance.text;
      const durationText = data.routes[0].legs[0].duration.text;
      
      setDistanceToDestination(distanceText);
      setEstimatedTime(durationText);
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors du calcul des directions : ", error);
      
      // Fallback to simple direct line if Google API fails
      if (userLocation && location) {
        const directLine = [
          { lat: userLocation.lat, lng: userLocation.lng },
          { lat: location.latitude, lng: location.longitude }
        ];
        setDirections(directLine);
        
        // Calculate approximate distance
        const approxDistance = calculateHaversineDistance(
          userLocation.lat, userLocation.lng,
          location.latitude, location.longitude
        );
        
        setDistanceToDestination(`${approxDistance.toFixed(2)} km (approximatif)`);
        setEstimatedTime(`${Math.floor(approxDistance * 12)} min (approximatif)`);
      }
      
      setError("Les détails précis de l'itinéraire ne sont pas disponibles. Affichage d'une ligne directe approximative.");
      setIsLoading(false);
    }
  };

  // Décoder les points de la polyline Google Maps
  const decodePolyline = (str) => {
    let index = 0, lat = 0, lng = 0, coordinates = [];
    while (index < str.length) {
      let b, shift = 0, result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += dlat;
      shift = result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += dlng;
      coordinates.push([lat * 1e-5, lng * 1e-5]);
    }
    return coordinates.map(([lat, lng]) => ({ lat, lng }));
  };

  // Authentification avec Google via Appwrite
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      const user = await getCurrentUser();
      setLoggedInUser(user);
      
      // If user location exists, save it after login
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
  
  // Handle location type change
  const handleLocationTypeChange = (type) => {
    setActiveLocationType(type);
    setDirections([]); // Clear existing directions
    setSelectedLocation(null);
    setDistanceToDestination(null);
    setEstimatedTime(null);
  };
  
  // Cleanup function
  useEffect(() => {
    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
      
      if (dataUpdateInterval.current) {
        clearInterval(dataUpdateInterval.current);
      }
    };
  }, []);

  // Initial setup
  useEffect(() => {
    // Try to get current user first
    const checkCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setLoggedInUser(user);
        }
      } catch (error) {
        console.log("No user currently logged in");
      }
    };
    
    checkCurrentUser();
    getUserLocation();
  }, []);

  // Get cluster color based on cluster id
  const getClusterColor = (clusterId) => {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
    return colors[clusterId % colors.length];
  };

  // Sort locations by distance
  const sortedLocations = locations[activeLocationType]
    ? [...locations[activeLocationType]].sort((a, b) => a.distance - b.distance)
    : [];

  return (
    <div className="map-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Fermer</button>
        </div>
      )}
      
      <div className="map-controls">
        {!loggedInUser ? (
          <button onClick={handleGoogleLogin} className="login-button">
            Se connecter avec Google
          </button>
        ) : (
          <div className="user-info">
            Connecté: {loggedInUser.name || loggedInUser.email}
          </div>
        )}
        
        <div className="location-type-selector">
          <button 
            className={activeLocationType === "hospitals" ? "active" : ""} 
            onClick={() => handleLocationTypeChange("hospitals")}
          >
            Hôpitaux
          </button>
          <button 
            className={activeLocationType === "shops" ? "active" : ""} 
            onClick={() => handleLocationTypeChange("shops")}
          >
            Boutiques
          </button>
          <button 
            className={activeLocationType === "stations" ? "active" : ""} 
            onClick={() => handleLocationTypeChange("stations")}
          >
            Stations
          </button>
        </div>
        
        <div className="data-refresh-info">
          Mise à jour des données: toutes les minutes
        </div>
      </div>
      
      {isLoading && <div className="loading-indicator">Chargement...</div>}
      
      <div className="map-analytics-container">
        {/* Map area */}
        <div className="map-area">
          {userLocation ? (
            <MapContainer 
              center={[userLocation.lat, userLocation.lng]} 
              zoom={14} 
              style={{ height: "500px", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <AutoCenterMap userLocation={userLocation} />
              
              {/* User location marker */}
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
              
              {/* Location markers */}
              {sortedLocations.map((location) => (
                <Marker
                  key={location.id}
                  position={[location.latitude, location.longitude]}
                  icon={customIcons[location.type]}
                  eventHandlers={{
                    click: () => calculateDirections(location),
                  }}
                >
                  <Popup>
                    <div className="location-popup">
                      <h3>{location.name}</h3>
                      <p>Quartier: {location.neighborhood}</p>
                      <p>Distance: {location.distance.toFixed(2)} km</p>
                      
                      {location.type === 'hospital' && (
                        <div>
                          <p>Capacité: {location.details.capacity} lits</p>
                          <p>Taux d'occupation: {location.details.occupancyRate}</p>
                          <p>Spécialités: {location.details.specialties.join(", ")}</p>
                          {clusters[location.id] !== undefined && (
                            <div className="cluster-badge" style={{ backgroundColor: getClusterColor(clusters[location.id]) }}>
                              Cluster: {clusters[location.id]}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {location.type === 'shop' && (
                        <div>
                          <p>Catégorie: {location.details.category}</p>
                          <p>Heures d'ouverture: {location.details.openHours}</p>
                        </div>
                      )}
                      
                      {location.type === 'station' && (
                        <div>
                          <p>Type: {location.details.type}</p>
                          <p>Lignes: {location.details.lines.join(", ")}</p>
                          <p>Fréquence: {location.details.frequency}</p>
                        </div>
                      )}
                      
                      <button onClick={() => calculateDirections(location)}>
                        Obtenir l'itinéraire
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Display route if available */}
              {directions.length > 0 && (
                <Polyline 
                  positions={directions.map(point => [point.lat, point.lng])} 
                  color="blue" 
                  weight={5}
                  opacity={0.7}
                  dashArray="10, 10"
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
        
        {/* Analytics panel */}
        <div className="analytics-panel">
          <h3>Analyse des données</h3>
          
          <div className="analytics-item">
            <strong>Distance moyenne:</strong> {analytics.averageDistance} km
          </div>
          
          {analytics.nearestLocation && (
            <div className="analytics-item">
              <strong>Point d'intérêt le plus proche:</strong>
              <div>{analytics.nearestLocation.name}</div>
              <div>Type: {analytics.nearestLocation.type}</div>
              <div>Distance: {analytics.nearestLocation.distance.toFixed(2)} km</div>
            </div>
          )}
          
          <div className="analytics-item">
            <strong>Zones les plus fréquentées:</strong>
            {analytics.busyAreas.length > 0 ? (
              <ul className="busy-areas-list">
                {analytics.busyAreas.map((area, index) => (
                  <li key={index}>{area.name} ({area.count} points d'intérêt)</li>
                ))}
              </ul>
            ) : (
              <div>Aucune zone fréquentée détectée</div>
            )}
          </div>
          
          {activeLocationType === "hospitals" && (
            <div className="analytics-item">
              <strong>Clusters d'hôpitaux:</strong>
              <div className="clusters-visualization">
                {Object.entries(clusters).length > 0 ? (
                  Object.entries(clusters).map(([id, cluster]) => {
                    const hospital = locations.hospitals.find(h => h.id === id);
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
                  <div>Analyse des clusters en cours...</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Display selected location info */}
      {selectedLocation && (
        <div className="selected-location-info">
          <div className="location-header">
            <h3>{selectedLocation.name}</h3>
            <button onClick={() => { 
              setSelectedLocation(null); 
              setDirections([]);
              setDistanceToDestination(null);
              setEstimatedTime(null);
            }}>
              Fermer
            </button>
          </div>
          
          <div className="location-details">
            <div className="location-column">
              <p><strong>Type:</strong> {selectedLocation.type.charAt(0).toUpperCase() + selectedLocation.type.slice(1)}</p>
              <p><strong>Quartier:</strong> {selectedLocation.neighborhood}</p>
              
              {selectedLocation.type === 'hospital' && (
                <>
                  <p><strong>Capacité:</strong> {selectedLocation.details.capacity} lits</p>
                  <p><strong>Taux d'occupation:</strong> {selectedLocation.details.occupancyRate}</p>
                  <p><strong>Spécialités:</strong> {selectedLocation.details.specialties.join(", ")}</p>
                </>
              )}
              
              {selectedLocation.type === 'shop' && (
                <>
                  <p><strong>Catégorie:</strong> {selectedLocation.details.category}</p>
                  <p><strong>Heures d'ouverture:</strong> {selectedLocation.details.openHours}</p>
                </>
              )}
              
              {selectedLocation.type === 'station' && (
                <>
                  <p><strong>Type:</strong> {selectedLocation.details.type}</p>
                  <p><strong>Lignes:</strong> {selectedLocation.details.lines.join(", ")}</p>
                  <p><strong>Fréquence:</strong> {selectedLocation.details.frequency}</p>
                </>
              )}
            </div>
            
            <div className="location-column">
              <p><strong>Distance:</strong> {distanceToDestination || `${selectedLocation.distance.toFixed(2)} km`}</p>
              {estimatedTime && <p><strong>Temps estimé:</strong> {estimatedTime}</p>}
              <p><strong>Coordonnées:</strong><br/>{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</p>
            </div>
          </div>
          
          {directions.length > 0 && (
            <div className="route-info">
              <p><strong>Itinéraire:</strong> {directions.length} points de passage</p>
            </div>
          )}
        </div>
      )}

      {/* Add CSS for the component */}
      <style jsx>{`
        .map-container {
          position: relative;
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          background-color: #f9f9f9;
          padding: 10px;
        }
        
        .error-message {
          background-color: #ff5252;
          color: white;
          padding: 10px;
          margin-bottom: 10px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .error-message button {
          background: transparent;
          border: 1px solid white;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .map-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .location-type-selector {
          display: flex;
          gap: 5px;
        }
        
        .location-type-selector button {
          padding: 8px 12px;
          border: none;
          background-color: #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }
        
        .location-type-selector button.active {
          background-color: #2196f3;
          color: white;
        }
        
        .login-button {
          padding: 8px 16px;
          background-color: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .data-refresh-info {
          font-size: 12px;
          color: #666;
          background-color: #e8f5e9;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .loading-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          z-index: 1000;
        }
        
        .location-prompt {
          height: 500px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: #f5f5f5;
          gap: 20px;
          border-radius: 8px;
        }
        
        .location-prompt button {
          padding: 10px 20px;
          background-color: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .map-analytics-container {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }
        
        .map-area {
          flex: 3;
          min-width: 300px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .analytics-panel {
          flex: 1;
          min-width: 250px;
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .analytics-panel h3 {
          margin: 0 0 15px 0;
          padding-bottom: 10px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .analytics-item {
          margin-bottom: 15px;
        }
        
        .busy-areas-list {
          margin: 5px 0;
          padding-left: 20px;
        }
        
        .clusters-visualization {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 5px;
        }
        
        .cluster-item {
          padding: 3px 8px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
        }
        
        .location-popup {
          min-width: 200px;
        }
        
        .location-popup h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
        }
        
        .location-popup button {
          margin-top: 10px;
          padding: 5px 10px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
        }
        
        .cluster-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
          margin-top: 5px;
        }
        
        .selected-location-info {
          margin-top: 15px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .location-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .location-header h3 {
          margin: 0;
          font-size: 18px;
          color: #333;
        }
        
        .location-header button {
          padding: 5px 10px;
          background-color: #e0e0e0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .location-details {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .location-column {
          flex: 1;
          min-width: 250px;
        }
        
        .location-column p {
          margin: 8px 0;
        }
        
        .route-info {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e0e0e0;
        }
        
        .user-info {
          padding: 8px;
          background-color: #e8f5e9;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .nearest-location {
          margin-top: 8px;
          font-size: 12px;
          background-color: rgba(76, 175, 80, 0.1);
          padding: 4px;
          border-radius: 4px;
          border-left: 3px solid #4caf50;
        }
      `}</style>
    </div>
  );
}

export default MapHospital;

