import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLocationArrow, 
  faMapMarkerAlt, 
  faStreetView, 
  faStar, 
  faUser, 
  faCar, 
  faBiking, 
  faWalking, 
  faCloudSun, 
  faCloudRain,
  faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import styled from 'styled-components';
import { getCurrentUser, loginWithGoogle, logoutUser, saveUserLocation } from './appwrite';

// Styles
const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: 'Poppins', sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
`;

const Header = styled.header`
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderTitle = styled.div`
  flex: 1;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const UserAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
`;

const Button = styled.button`
  background: ${props => props.primary ? 'white' : 'transparent'};
  color: ${props => props.primary ? '#667eea' : 'white'};
  border: ${props => props.primary ? 'none' : '1px solid white'};
  border-radius: 20px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  
  &:hover {
    transform: scale(1.05);
    background: ${props => props.primary ? '#f0f0f0' : 'rgba(255, 255, 255, 0.2)'};
  }
`;

const LoginScreen = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  gap: 20px;
`;

const LoginCard = styled.div`
  background: white;
  border-radius: 10px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
  width: 90%;
`;

const GoogleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px 24px;
  font-weight: 500;
  width: 100%;
  transition: all 0.3s ease;
  margin-top: 20px;
  
  &:hover {
    background: #f5f5f5;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const MapWrapper = styled.div`
  flex: 1;
  position: relative;
`;

const ButtonPanel = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ControlButton = styled.button`
  background: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  color: #667eea;
  
  &:hover {
    transform: scale(1.1);
    background: #667eea;
    color: white;
  }
`;

const MarkerSelector = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 20px;
  padding: 10px 20px;
  display: flex;
  gap: 15px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  z-index: 1000;
`;

const MarkerOption = styled.button`
  background: ${props => props.active ? '#667eea' : 'white'};
  color: ${props => props.active ? 'white' : '#667eea'};
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.1);
  }
`;

const InfoBox = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  max-width: 280px;
  z-index: 1000;
`;

const WeatherInfo = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
`;

