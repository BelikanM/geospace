import React from 'react';
import './SplashScreen.css';
import logo from '2vG5dDYUgcQniUudazAdMPJvMlW.svg';

function SplashScreen() {
  return (
    <div className="splash-screen">
      <img src={logo} alt="Logo" className="logo" />
    </div>
  );
}

export default SplashScreen;
