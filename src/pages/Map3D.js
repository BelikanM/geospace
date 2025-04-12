import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  loginWithGoogle,
  getCurrentUser,
  saveUserLocation,
  saveUserNote,
  fetchAllNotes,
} from "./AppwriteConfig";
import axios from "axios";

const customIcons = {
  hospital: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  shop: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  station: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  user: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  note: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
  otherUserNote: new L.Icon({
    iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
};

function AutoCenterMap({ userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [userLocation, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function MapHospital() {
  const [locations, setLocations] = useState({
    hospitals: [],
    shops: [],
    stations: [],
  });
  const [userLocation, setUserLocation] = useState(null);
  const [directions, setDirections] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeLocationType, setActiveLocationType] = useState("hospitals");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [analytics, setAnalytics] = useState({
    averageDistance: 0,
    nearestLocation: null,
    busyAreas: [],
  });
  const [userNotes, setUserNotes] = useState([]);
  const [otherUsersNotes, setOtherUsersNotes] = useState([]);
  const [addingNote, setAddingNote] = useState(false);
  const [newNotePosition, setNewNotePosition] = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const watchPositionId = useRef(null);
  const dataUpdateInterval = useRef(null);
  const notesRefreshInterval = useRef(null);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }

      watchPositionId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);

          if (loggedInUser) {
            saveUserLocation(loggedInUser.$id, newLocation, {
              timestamp: new Date().toISOString(),
            });
          }
          if (!locations.hospitals.length) {
            fetchNearbyLocations(newLocation);
          }
          if (!dataUpdateInterval.current) {
            dataUpdateInterval.current = setInterval(() => {
              fetchNearbyLocations(newLocation);
            }, 300000);
          }
        },
        (error) => {
          console.error("Erreur lors de l'obtention de la position :", error);
          setError(
            "Impossible d'accéder à votre position. Veuillez vérifier vos paramètres de localisation."
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 10000,
        }
      );
    } else {
      setError("La géolocalisation n'est pas prise en charge par votre navigateur.");
    }
  };

  const fetchNearbyLocations = async (location) => {
    try {
      setIsLoading(true);

      const radius = 0.018;
      const bbox = [
        location.lat - radius,
        location.lng - radius,
        location.lat + radius,
        location.lng + radius,
      ].join(",");

      const hospitalsQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](${bbox});
          node["amenity"="clinic"](${bbox});
          way["amenity"="hospital"](${bbox});
          way["amenity"="clinic"](${bbox});
          relation["amenity"="hospital"](${bbox});
          relation["amenity"="clinic"](${bbox});
        );
        out body;
        >;
        out skel qt;
      `;
      const shopsQuery = `
        [out:json][timeout:25];
        (
          node["shop"](${bbox});
          way["shop"](${bbox});
          relation["shop"](${bbox});
          node["amenity"="pharmacy"](${bbox});
          way["amenity"="pharmacy"](${bbox});
          relation["amenity"="pharmacy"](${bbox});
        );
        out body;
        >;
        out skel qt;
      `;
      const stationsQuery = `
        [out:json][timeout:25];
        (
          node["public_transport"="station"](${bbox});
          node["public_transport"="stop_position"](${bbox});
          node["highway"="bus_stop"](${bbox});
          node["railway"="station"](${bbox});
          node["railway"="halt"](${bbox});
          way["public_transport"="station"](${bbox});
          way["railway"="station"](${bbox});
          relation["public_transport"="station"](${bbox});
          relation["railway"="station"](${bbox});
        );
        out body;
        >;
        out skel qt;
      `;

      const hospitalsResponse = await axios.post(
        "https://overpass-api.de/api/interpreter",
        hospitalsQuery
      );
      const shopsResponse = await axios.post(
        "https://overpass-api.de/api/interpreter",
        shopsQuery
      );
      const stationsResponse = await axios.post(
        "https://overpass-api.de/api/interpreter",
        stationsQuery
      );

      const hospitals = processOverpassNodes(hospitalsResponse.data.elements, "hospital", location);
      const shops = processOverpassNodes(shopsResponse.data.elements, "shop", location);
      const stations = processOverpassNodes(stationsResponse.data.elements, "station", location);

      const locationsData = {
        hospitals,
        shops,
        stations,
      };

      setLocations(locationsData);
      calculateAnalytics(locationsData, location);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la récupération des emplacements :", error);
      setError("Impossible de charger les emplacements à proximité.");
      setIsLoading(false);
    }
  };

  const processOverpassNodes = (elements, type, userLocation) => {
    const nodes = elements.filter(
      (element) => element.type === "node" && element.lat && element.lon && element.tags
    );

    return nodes
      .map((node, index) => {
        const distance = calculateHaversineDistance(
          userLocation.lat,
          userLocation.lng,
          node.lat,
          node.lon
        );

        const name = node.tags.name || getDefaultName(type, index);

        let details = {};

        if (type === "hospital") {
          details = {
            capacity: node.tags.beds || "Non spécifié",
            occupancyRate: node.tags.occupancy_rate || "Non spécifié",
            specialties: node.tags.healthcare ? [node.tags.healthcare] : ["Général"],
            phone: node.tags.phone || node.tags["contact:phone"] || "Non spécifié",
            website: node.tags.website || node.tags["contact:website"] || "Non spécifié",
          };
        } else if (type === "shop") {
          details = {
            category: node.tags.shop || node.tags.amenity || "Boutique",
            openHours: node.tags.opening_hours || "Non spécifié",
            phone: node.tags.phone || node.tags["contact:phone"] || "Non spécifié",
          };
        } else if (type === "station") {
          const network = node.tags.network || "";
          const ref = node.tags.ref || "";
          const routes = node.tags.route || node.tags.routes || "";
          const lines = [];

          if (network && ref) lines.push(`${network} ${ref}`);
          if (routes) lines.push(routes);

          details = {
            type: node.tags.public_transport || node.tags.railway || node.tags.highway || "Station",
            lines: lines.length ? lines : ["Non spécifié"],
            operator: node.tags.operator || "Non spécifié",
            frequency: node.tags.interval || "Non spécifié",
          };
        }

        const neighborhood =
          node.tags.suburb || node.tags.district || node.tags.neighborhood || "Non spécifié";

        return {
          id: node.id.toString(),
          name: name,
          latitude: node.lat,
          longitude: node.lon,
          distance: distance,
          type: type,
          neighborhood: neighborhood,
          details: details,
        };
      })
      .filter((node) => node.name !== "");
  };

  const getDefaultName = (type, index) => {
    switch (type) {
      case "hospital":
        return `Centre Médical ${index + 1}`;
      case "shop":
        return `Commerce ${index + 1}`;
      case "station":
        return `Station ${index + 1}`;
      default:
        return `Point d'intérêt ${index + 1}`;
    }
  };

  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateAnalytics = (locationsData, userLocation) => {
    const allLocations = [
      ...locationsData.hospitals,
      ...locationsData.shops,
      ...locationsData.stations,
    ];

    let nearestLocation = null;
    let minDistance = Infinity;

    allLocations.forEach((location) => {
      const distance = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        location.latitude,
        location.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = location;
      }
    });

    const totalDistance = allLocations.reduce((sum, location) => {
      return (
        sum +
        calculateHaversineDistance(
          userLocation.lat,
          userLocation.lng,
          location.latitude,
          location.longitude
        )
      );
    }, 0);

    const averageDistance =
      allLocations.length > 0 ? totalDistance / allLocations.length : 0;

    const neighborhoodCount = {};
    allLocations.forEach((location) => {
      if (location.neighborhood) {
        neighborhoodCount[location.neighborhood] =
          (neighborhoodCount[location.neighborhood] || 0) + 1;
      }
    });

    const busyAreas = Object.entries(neighborhoodCount)
      .filter(([_, count]) => count >= 2)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    setAnalytics({
      averageDistance: averageDistance.toFixed(2),
      nearestLocation,
      busyAreas,
    });
  };

  const calculateDirections = async (location) => {
    try {
      setSelectedLocation(location);
      setIsLoading(true);

      const response = await axios.get(
        `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${location.longitude},${location.latitude}?overview=full&geometries=geojson`
      );

      if (response.data.code !== "Ok") {
        throw new Error("Failed to get directions");
      }

      const routeCoords = response.data.routes[0].geometry.coordinates.map(
        ([lng, lat]) => ({ lat, lng })
      );

      setDirections(routeCoords);

      const distance = response.data.routes[0].distance / 1000;
      const duration = response.data.routes[0].duration / 60;

      setDistanceToDestination(`${distance.toFixed(2)} km`);
      setEstimatedTime(`${Math.round(duration)} minutes`);

      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors du calcul des directions : ", error);

      if (userLocation && location) {
        const directLine = [
          { lat: userLocation.lat, lng: userLocation.lng },
          { lat: location.latitude, lng: location.longitude },
        ];
        setDirections(directLine);

        const approxDistance = calculateHaversineDistance(
          userLocation.lat,
          userLocation.lng,
          location.latitude,
          location.longitude
        );

        setDistanceToDestination(`${approxDistance.toFixed(2)} km (approximatif)`);
        setEstimatedTime(`${Math.floor(approxDistance * 12)} min (approximatif)`);
      }

      setError(
        "Les détails précis de l'itinéraire ne sont pas disponibles. Affichage d'une ligne directe approximative."
      );
      setIsLoading(false);
    }
  };

  const handleMapClick = (latlng) => {
    if (addingNote) {
      setNewNotePosition(latlng);
    }
  };

  const loadAllNotes = async () => {
    try {
      const allNotes = await fetchAllNotes();

      if (loggedInUser) {
        const currentUserNotes = allNotes.filter(
          (note) => note.userId === loggedInUser.$id
        );
        const notes = allNotes.filter(
          (note) => note.userId !== loggedInUser.$id
        );

        setUserNotes(currentUserNotes);
        setOtherUsersNotes(notes);
      } else {
        setOtherUsersNotes(allNotes);
        setUserNotes([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des notes:", error);
      setError("Impossible de charger les notes. Veuillez réessayer plus tard.");
    }
  };

  const addNote = async () => {
    if (!newNotePosition || !newNoteTitle) {
      setError("Veuillez ajouter un titre et sélectionner un emplacement pour votre note.");
      return;
    }

    if (!loggedInUser) {
      setError("Veuillez vous connecter pour ajouter une note.");
      return;
    }

    try {
      setIsLoading(true);

      const newNote = {
        title: newNoteTitle,
        text: newNoteText,
        latitude: newNotePosition.lat,
        longitude: newNotePosition.lng,
        timestamp: new Date().toISOString(),
        userId: loggedInUser.$id,
        userName: loggedInUser.name || loggedInUser.email,
      };

      const savedNote = await saveUserNote(newNote);

      setUserNotes((prevNotes) => [
        ...prevNotes,
        {
          ...newNote,
          id: savedNote.$id,
        },
      ]);

      setNewNoteTitle("");
      setNewNoteText("");
      setNewNotePosition(null);
      setAddingNote(false);

      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de l'ajout de la note:", error);
      setError("Impossible d'enregistrer la note. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      const user = await getCurrentUser();
      setLoggedInUser(user);

      await loadAllNotes();

      if (userLocation) {
        saveUserLocation(user.$id, userLocation, {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Erreur lors de la connexion Google : ", error);
      setError("Échec de la connexion avec Google. Veuillez réessayer.");
    }
  };

  const handleLocationTypeChange = (type) => {
    setActiveLocationType(type);
    setDirections([]);
    setSelectedLocation(null);
    setDistanceToDestination(null);
    setEstimatedTime(null);
  };

  const toggleAddingNote = () => {
    if (!loggedInUser) {
      setError("Veuillez vous connecter pour ajouter des notes.");
      return;
    }
    setAddingNote(!addingNote);
    if (!addingNote) {
      setError("Cliquez sur la carte pour marquer l'emplacement de votre note.");
    } else {
      setNewNotePosition(null);
      setNewNoteTitle("");
      setNewNoteText("");
    }
  };

  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setLoggedInUser(user);
        }
      } catch (error) {
        console.log("No user currently logged in");
      }
    };

    checkCurrentUser();
    getUserLocation();
    loadAllNotes();

    notesRefreshInterval.current = setInterval(() => {
      loadAllNotes();
    }, 60000);

    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }

      if (dataUpdateInterval.current) {
        clearInterval(dataUpdateInterval.current);
      }

      if (notesRefreshInterval.current) {
        clearInterval(notesRefreshInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loggedInUser) {
      loadAllNotes();
    }
  }, [loggedInUser]);

  useEffect(() => {
    const savedNotes = JSON.parse(localStorage.getItem("userNotes"));
    if (savedNotes) {
      setUserNotes(savedNotes);
    }
  }, []);

  const sortedLocations = locations[activeLocationType]
    ? [...locations[activeLocationType]].sort((a, b) => a.distance - b.distance)
    : [];

  return (
    <div className="map-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Fermer</button>
        </div>
      )}

      <div className="map-controls">
        {!loggedInUser ? (
          <button onClick={handleGoogleLogin} className="login-button">
            Se connecter avec Google
          </button>
        ) : (
          <div className="user-info">Connecté: {loggedInUser.name || loggedInUser.email}</div>
        )}

        <div className="location-type-selector">
          <button
            className={activeLocationType === "hospitals" ? "active" : ""}
            onClick={() => handleLocationTypeChange("hospitals")}
          >
            Hôpitaux
          </button>
          <button
            className={activeLocationType === "shops" ? "active" : ""}
            onClick={() => handleLocationTypeChange("shops")}
          >
            Boutiques
          </button>
          <button
            className={activeLocationType === "stations" ? "active" : ""}
            onClick={() => handleLocationTypeChange("stations")}
          >
            Stations
          </button>
        </div>

        <button
          className={`note-button ${addingNote ? "active" : ""}`}
          onClick={toggleAddingNote}
        >
          {addingNote ? "Cancel Note" : "Add Note"}
        </button>

        <div className="data-refresh-info">
          <div>Mise à jour des données: toutes les 5 minutes</div>
          <div>Mise à jour des notes: toutes les minutes</div>
        </div>
      </div>

      {isLoading && <div className="loading-indicator">Chargement...</div>}

      <div className="map-analytics-container">
        <div className="map-area">
          {userLocation ? (
            <MapContainer
              center={[userLocation.lat, userLocation.lng]}
              zoom={14}
              style={{ height: "500px", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <AutoCenterMap userLocation={userLocation} />
              <MapClickHandler onMapClick={handleMapClick} />

              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={customIcons.user}
              >
                <Popup>
                  <strong>Votre position actuelle</strong>
                  <br />
                  {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  {analytics.nearestLocation && (
                    <div className="nearest-location">
                      Point d'intérêt le plus proche: {analytics.nearestLocation.name} (
                      {analytics.nearestLocation.distance.toFixed(2)} km)
                    </div>
                  )}
                </Popup>
              </Marker>

              {sortedLocations.map((location) => (
                <Marker
                  key={location.id}
                  position={[location.latitude, location.longitude]}
                  icon={customIcons[location.type]}
                  eventHandlers={{
                    click: () => calculateDirections(location),
                  }}
                >
                  <Popup>
                    <div className="location-popup">
                      <h3>{location.name}</h3>
                      <p>Quartier: {location.neighborhood}</p>
                      <p>Distance: {location.distance.toFixed(2)} km</p>

                      {location.type === "hospital" && (
                        <div>
                          <p>Capacité: {location.details.capacity}</p>
                          <p>Taux d'occupation: {location.details.occupancyRate}</p>
                          <p>Spécialités: {location.details.specialties.join(", ")}</p>
                          {location.details.phone && <p>Téléphone: {location.details.phone}</p>}
                          {location.details.website && (
                            <p>
                              Site Web:{" "}
                              <a
                                href={location.details.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Visiter
                              </a>
                            </p>
                          )}
                        </div>
                      )}

                      {location.type === "shop" && (
                        <div>
                          <p>Catégorie: {location.details.category}</p>
                          <p>Heures d'ouverture: {location.details.openHours}</p>
                          {location.details.phone && <p>Téléphone: {location.details.phone}</p>}
                        </div>
                      )}

                      {location.type === "station" && (
                        <div>
                          <p>Type: {location.details.type}</p>
                          <p>Lignes: {location.details.lines.join(", ")}</p>
                          <p>Opérateur: {location.details.operator}</p>
                          {location.details.frequency !== "Non spécifié" && (
                            <p>Fréquence: {location.details.frequency}</p>
                          )}
                        </div>
                      )}

                      <button onClick={() => calculateDirections(location)}>
                        Obtenir l'itinéraire
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {userNotes.map((note) => (
                <Marker
                  key={note.id}
                  position={[note.latitude, note.longitude]}
                  icon={customIcons.note}
                >
                  <Popup>
                    <div className="note-popup">
                      <h3>{note.title}</h3>
                      <p>{note.text}</p>
                      <p className="note-date">
                        Ajouté le: {new Date(note.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {otherUsersNotes.map((note) => (
                <Marker
                  key={note.id}
                  position={[note.latitude, note.longitude]}
                  icon={customIcons.otherUserNote}
                >
                  <Popup>
                    <div className="other-note-popup">
                      <h3>{note.title}</h3>
                      <p>{note.text}</p>
                      <p className="note-author">
                        Par: {note.userName || "Utilisateur anonyme"}
                      </p>
                      <p className="note-date">
                        Ajouté le: {new Date(note.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {newNotePosition && (
                <Marker
                  position={[newNotePosition.lat, newNotePosition.lng]}
                  icon={customIcons.note}
                >
                  <Popup>
                    <div className="new-note-popup">
                      <h3>Nouvel emplacement de note</h3>
                      <p>Complétez le formulaire ci-dessous pour ajouter votre note.</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {directions.length > 0 && (
                <Polyline
                  positions={directions.map((point) => [point.lat, point.lng])}
                  color="blue"
                  weight={5}
                  opacity={0.7}
                  dashArray="10, 10"
                />
              )}
            </MapContainer>
          ) : (
            <div className="location-prompt">
              Veuillez autoriser l'accès à votre position pour afficher la carte.
              <button onClick={getUserLocation}>Activer la localisation</button>
            </div>
          )}
        </div>

        <div className="analytics-panel">
          <h3>Analyse des données</h3>

          <div className="analytics-item">
            <strong>Distance moyenne:</strong> {analytics.averageDistance} km
          </div>

          {analytics.nearestLocation && (
            <div className="analytics-item">
              <strong>Point d'intérêt le plus proche:</strong>
              <div>{analytics.nearestLocation.name}</div>
              <div>Type: {analytics.nearestLocation.type}</div>
              <div>Distance: {analytics.nearestLocation.distance.toFixed(2)} km</div>
            </div>
          )}

          <div className="analytics-item">
            <strong>Zones les plus fréquentées:</strong>
            {analytics.busyAreas.length > 0 ? (
              <ul className="busy-areas-list">
                {analytics.busyAreas.map((area, index) => (
                  <li key={index}>
                    {area.name} ({area.count} points d'intérêt)
                  </li>
                ))}
              </ul>
            ) : (
              <div>Aucune zone fréquentée détectée</div>
            )}
          </div>

          <div className="analytics-item">
            <strong>Statistiques {activeLocationType}:</strong>
            <div className="stats-item">
              Nombre total: {locations[activeLocationType]?.length || 0}
            </div>
            <div className="stats-item">
              Distance moyenne:{" "}
              {locations[activeLocationType]?.length
                ? (
                    locations[activeLocationType].reduce(
                      (sum, loc) => sum + loc.distance,
                      0
                    ) / locations[activeLocationType].length
                  ).toFixed(2)
                : 0}{" "}
              km
            </div>
          </div>

          <div className="analytics-item">
            <strong>Notes sur la carte:</strong>
            <div className="stats-item">Mes notes: {userNotes.length}</div>
            <div className="stats-item">
              Autres utilisateurs: {otherUsersNotes.length}
            </div>
          </div>
        </div>
      </div>

      {addingNote && newNotePosition && (
        <div className="note-form">
          <h3>Ajouter une note</h3>
          <p>
            Position: {newNotePosition.lat.toFixed(6)},{" "}
            {newNotePosition.lng.toFixed(6)}
          </p>

          <div className="form-group">
            <label>Titre:</label>
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Titre de votre note"
            />
          </div>

          <div className="form-group">
            <label>Description:</label>
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Détails de votre note (optionnel)"
              rows={4}
            />
          </div>

          <div className="form-buttons">
            <button onClick={addNote} disabled={isLoading}>
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              onClick={() => {
                setNewNotePosition(null);
                setNewNoteTitle("");
                setNewNoteText("");
                setAddingNote(false);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {selectedLocation && (
        <div className="selected-location-info">
          <div className="location-header">
            <h3>{selectedLocation.name}</h3>
            <button
              onClick={() => {
                setSelectedLocation(null);
                setDirections([]);
                setDistanceToDestination(null);
                setEstimatedTime(null);
              }}
            >
              Fermer
            </button>
          </div>

          <div className="location-details">
            <div className="location-column">
              <p>
                <strong>Type:</strong>{" "}
                {selectedLocation.type.charAt(0).toUpperCase() +
                  selectedLocation.type.slice(1)}
              </p>
              <p>
                <strong>Quartier:</strong> {selectedLocation.neighborhood}
              </p>

              {selectedLocation.type === "hospital" && (
                <>
                  <p>
                    <strong>Capacité:</strong> {selectedLocation.details.capacity}
                  </p>
                  <p>
                    <strong>Taux d'occupation:</strong>{" "}
                    {selectedLocation.details.occupancyRate}
                  </p>
                  <p>
                    <strong>Spécialités:</strong>{" "}
                    {selectedLocation.details.specialties.join(", ")}
                  </p>
                  {selectedLocation.details.phone && (
                    <p>
                      <strong>Téléphone:</strong> {selectedLocation.details.phone}
                    </p>
                  )}
                  {selectedLocation.details.website && (
                    <p>
                      <strong>Site Web:</strong>{" "}
                      <a
                        href={selectedLocation.details.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visiter
                      </a>
                    </p>
                  )}
                </>
              )}

              {selectedLocation.type === "shop" && (
                <>
                  <p>
                    <strong>Catégorie:</strong> {selectedLocation.details.category}
                  </p>
                  <p>
                    <strong>Heures d'ouverture:</strong>{" "}
                    {selectedLocation.details.openHours}
                  </p>
                  {selectedLocation.details.phone && (
                    <p>
                      <strong>Téléphone:</strong> {selectedLocation.details.phone}
                    </p>
                  )}
                </>
              )}

              {selectedLocation.type === "station" && (
                <>
                  <p>
                    <strong>Type:</strong> {selectedLocation.details.type}
                  </p>
                  <p>
                    <strong>Lignes:</strong>{" "}
                    {selectedLocation.details.lines.join(", ")}
                  </p>
                  <p>
                    <strong>Opérateur:</strong> {selectedLocation.details.operator}
                  </p>
                  {selectedLocation.details.frequency !== "Non spécifié" && (
                    <p>
                      <strong>Fréquence:</strong>{" "}
                      {selectedLocation.details.frequency}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="location-column">
              <p>
                <strong>Distance:</strong>{" "}
                {distanceToDestination || `${selectedLocation.distance.toFixed(2)} km`}
              </p>
              {estimatedTime && <p><strong>Temps estimé:</strong> {estimatedTime}</p>}
              <p><strong>Coordonnées:</strong><br/>{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</p>
            </div>
          </div>

          {directions.length > 0 && (
            <div className="route-info">
              <p><strong>Itinéraire calculé</strong> ({directions.length} points de passage)</p>
              {distanceToDestination && <p>Distance totale: {distanceToDestination}</p>}
              {estimatedTime && <p>Temps de trajet: {estimatedTime}</p>}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .map-container {
          position: relative;
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          background-color: #f9f9f9;
          padding: 10px;
        }
        
        .error-message {
          background-color: #ff5252;
          color: white;
          padding: 10px;
          margin-bottom: 10px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .error-message button {
          background: transparent;
          border: 1px solid white;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .map-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .location-type-selector {
          display: flex;
          gap: 5px;
        }
        
        .location-type-selector button {
          padding: 8px 12px;
          border: none;
          background-color: #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }
        
        .location-type-selector button.active {
          background-color: #2196f3;
          color: white;
        }
        
        .login-button {
          padding: 8px 16px;
          background-color: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .note-button {
          padding: 8px 16px;
          background-color: #6a1b9a;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .note-button.active {
          background-color: #4a148c;
        }

        .data-refresh-info {
          font-size: 12px;
          color: #666;
          background-color: #e8f5e9;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .loading-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          z-index: 1000;
        }
        
        .map-analytics-container {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }
        
        .map-area {
          flex: 3;
          min-width: 300px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .analytics-panel {
          flex: 1;
          min-width: 250px;
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .analytics-panel h3 {
          margin: 0 0 15px 0;
          padding-bottom: 10px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .analytics-item {
          margin-bottom: 15px;
        }
        
        .busy-areas-list {
          margin: 5px 0;
          padding-left: 20px;
        }

        .location-popup {
          min-width: 200px;
        }
        
        .location-popup h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
        }
        
        .location-popup button {
          margin-top: 10px;
          padding: 5px 10px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
        }

        .note-popup h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #6a1b9a;
        }

        .note-author {
          font-size: 12px;
          color: #8e8e8e;
        }

        .note-date {
          font-size: 12px;
          color: #888;
        }

        .new-note-popup h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #6a1b9a;
        }
        
        .selected-location-info {
          margin-top: 15px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .location-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .location-header h3 {
          margin: 0;
          font-size: 18px;
          color: #333;
        }
        
        .location-header button {
          padding: 5px 10px;
          background-color: #e0e0e0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .location-details {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .location-column {
          flex: 1;
          min-width: 250px;
        }
        
        .location-column p {
          margin: 8px 0;
        }
        
        .route-info {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e0e0e0;
        }
        
        .user-info {
          padding: 8px;
          background-color: #e8f5e9;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .nearest-location {
          margin-top: 8px;
          font-size: 12px;
          background-color: rgba(76, 175, 80, 0.1);
          padding: 4px;
          border-radius: 4px;
          border-left: 3px solid #4caf50;
        }

        .note-form {
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 15px;
        }

        .note-form h3 {
          margin-top: 0;
        }

        .form-group {
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 5px;
          font-weight: bold;
        }

        .form-group input, 
        .form-group textarea {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
          width: 100%;
          font-size: 14px;
        }

        .form-buttons {
          display: flex;
          gap: 5px;
        }

        .form-buttons button {
          padding: 8px 12px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default MapHospital;