const WeatherIcon = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  color: ${props => props.color || '#333'};
`;

// LocationMarker component
function LocationMarker({ setPosition, markerIcon, user }) {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationInfo, setLocationInfo] = useState({
    neighborhood: 'Chargement...',
    weather: null
  });
  const map = useMap();
  const locationCircleRef = useRef(null);

  useEffect(() => {
    if (user) {
      map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true });
      
      map.on('locationfound', handleLocationFound);
      map.on('locationerror', handleLocationError);

      return () => {
        map.stopLocate();
        map.off('locationfound', handleLocationFound);
        map.off('locationerror', handleLocationError);
      };
    }
  }, [map, user]);

  // Fetch neighborhood and weather data when location changes
  useEffect(() => {
    if (location) {
      fetchLocationData(location.lat, location.lng);
    }
  }, [location]);

  // Save location to Appwrite when we have user, location and weather data
  useEffect(() => {
    if (user && location && locationInfo.weather) {
      saveUserLocation(user.$id, location, locationInfo)
        .then(() => console.log('Location saved successfully'))
        .catch(err => console.error('Error saving location:', err));
    }
  }, [user, location, locationInfo.weather]);

  const fetchLocationData = async (lat, lng) => {
    try {
      // Fetch neighborhood data from Nominatim
      const nominatimResponse = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'YourAppName' } }
      );
      
      let neighborhood = 'Non disponible';
      if (nominatimResponse.data && nominatimResponse.data.address) {
        const { suburb, neighbourhood, city_district } = nominatimResponse.data.address;
        neighborhood = suburb || neighbourhood || city_district || 'Non disponible';
      }
      
      // Fetch weather data from OpenWeatherMap
      // Note: You need an API key from openweathermap.org
      const WEATHER_API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with your actual API key
      const weatherResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${WEATHER_API_KEY}`
      );
      
      if (weatherResponse.data) {
        const weatherData = {
          temp: weatherResponse.data.main.temp,
          feels_like: weatherResponse.data.main.feels_like,
          description: weatherResponse.data.weather[0].description,
          icon: weatherResponse.data.weather[0].icon,
          main: weatherResponse.data.weather[0].main,
          humidity: weatherResponse.data.main.humidity,
          wind_speed: weatherResponse.data.wind.speed,
          precipitation: weatherResponse.data.rain ? weatherResponse.data.rain['1h'] : 0
        };
        
        setLocationInfo({
          neighborhood,
          weather: weatherData
        });
      } else {
        setLocationInfo({
          neighborhood,
          weather: null
        });
      }
    } catch (error) {
      console.error("Error fetching location data:", error);
      setLocationInfo({
        neighborhood: 'Erreur de chargement',
        weather: null
      });
    }
  };

  const handleLocationFound = (e) => {
    setLocation(e.latlng);
    setAccuracy(e.accuracy);
    setPosition(e.latlng);
    setLoading(false);
    
    // Update accuracy circle
    if (!locationCircleRef.current) {
      locationCircleRef.current = L.circle(e.latlng, { radius: e.accuracy }).addTo(map);
    } else {
      locationCircleRef.current.setLatLng(e.latlng);
      locationCircleRef.current.setRadius(e.accuracy);
    }
  };

  const handleLocationError = (e) => {
    setError(e.message);
    setLoading(false);
  };

  // Weather icon helper
  const getWeatherIconAndColor = (weatherMain) => {
    if (!weatherMain) return { icon: faCloudSun, color: '#888' };
    
    switch(weatherMain.toLowerCase()) {
      case 'rain':
      case 'drizzle':
      case 'thunderstorm':
        return { icon: faCloudRain, color: '#4286f4' };
      case 'snow':
        return { icon: faCloudRain, color: '#b5d8f7' };
      case 'clear':
        return { icon: faCloudSun, color: '#f39c12' };
      case 'clouds':
        return { icon: faCloudSun, color: '#95a5a6' };
      default:
        return { icon: faCloudSun, color: '#888' };
    }
  };

  return (
    <>
      {loading && <InfoBox>Localisation en cours...</InfoBox>}
      {error && <InfoBox>Erreur: {error}</InfoBox>}
      {location && (
        <>
          <InfoBox>
            <h3>Informations</h3>
            <p><strong>Quartier:</strong> {locationInfo.neighborhood}</p>
            <p><strong>Précision:</strong> {Math.round(accuracy)} mètres</p>
            
            {locationInfo.weather && (
              <WeatherInfo>
                <h4>Météo actuelle</h4>
                <WeatherIcon color={getWeatherIconAndColor(locationInfo.weather.main).color}>
                  <FontAwesomeIcon icon={getWeatherIconAndColor(locationInfo.weather.main).icon} />
                  <span>{locationInfo.weather.temp.toFixed(1)}°C</span>
                </WeatherIcon>
                <p>{locationInfo.weather.description}</p>
                <p><strong>Ressenti:</strong> {locationInfo.weather.feels_like.toFixed(1)}°C</p>
                <p><strong>Humidité:</strong> {locationInfo.weather.humidity}%</p>
                <p><strong>Vent:</strong> {locationInfo.weather.wind_speed} m/s</p>
                {locationInfo.weather.precipitation > 0 && (
                  <p><strong>Précipitations:</strong> {locationInfo.weather.precipitation} mm</p>
                )}
              </WeatherInfo>
            )}
          </InfoBox>
          <Marker position={location} icon={markerIcon}>
            <Popup>
              Vous êtes ici<br/>
              Latitude: {location.lat.toFixed(4)}<br/>
              Longitude: {location.lng.toFixed(4)}
            </Popup>
          </Marker>
        </>
      )}
    </>
  );
}

// StreetsData component remains the same
function StreetsData() {
  const [streets, setStreets] = useState(null);
  const map = useMap();

  useEffect(() => {
    // This function should be replaced with a real API call to get GeoJSON data
    const fetchStreetsData = async () => {
      try {
        // Replace with a real API call
        // Example: const response = await axios.get('https://api.example.com/streets.geojson');
        
        // For the example, I use an empty GeoJSON
        const dummyData = {
          type: "FeatureCollection",
          features: []
        };
        
        setStreets(dummyData);
      } catch (error) {
        console.error("Error loading streets:", error);
      }
    };

    fetchStreetsData();
  }, []);

  const streetStyle = {
    color: "#3388ff",
    weight: 3,
    opacity: 0.7
  };

  return streets ? <GeoJSON data={streets} style={streetStyle} /> : null;
}

