import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="page not-found-page">
      <h1>404 - Page non trouvée</h1>
      <p>La page que vous recherchez n'existe pas.</p>
      <Link to="/" className="btn btn-primary">
        Retour à l'accueil
      </Link>
    </div>
  );
};

export default NotFound;

