// utilitaires : appel API et conversion géo → 3D
import axios from 'axios';

const API_URL = 'http://localhost:5000/analyze';

export async function analyzeLocation(location, features = {}) {
  const payload = {
    location,
    buildings: features.buildings || [],
    roads:     features.roads     || [],
    water:     features.water     || [],
    landUse:   features.landUse   || [],
  };
  const res = await axios.post(API_URL, payload);
  return res.data;
}

// Convertit deux paires lat/lon en coordonnées x (Est) / z (Nord) en mètres
export function latLonToMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // rayon Terre en m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) *
            Math.cos(lat2*Math.PI/180) *
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  // projection approximative
  const x = d * Math.sin(dLon);
  const z = d * Math.sin(dLat);
  return [x, z];
}