// Main component
function GeoLocationMap() {
  const [position, setPosition] = useState(null);
  const [markerType, setMarkerType] = useState('pin');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Check authentication status on component mount
  useEffect(() => {
    async function checkUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    
    checkUser();
  }, []);

  // Handle Google login
  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  // Different marker types
  const markerIcons = {
    pin: L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    }),
    user: L.divIcon({
      html: `<div style="background-color: #4a89dc; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;">
              <i class="fas fa-user"></i>
            </div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    }),
    car: L.divIcon({
      html: `<div style="background-color: #ed5565; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;">
              <i class="fas fa-car"></i>
            </div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    }),
    bike: L.divIcon({
      html: `<div style="background-color: #2ecc71; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;">
              <i class="fas fa-bicycle"></i>
            </div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    }),
    star: L.divIcon({
      html: `<div style="background-color: #f39c12; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;">
              <i class="fas fa-star"></i>
            </div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  };

  // Get active marker
  const activeMarker = markerIcons[markerType];

  // Center map on current position
  const centerMap = (map) => {
    if (position) {
      map.flyTo(position, 15);
    }
  };

  // CenterMapButton component
  function CenterMapButton() {
    const map = useMap();
    return (
      <ButtonPanel>
        <ControlButton onClick={() => centerMap(map)}>
          <FontAwesomeIcon icon={faLocationArrow} size="lg" />
        </ControlButton>
      </ButtonPanel>
    );
  }

  if (loading) {
    return (
      <AppContainer>
        <Header>
          <HeaderTitle>
            <h1>Ma Localisation en Temps Réel</h1>
          </HeaderTitle>
        </Header>
        <LoginScreen>
          <h2>Chargement...</h2>
        </LoginScreen>
      </AppContainer>
    );
  }

  // Login screen if not authenticated
  if (!user) {
    return (
      <AppContainer>
        <Header>
          <HeaderTitle>
            <h1>Ma Localisation en Temps Réel</h1>
          </HeaderTitle>
        </Header>
        <LoginScreen>
          <LoginCard>
            <h2>Bienvenue</h2>
            <p>Connectez-vous pour accéder à votre localisation en temps réel</p>
            <GoogleButton onClick={handleGoogleLogin}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" width="20" />
              Se connecter avec Google
            </GoogleButton>
          </LoginCard>
        </LoginScreen>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Header>
        <HeaderTitle>
          <h1>Ma Localisation en Temps Réel</h1>
        </HeaderTitle>
        <UserInfo>
          <UserAvatar>
            <FontAwesomeIcon icon={faUser} />
          </UserAvatar>
          <span>{user.name || user.email}</span>
          <Button onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} /> Déconnexion
          </Button>
        </UserInfo>
      </Header>
      <MapWrapper>
        <MapContainer 
          center={[48.8566, 2.3522]} // Paris by default
          zoom={13} 
          style={{ height: '100%', width: '100%' }} 
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker setPosition={setPosition} markerIcon={activeMarker} user={user} />
          <StreetsData />
          <CenterMapButton />
        </MapContainer>
        
        <MarkerSelector>
          <MarkerOption 
            active={markerType === 'pin'} 
            onClick={() => setMarkerType('pin')}
            title="Marqueur standard"
          >
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </MarkerOption>
          <MarkerOption 
            active={markerType === 'user'} 
            onClick={() => setMarkerType('user')}
            title="Avatar utilisateur"
          >
            <FontAwesomeIcon icon={faUser} />
          </MarkerOption>
          <MarkerOption 
            active={markerType === 'car'} 
            onClick={() => setMarkerType('car')}
            title="Voiture"
          >
            <FontAwesomeIcon icon={faCar} />
          </MarkerOption>
          <MarkerOption 
            active={markerType === 'bike'} 
            onClick={() => setMarkerType('bike')}
            title="Vélo"
          >
            <FontAwesomeIcon icon={faBiking} />
          </MarkerOption>
          <MarkerOption 
            active={markerType === 'star'} 
            onClick={() => setMarkerType('star')}
            title="Étoile"
          >
            <FontAwesomeIcon icon={faStar} />
          </MarkerOption>
        </MarkerSelector>
      </MapWrapper>
    </AppContainer>
  );
}

export default GeoLocationMap;


