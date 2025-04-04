// pages/Map2D.js
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { databases, DATABASE_ID, COLLECTION_ID, ID } from './appwrite';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-contextmenu';
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css';

// Icon fix pour Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
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
function LocationMarker({ setUserLocation }) {
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
  }, [map, setUserLocation]);

  return position ? (
    <>
      <Marker position={position}>
        <Popup>
          Votre position<br/>
          Précision: {Math.round(accuracy)} mètres
        </Popup>
      </Marker>
      <circle center={position} radius={accuracy} />
    </>
  ) : null;
}

export default function Map2D({ initialCenter = [48.8566, 2.3522] }) {
  const [userLocation, setUserLocation] = useState(initialCenter);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [buildingData, setBuildingData] = useState({});
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  
  const fetchBuildingData = async (lat, lon) => {
    setLoading(true);
    try {
      // Récupérer les bâtiments avec Overpass API
      const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=[out:json];way[building](around:500,${lat},${lon});out geom;`
      );
      const data = await response.json();
      
      // Mapper les bâtiments avec plus d'informations
      const buildingsWithInfo = data.elements.map(el => {
        const coords = el.geometry.map(pt => [pt.lat, pt.lon]);
        
        // Calculer le centre du bâtiment
        const center = coords.reduce(
          (acc, curr) => [acc[0] + curr[0]/coords.length, acc[1] + curr[1]/coords.length], 
          [0, 0]
        );
        
        // Extraire plus d'informations sur le bâtiment
        const info = {
          id: el.id,
          name: el.tags?.name || 'Bâtiment sans nom',
          type: el.tags?.building || 'Type inconnu',
          address: el.tags['addr:street'] ? 
            `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street'] || ''}, ${el.tags['addr:postcode'] || ''}` 
            : 'Adresse inconnue',
          amenity: el.tags?.amenity || '',
          height: el.tags?.height || 'Inconnue',
          center: center
        };
        
        return { 
          id: el.id,
          coords: coords, 
          info: info 
        };
      });
      
      setBuildings(buildingsWithInfo);
      
      // Créer un objet indexé par ID pour un accès rapide
      const buildingDataObj = {};
      buildingsWithInfo.forEach(b => {
        buildingDataObj[b.id] = b.info;
      });
      setBuildingData(buildingDataObj);
      
      // Enregistrer les bâtiments dans Appwrite
      saveBuildingsToAppwrite(buildingsWithInfo);
      
    } catch (error) {
      console.error("Erreur lors de la récupération des bâtiments:", error);
      alert("Problème lors du chargement des données des bâtiments.");
    } finally {
      setLoading(false);
    }
  };
  
  const saveBuildingsToAppwrite = async (buildings) => {
    try {
      const promises = buildings.map(building => {
        return databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          {
            buildingId: building.id.toString(),
            coords: JSON.stringify(building.coords),
            info: JSON.stringify(building.info),
            location: [building.info.center[0], building.info.center[1]],
            timestamp: new Date().toISOString()
          }
        );
      });
      
      await Promise.all(promises);
      console.log(`${buildings.length} bâtiments enregistrés dans la base de données`);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des bâtiments:", error);
    }
  };
  
  // Quand la position de l'utilisateur change, mettre à jour les bâtiments
  useEffect(() => {
    fetchBuildingData(userLocation[0], userLocation[1]);
  }, [userLocation]);
  
  const handleBuildingClick = (id) => {
    setSelectedBuilding(id);
  };
  
  const createRouteToBuilding = (buildingId) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    // Supprimer l'ancien itinéraire s'il existe
    if (map._routingControl) {
      map.removeControl(map._routingControl);
    }
    
    const building = buildingData[buildingId];
    if (!building) return;
    
    // Créer un nouvel itinéraire
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(building.center[0], building.center[1])
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
          <div className="loading-spinner">Chargement des bâtiments...</div>
        </div>
      )}
      
      <MapContainer 
        center={userLocation} 
        zoom={17} 
        style={{ height: "100%", width: "100%" }}
        whenCreated={mapInstance => {
          mapRef.current = mapInstance;
        }}
        contextmenu={true}
        contextmenuItems={[
          {
            text: 'Rafraîchir les bâtiments ici',
            callback: (e) => {
              setUserLocation([e.latlng.lat, e.latlng.lng]);
            }
          }
        ]}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <LocationMarker setUserLocation={setUserLocation} />
        <MapUpdater center={userLocation} />
        
        {buildings.map((building) => (
          <Polygon 
            key={building.id} 
            positions={building.coords} 
            pathOptions={{ 
              color: selectedBuilding === building.id ? "#FF5733" : "#00cc66",
              weight: selectedBuilding === building.id ? 3 : 1.5, 
              fillOpacity: 0.5 
            }} 
            eventHandlers={{
              click: () => handleBuildingClick(building.id)
            }}
          >
            <Popup>
              <div className="building-popup">
                <h3>{building.info.name}</h3>
                <p><strong>Type:</strong> {building.info.type}</p>
                <p><strong>Adresse:</strong> {building.info.address}</p>
                {building.info.amenity && <p><strong>Équipement:</strong> {building.info.amenity}</p>}
                {building.info.height && <p><strong>Hauteur:</strong> {building.info.height}</p>}
                <button 
                  onClick={() => createRouteToBuilding(building.id)}
                  style={{
                    padding: '8px 12px',
                    background: '#4285F4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Itinéraire jusqu'ici
                </button>
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>
      
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'white',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        <button 
          onClick={() => fetchBuildingData(userLocation[0], userLocation[1])}
          style={{
            padding: '8px 16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Actualiser les bâtiments
        </button>
      </div>
    </div>
  );
}

