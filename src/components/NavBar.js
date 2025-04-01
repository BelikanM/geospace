import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaEnvelope, FaComments, FaBars, FaTimes } from 'react-icons/fa';
import { BiWorld } from 'react-icons/bi'; // Icône pour GeoSpace
import './NavBar.css';

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Effet pour gérer le changement d'apparence au scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Toggle le menu mobile
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-text">MonApp</span>
        </Link>

        {/* Hamburger Icon */}
        <div className="menu-icon" onClick={toggleMenu}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </div>

        {/* Navigation Links */}
        <ul className={`nav-menu ${isOpen ? 'active' : ''}`}>
          <li className="nav-item">
            <Link to="/geospace" className="nav-link" onClick={() => setIsOpen(false)}>
              <BiWorld className="nav-icon" />
              <span className="nav-text">GeoSpace</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/recherche" className="nav-link" onClick={() => setIsOpen(false)}>
              <FaSearch className="nav-icon" />
              <span className="nav-text">Recherche</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/contact" className="nav-link" onClick={() => setIsOpen(false)}>
              <FaEnvelope className="nav-icon" />
              <span className="nav-text">Contact</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/chat" className="nav-link" onClick={() => setIsOpen(false)}>
              <FaComments className="nav-icon" />
              <span className="nav-text">Chat</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default NavBar;

