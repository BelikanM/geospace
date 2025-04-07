import React from 'react';

export default function OverlayHUD({ data }) {
  if (!data) return null;
  const s = data.stats || {};
  return (
    <div style={{
      position: 'absolute',
      bottom: 20, right: 20,
      zIndex: 3,
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '10px',
      borderRadius: '8px',
      textAlign: 'left'
    }}>
      <div>🏢 Bâtiments : {s.building_count}</div>
      <div>🛣 Routes     : {s.road_count}</div>
      <div>💧 Plans d’eau: {s.water_count}</div>
      <div>🌳 Espaces verts: {s.landuse_count}</div>
      <div>📊 Densité    : {s.urban_density_score}/10</div>
      <div>🚗 Accessibilité: {s.accessibility_score}/10</div>
    </div>
  );
}
