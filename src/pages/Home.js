import React from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const features = [
  {
    title: "Cartographie Interactive",
    description: "Visualisez des données géospatiales en temps réel avec des couches superposables (routières, cadastrales, environnementales).",
    image: "./pexels-media-185933.jpeg",
  },
  {
    title: "Analyse SIG Avancée",
    description: "Analysez les données spatiales pour la planification, la gestion foncière et le suivi environnemental.",
    image: "./pexels-media-28682355.jpeg",
  },
  {
    title: "Géolocalisation Précise",
    description: "Trouvez facilement des points d’intérêt, propriétés ou zones via une recherche intelligente.",
    image: "./pexels-media-9795002.jpeg",
  },
  {
    title: "Rapports Automatisés",
    description: "Générez des rapports personnalisés à partir de données SIG et exportez-les en PDF.",
    image: "./pexels-media-186461.jpeg",
  },
  {
    title: "Synchronisation Temps Réel",
    description: "Les données sont mises à jour en temps réel pour une collaboration efficace entre services.",
    image: "./pexels-media-572056.jpeg",
  },
];

const SmartDescription = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-xl rounded-2xl mt-10">
      <h2 className="text-3xl font-bold text-center mb-6 text-green-700">
        Fonctionnalités de l'application intelligente
      </h2>
      <Slider {...settings}>
        {features.map((feature, index) => (
          <div key={index} className="p-4">
            <img
              src={feature.image}
              alt={feature.title}
              className="w-full h-64 object-cover rounded-xl shadow-md mb-4"
            />
            <h3 className="text-xl font-semibold text-gray-800">{feature.title}</h3>
            <p className="text-gray-600">{feature.description}</p>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default SmartDescription;
