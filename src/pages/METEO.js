import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { WiDaySunny, WiRain, WiSnow, WiCloudy, WiThunderstorm, WiFog } from 'react-icons/wi';
import { FaLocationArrow, FaSearch, FaCog, FaTimes } from 'react-icons/fa';
import './WeatherWidget.css';

const WeatherWidget = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [city, setCity] = useState('');
  const [searchedCity, setSearchedCity] = useState('Paris');
  const [unit, setUnit] = useState('metric'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const API_KEY = 'fde47546c8b1586e04e04dece09e89a6';

  useEffect(() => {
    const fetchWeatherData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Requête pour les données météo actuelles
        const currentWeatherResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${searchedCity}&units=${unit}&appid=${API_KEY}`
        );
        
        // Requête pour les prévisions
        const forecastResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?q=${searchedCity}&units=${unit}&appid=${API_KEY}`
        );
        
        setWeatherData(currentWeatherResponse.data);
        
        // Filtrer les prévisions pour avoir une entrée par jour (à midi)
        const dailyForecast = forecastResponse.data.list.filter(item => 
          item.dt_txt.includes('12:00:00')
        ).slice(0, 5);
        
        setForecast(dailyForecast);
        setLoading(false);
      } catch (err) {
        setError('Impossible de récupérer les données météo. Vérifiez le nom de la ville.');
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, [searchedCity, unit]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (city.trim() !== '') {
      setSearchedCity(city);
      setCity('');
      setSidebarOpen(false);
    }
  };
  
  const handleUnitToggle = () => {
    setUnit(unit === 'metric' ? 'imperial' : 'metric');
  };
  
  const getLocationWeather = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=${unit}&appid=${API_KEY}`
          );
          setSearchedCity(response.data.name);
          setSidebarOpen(false);
        } catch (err) {
          setError("Impossible d'obtenir la météo pour votre localisation.");
        }
      }, () => {
        setError("L'accès à la géolocalisation a été refusé.");
      });
    } else {
      setError("La géolocalisation n'est pas supportée par ce navigateur.");
    }
  };

  const getWeatherIcon = (weatherCode) => {
    if (!weatherCode) return <WiCloudy size={36} />;
    
    const code = weatherCode.toLowerCase();
    
    if (code.includes('thunderstorm')) return <WiThunderstorm size={36} />;
    if (code.includes('rain') || code.includes('drizzle')) return <WiRain size={36} />;
    if (code.includes('snow')) return <WiSnow size={36} />;
    if (code.includes('clear')) return <WiDaySunny size={36} />;
    if (code.includes('fog') || code.includes('mist')) return <WiFog size={36} />;
    return <WiCloudy size={36} />;
  };
  
  const formatDate = (dt) => {
    const date = new Date(dt * 1000);
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="weather-container loading">
        <div className="loading-spinner"></div>
        <p>Chargement des données météo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-container error">
        <h2>Erreur</h2>
        <p>{error}</p>
        <button onClick={() => setSearchedCity('Paris')}>Réessayer</button>
      </div>
    );
  }

  if (!weatherData) return null;

  const temperatureSymbol = unit === 'metric' ? '°C' : '°F';
  const windSpeedUnit = unit === 'metric' ? 'km/h' : 'mph';

  return (
    <div className="weather-widget-container">
      <motion.div 
        className="weather-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Météo actuelle */}
        <div className="current-weather">
          <div className="city-info">
            <h2>{weatherData.name}, {weatherData.sys.country}</h2>
            <p className="date">{formatDate(weatherData.dt)}</p>
          </div>
          
          <div className="weather-info">
            <div className="temperature">
              <h1>{Math.round(weatherData.main.temp)}{temperatureSymbol}</h1>
              <p>Ressenti: {Math.round(weatherData.main.feels_like)}{temperatureSymbol}</p>
            </div>
            
            <div className="weather-description">
              {getWeatherIcon(weatherData.weather[0].main)}
              <p>{weatherData.weather[0].description.charAt(0).toUpperCase() + weatherData.weather[0].description.slice(1)}</p>
            </div>
          </div>
          
          <div className="weather-details">
            <div className="detail-item">
              <span className="label">Humidité</span>
              <span className="value">{weatherData.main.humidity}%</span>
            </div>
            <div className="detail-item">
              <span className="label">Vent</span>
              <span className="value">{Math.round(unit === 'metric' ? weatherData.wind.speed * 3.6 : weatherData.wind.speed)} {windSpeedUnit}</span>
            </div>
            <div className="detail-item">
              <span className="label">Pression</span>
              <span className="value">{weatherData.main.pressure} hPa</span>
            </div>
            <div className="detail-item">
              <span className="label">Visibilité</span>
              <span className="value">{(weatherData.visibility / 1000).toFixed(1)} km</span>
            </div>
          </div>
        </div>
        
        {/* Prévisions sur 5 jours */}
        <div className="forecast">
          <h3>Prévisions sur 5 jours</h3>
          <div className="forecast-container">
            {forecast.map((day, index) => (
              <motion.div 
                key={index} 
                className="forecast-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <p className="forecast-date">{formatDate(day.dt).split(' ')[0]}</p>
                {getWeatherIcon(day.weather[0].main)}
                <p className="forecast-temp">{Math.round(day.main.temp)}{temperatureSymbol}</p>
                <p className="forecast-desc">{day.weather[0].description.charAt(0).toUpperCase() + day.weather[0].description.slice(1)}</p>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Bouton pour ouvrir la sidebar dans le footer */}
        <button className="sidebar-toggle-button" onClick={toggleSidebar}>
          <FaCog />
        </button>
        
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              className="sidebar"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="sidebar-header">
                <h3>Paramètres</h3>
                <button className="close-sidebar" onClick={toggleSidebar}>
                  <FaTimes />
                </button>
              </div>
              
              <div className="sidebar-content">
                {/* Barre de recherche */}
                <div className="sidebar-section">
                  <h4>Rechercher une ville</h4>
                  <form onSubmit={handleSearch}>
                    <div className="input-group">
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Nom de la ville..."
                      />
                      <button type="submit">
                        <FaSearch />
                      </button>
                    </div>
                  </form>
                </div>
                
                {/* Bouton de localisation */}
                <div className="sidebar-section">
                  <h4>Utiliser ma position</h4>
                  <button className="location-button full-width" onClick={getLocationWeather}>
                    <FaLocationArrow /> Ma position actuelle
                  </button>
                </div>
                
                {/* Switch pour changer d'unité */}
                <div className="sidebar-section">
                  <h4>Unité de température</h4>
                  <div className="unit-toggle">
                    <span className={unit === 'metric' ? 'active' : ''}>°C</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={unit === 'imperial'}
                        onChange={handleUnitToggle}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className={unit === 'imperial' ? 'active' : ''}>°F</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default WeatherWidget;


