import React from 'react';

export default function UrbanAnalysis({ data }) {
  if (!data) return null;
  return (
    <div style={{
      position:'absolute',
      top: 20, left: 20,
      zIndex: 3,
      background: 'rgba(255,255,255,0.9)',
      padding: '12px',
      borderRadius: '8px',
      maxWidth: '300px'
    }}>
      <h4>🔍 Patterns détectés</h4>
      <ul>
        {data.patterns.map((p,i) => <li key={i}>• {p}</li>)}
      </ul>
      <h4>💡 Recommandations</h4>
      <ul>
        {data.recommendations.map((r,i) => <li key={i}>– {r}</li>)}
      </ul>
    </div>
  );
}
