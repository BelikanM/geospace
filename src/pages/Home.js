import React, { useState } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const features = [
  {
    title: "Cartographie Interactive",
    description: "Visualisez des données géospatiales en temps réel avec des couches superposables (routières, cadastrales, environnementales).",
    icon: "map",
    color: "#3b82f6"
  },
  {
    title: "Analyse SIG Avancée",
    description: "Analysez les données spatiales pour la planification, la gestion foncière et le suivi environnemental.",
    icon: "analysis",
    color: "#8b5cf6"
  },
  {
    title: "Géolocalisation Précise",
    description: "Trouvez facilement des points d'intérêt, propriétés ou zones via une recherche intelligente.",
    icon: "location",
    color: "#ef4444"
  },
  {
    title: "Rapports Automatisés",
    description: "Générez des rapports personnalisés à partir de données SIG et exportez-les en PDF.",
    icon: "report",
    color: "#10b981"
  },
  {
    title: "Synchronisation Temps Réel",
    description: "Les données sont mises à jour en temps réel pour une collaboration efficace entre services.",
    icon: "sync",
    color: "#f59e0b"
  },
];

const SmartDescription = () => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const settings = {
    dots: true,
    infinite: true,
    speed: 700,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    centerMode: true,
    centerPadding: '0',
    focusOnSelect: true,
    arrows: false, // Retirer les flèches
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          centerMode: true,
        }
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          centerMode: true,
        }
      }
    ]
  };

  // Icônes plus réalistes et colorées
  const renderIcon = (iconName) => {
    switch(iconName) {
      case 'map':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="32" r="30" fill="#e6f5ff" />
            <path d="M52 16v32L37 58l-10-3.33L12 58V26l15-10 10 3.33L52 16z" fill="#fff" />
            <path d="M52 16L37 26v32l15-10V16z" fill="#59d8ff" />
            <path d="M37 26L27 22.67V54.67L37 58V26z" fill="#46b1e3" />
            <path d="M27 22.67L12 26v32l15-3.33V22.67z" fill="#b3ddf5" />
            <path d="M44 26a4 4 0 110 8 4 4 0 010-8z" fill="#ff5a5a" />
            <path d="M44 28a2 2 0 110 4 2 2 0 010-4z" fill="#fff" />
            <path d="M22 36a6 6 0 110 12 6 6 0 010-12z" fill="#7ed321" />
            <path d="M22 39a3 3 0 110 6 3 3 0 010-6z" fill="#fff" />
            <path d="M32 34a5 5 0 110 10 5 5 0 010-10z" fill="#ffd500" />
            <path d="M32 37a2 2 0 110 4 2 2 0 010-4z" fill="#fff" />
          </svg>
        );
      case 'analysis':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="32" r="30" fill="#f0f5ff" />
            <path d="M10 44h8v10h-8z" fill="#4285f4" />
            <path d="M22 38h8v16h-8z" fill="#34a853" />
            <path d="M34 32h8v22h-8z" fill="#fbbc05" />
            <path d="M46 24h8v30h-8z" fill="#ea4335" />
            <path d="M8 14l48 4" stroke="#555" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M14 13l-2 10M26 14l-1 8M38 16l2 6M50 18l4 3" stroke="#555" strokeWidth="1" fill="none" />
            <circle cx="14" cy="13" r="3" fill="#4285f4" />
            <circle cx="26" cy="14" r="3" fill="#34a853" />
            <circle cx="38" cy="16" r="3" fill="#fbbc05" />
            <circle cx="50" cy="18" r="3" fill="#ea4335" />
          </svg>
        );
      case 'location':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="32" r="30" fill="#fff6f6" />
            <path d="M32 10c-8.8 0-16 7.2-16 16 0 10 12 26 16 26s16-16 16-26c0-8.8-7.2-16-16-16z" fill="#ff5a5a" />
            <circle cx="32" cy="26" r="7" fill="#fff" />
            <path d="M38 42h16v12H10V42h16" stroke="#555" strokeWidth="2" fill="#eee" />
            <path d="M26 48h12M20 54h24" stroke="#555" strokeWidth="1.5" fill="none" />
          </svg>
        );
      case 'report':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="32" r="30" fill="#f1fbf7" />
            <path d="M18 8h28a2 2 0 012 2v44a2 2 0 01-2 2H18a2 2 0 01-2-2V10a2 2 0 012-2z" fill="#fff" stroke="#10b981" strokeWidth="2" />
            <path d="M22 16h20M22 24h20M22 32h12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            <path d="M22 44h9v-9h9v9h-9z" fill="#10b981" />
            <path d="M35 51c-3-6 4-6 1-12" stroke="#10b981" strokeWidth="2" fill="none" />
          </svg>
        );
      case 'sync':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <circle cx="32" cy="32" r="30" fill="#fffbf0" />
            <path d="M32 20v-8" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            <path d="M32 52v-8" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            <path d="M20 32h-8" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            <path d="M52 32h-8" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            <circle cx="32" cy="32" r="16" fill="none" stroke="#f59e0b" strokeWidth="3" />
            <path d="M24 32c0-4.4 3.6-8 8-8" stroke="#235789" strokeWidth="3" fill="none" />
            <path d="M40 32c0 4.4-3.6 8-8 8" stroke="#235789" strokeWidth="3" fill="none" />
            <path d="M23 25l-4-4M41 39l4 4" stroke="#235789" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-black text-white py-16 px-4 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-center bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          Fonctionnalités de l'application intelligente
        </h2>
        
        <div className="relative">
          <Slider {...settings}>
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="px-3"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className={`transition-all duration-300 transform ${hoveredIndex === index ? 'scale-105 -translate-y-2' : ''}`}>
                  <div className="bg-gray-900 rounded-xl p-6 h-72 flex flex-col items-center justify-between shadow-lg">
                    <div className="w-32 h-32 mb-4 overflow-hidden" style={{filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))"}}>
                      {renderIcon(feature.icon)}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2 text-center" style={{color: feature.color}}>
                      {feature.title}
                    </h3>
                    
                    <p className="text-gray-300 text-sm text-center opacity-80 line-clamp-3 hover:line-clamp-none">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </div>
  );
};

export default SmartDescription;

