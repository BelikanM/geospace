import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import NavBar from './components/NavBar';
import GeoSpace from './pages/GeoSpace';
import Recherche from './pages/Recherche';
import Contact from './pages/Contact';
import Chat from './pages/Chat';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />
        <div className="content">
          <Switch>
            <Route exact path="/" component={Home} />
            <Route path="/geospace" component={GeoSpace} />
            <Route path="/recherche" component={Recherche} />
            <Route path="/contact" component={Contact} />
            <Route path="/chat" component={Chat} />
            <Route path="/404" component={NotFound} />
            <Redirect to="/404" />
          </Switch>
        </div>
      </div>
    </Router>
  );
}

export default App;

