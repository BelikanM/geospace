import React from 'react';
import './SplashScreen.css';
import logo from './Black & Blue Minimalist Modern I.png';

function SplashScreen() {
  return (
    <div className="splash-screen">
      <img src={logo} alt="Logo" className="logo" />
    </div>
  );
}

export default SplashScreen;
