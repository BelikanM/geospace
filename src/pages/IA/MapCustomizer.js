// src/pages/IA/MapCustomizer.js
import React, { useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { HexColorPicker } from 'react-colorful';
import L from 'leaflet';

function MapCustomizer({ onAddMarker, onAddPolygon, onClose }) {
  const map = useMap();
  const [markerName, setMarkerName] = useState('');
  const [markerDesc, setMarkerDesc] = useState('');
  const [polygonName, setPolygonName] = useState('');
  const [polygonDesc, setPolygonDesc] = useState('');
  const [activeTab, setActiveTab] = useState('marker');
  const [markerColor, setMarkerColor] = useState('#ff0000');
  const [polygonColor, setPolygonColor] = useState('#3388ff');
  const [polygonFillColor, setPolygonFillColor] = useState('#3388ff');
  const [polygonFillOpacity, setPolygonFillOpacity] = useState(0.2);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const polygonPointsRef = useRef([]);
  const tempLayersRef = useRef([]);

  const handleAddMarker = () => {
    const center = map.getCenter();
    
    // Créer une icône personnalisée avec la couleur sélectionnée
    const icon = new L.DivIcon({
      html: `<div style="
        background-color: ${markerColor};
        width: 24px;
        height: 24px;
        border-radius: 12px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-weight: bold;
        border: 2px solid white;
      "></div>`,
      className: 'custom-marker',
      iconSize: [24, 24]
    });
    
    onAddMarker({
      position: [center.lat, center.lng],
      name: markerName,
      description: markerDesc,
      color: markerColor,
      icon: icon
    });
    
    setMarkerName('');
    setMarkerDesc('');
  };

  const startDrawingPolygon = () => {
    setIsDrawing(true);
    polygonPointsRef.current = [];
    
    // Nettoyer les couches temporaires existantes
    tempLayersRef.current.forEach(layer => map.removeLayer(layer));
    tempLayersRef.current = [];
    
    // Ajouter un gestionnaire de clic à la carte
    map.on('click', handleMapClick);
    
    // Mettre à jour le curseur pour indiquer le mode dessin
    document.getElementById('map').style.cursor = 'crosshair';
  };

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    polygonPointsRef.current.push([lat, lng]);
    
    // Afficher un marqueur pour le point cliqué
    const marker = L.circleMarker([lat, lng], {
      radius: 5,
      color: polygonColor,
      fillColor: polygonColor,
      fillOpacity: 1
    }).addTo(map);
    
    tempLayersRef.current.push(marker);
    
    // Si nous avons au moins 2 points, dessiner une ligne
    if (polygonPointsRef.current.length >= 2) {
      const lastIndex = polygonPointsRef.current.length - 1;
      const line = L.polyline([
        polygonPointsRef.current[lastIndex - 1],
        polygonPointsRef.current[lastIndex]
      ], {
        color: polygonColor
      }).addTo(map);
      
      tempLayersRef.current.push(line);
    }
  };

  const finishDrawingPolygon = () => {
    if (polygonPointsRef.current.length < 3) {
      alert("Veuillez sélectionner au moins 3 points pour créer un polygone");
      return;
    }
    
    // Ajouter le polygone
    onAddPolygon({
      positions: polygonPointsRef.current,
      name: polygonName,
      description: polygonDesc,
      color: polygonColor,
      fillColor: polygonFillColor,
      fillOpacity: polygonFillOpacity
    });
    
    // Nettoyer
    map.off('click', handleMapClick);
    document.getElementById('map').style.cursor = '';
    
    tempLayersRef.current.forEach(layer => map.removeLayer(layer));
    tempLayersRef.current = [];
    
    setIsDrawing(false);
    setPolygonName('');
    setPolygonDesc('');
    polygonPointsRef.current = [];
  };

  const cancelDrawingPolygon = () => {
    map.off('click', handleMapClick);
    document.getElementById('map').style.cursor = '';
    
    tempLayersRef.current.forEach(layer => map.removeLayer(layer));
    tempLayersRef.current = [];
    
    setIsDrawing(false);
    polygonPointsRef.current = [];
  };

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      right: '10px',
      zIndex: 1000,
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '5px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      width: '300px',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <button 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          backgroundColor: 'transparent',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer'
        }}
      >
        ✕
      </button>
      
      <h3 style={{ marginTop: 0 }}>Personnaliser la carte</h3>
      
      <div style={{ display: 'flex', marginBottom: '15px' }}>
        <button 
          onClick={() => setActiveTab('marker')}
          style={{
            flex: 1,
            padding: '8px 0',
            backgroundColor: activeTab === 'marker' ? '#4CAF50' : '#f1f1f1',
            color: activeTab === 'marker' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px 0 0 4px',
            cursor: 'pointer'
          }}
        >
          Marqueurs
        </button>
        <button 
          onClick={() => setActiveTab('polygon')}
          style={{
            flex: 1,
            padding: '8px 0',
            backgroundColor: activeTab === 'polygon' ? '#4CAF50' : '#f1f1f1',
            color: activeTab === 'polygon' ? 'white' : 'black',
            border: 'none',
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer'
          }}
        >
          Zones
        </button>
      </div>
      
      {activeTab === 'marker' && (
        <div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="markerName" style={{ display: 'block', marginBottom: '5px' }}>
              Nom du point
            </label>
            <input
              id="markerName"
              type="text"
              value={markerName}
              onChange={(e) => setMarkerName(e.target.value)}
              placeholder="Ex: Mon restaurant préféré"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="markerDesc" style={{ display: 'block', marginBottom: '5px' }}>
              Description
            </label>
            <textarea
              id="markerDesc"
              value={markerDesc}
              onChange={(e) => setMarkerDesc(e.target.value)}
              placeholder="Entrez une description..."
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', minHeight: '60px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Couleur du marqueur
            </label>
            <HexColorPicker color={markerColor} onChange={setMarkerColor} style={{ width: '100%' }} />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: markerColor,
                  marginRight: '10px',
                  border: '1px solid #ddd'
                }}
              />
              <input
                type="text"
                value={markerColor}
                onChange={(e) => setMarkerColor(e.target.value)}
                style={{ padding: '5px', flex: 1 }}
              />
            </div>
          </div>
          
          <button
            onClick={handleAddMarker}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '5px'
            }}
          >
            Ajouter un marqueur au centre
          </button>
        </div>
      )}
      
      {activeTab === 'polygon' && (
        <div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="polygonName" style={{ display: 'block', marginBottom: '5px' }}>
              Nom de la zone
            </label>
            <input
              id="polygonName"
              type="text"
              value={polygonName}
              onChange={(e) => setPolygonName(e.target.value)}
              placeholder="Ex: Mon quartier"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              disabled={isDrawing}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="polygonDesc" style={{ display: 'block', marginBottom: '5px' }}>
              Description
            </label>
            <textarea
              id="polygonDesc"
              value={polygonDesc}
              onChange={(e) => setPolygonDesc(e.target.value)}
              placeholder="Entrez une description..."
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', minHeight: '60px' }}
              disabled={isDrawing}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Couleur du contour
            </label>
            <HexColorPicker color={polygonColor} onChange={setPolygonColor} style={{ width: '100%' }} disabled={isDrawing} />
            <input
              type="text"
              value={polygonColor}
              onChange={(e) => setPolygonColor(e.target.value)}
              style={{ padding: '5px', width: '100%', marginTop: '5px' }}
              disabled={isDrawing}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Couleur de remplissage
            </label>
            <HexColorPicker color={polygonFillColor} onChange={setPolygonFillColor} style={{ width: '100%' }} disabled={isDrawing} />
            <input
              type="text"
              value={polygonFillColor}
              onChange={(e) => setPolygonFillColor(e.target.value)}
              style={{ padding: '5px', width: '100%', marginTop: '5px' }}
              disabled={isDrawing}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Opacité de remplissage: {polygonFillOpacity}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={polygonFillOpacity}
              onChange={(e) => setPolygonFillOpacity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
              disabled={isDrawing}
            />
          </div>
          
          {!isDrawing ? (
            <button
              onClick={startDrawingPolygon}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '5px'
              }}
            >
              Commencer à dessiner une zone
            </button>
          ) : (
            <div>
              <p>Cliquez sur la carte pour ajouter des points (minimum 3)</p>
              <p>Points ajoutés: {polygonPointsRef.current.length}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={finishDrawingPolygon}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  disabled={polygonPointsRef.current.length < 3}
                >
                  Terminer
                </button>
                <button
                  onClick={cancelDrawingPolygon}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MapCustomizer;

