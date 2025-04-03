import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import NavBar from './components/NavBar';
import GEOSPACE from './pages/GEOSPACE';
import CARTOGRAPHIE from './pages/CARTOGRAPHIE';
import METEO from './pages/METEO';
import CHAT from './pages/CHAT';
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
            <Route path="/geospace" component={GEOSPACE} />
            <Route path="/cartographie" component={CARTOGRAPHIE} />
            <Route path="/meteo" component={METEO} />
            <Route path="/chat" component={CHAT} />
            <Route path="/404" component={NotFound} />
            <Redirect to="/404" />
          </Switch>
        </div>
      </div>
    </Router>
  );
}

export default App;

