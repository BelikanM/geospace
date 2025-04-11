import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { saveUserLocation, getCurrentUser } from './appwrite';
import 'leaflet/dist/leaflet.css';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

// Composant pour le contrôle de recherche
const SearchField = () => {
  const map = useMap();
  
  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: 'bar',
      showMarker: true,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: true,
      searchLabel: 'Rechercher une adresse',
    });
    
    map.addControl(searchControl);
    
    return () => {
      map.removeControl(searchControl);
    };
  }, [map]);
  
  return null;
};

const Sécurité = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [zonesToAvoid, setZonesToAvoid] = useState([]);
  const mapRef = useRef(null);

  // Utiliser geolocation pour obtenir la position de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        saveUserLocationData(latitude, longitude);
      }, err => {
        console.error("Geolocation error:", err);
        alert("Impossible de récupérer votre position. Veuillez vérifier vos paramètres de localisation.");
      });
    } else {
      alert("Geolocation n'est pas supporté par ce navigateur.");
    }
  }, []);

  const saveUserLocationData = async (lat, lng) => {
    try {
      const user = await getCurrentUser();
      if (user) {
        await saveUserLocation(user.$id, { lat, lng }, {});
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la localisation:", error);
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // Limite de 2MB
      alert("Le fichier doit être inférieur à 2Mo.");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5006/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setZonesToAvoid(data.zones_to_avoid || []);
    } catch (error) {
      console.error("Erreur lors du téléchargement du PDF:", error);
      alert("Une erreur s'est produite lors du téléchargement du PDF.");
    }
  };

  return (
    <div>
      <h1>Application de Sécurité GPS</h1>
      <div style={{
        margin: '20px 0',
        padding: '10px',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <label htmlFor="pdf-upload" style={{
          display: 'block',
          marginBottom: '10px',
          fontWeight: 'bold'
        }}>
          Télécharger un PDF des zones à éviter:
        </label>
        <input 
          id="pdf-upload"
          type="file" 
          onChange={handlePdfUpload} 
          accept=".pdf"
          style={{
            border: '1px solid #ced4da',
            borderRadius: '4px',
            padding: '8px',
            width: '100%',
            maxWidth: '400px'
          }}
        />
      </div>
      
      {userLocation ? (
        <MapContainer 
          center={userLocation} 
          zoom={13} 
          style={{ height: '500px', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker position={userLocation}>
            <Popup>Vous êtes ici!</Popup>
          </Marker>
          {zonesToAvoid.map((zone, index) => (
            <Marker key={index} position={[zone.lat || 48.8566, zone.lng || 2.3522]}>
              <Popup>
                {zone.description?.substring(0, 255) || "Zone à éviter"}
              </Popup>
            </Marker>
          ))}
          <SearchField />
        </MapContainer>
      ) : (
        <div style={{
          height: '500px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          Chargement de la carte... Veuillez autoriser la géolocalisation.
        </div>
      )}
    </div>
  );
};

export default Sécurité;

