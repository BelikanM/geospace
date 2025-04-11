import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapCustomizer from './MapCustomizer';

function MapCustomizerPage() {
  const handleAddMarker = (markerDetails) => {
    console.log('Marker added:', markerDetails);
  };

  const handleAddPolygon = (polygonDetails) => {
    console.log('Polygon added:', polygonDetails);
  };

  const handleClose = () => {
    console.log('Map customizer closed');
  };

  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: "100vh", width: "100%" }} id="map">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCustomizer onAddMarker={handleAddMarker} onAddPolygon={handleAddPolygon} onClose={handleClose} />
    </MapContainer>
  );
}

export default MapCustomizerPage;

