import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './Person.css';

const Person = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState('');
    const analyzeIntervalRef = useRef(null);

    // Fonction pour obtenir la liste des caméras disponibles
    const getCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            setAvailableCameras(cameras);
            
            // Sélectionner la caméra arrière par défaut si disponible
            const rearCamera = cameras.find(camera => 
                camera.label.toLowerCase().includes('back') || 
                camera.label.toLowerCase().includes('arrière') ||
                camera.label.toLowerCase().includes('rear')
            );
            
            if (rearCamera) {
                setSelectedCamera(rearCamera.deviceId);
            } else if (cameras.length > 0) {
                setSelectedCamera(cameras[0].deviceId);
            }
        } catch (err) {
            setError("Impossible d'accéder aux caméras: " + err.message);
        }
    };

    // Charger la liste des caméras au montage du composant
    useEffect(() => {
        getCameras();
    }, []);

    // Activer/désactiver la caméra
    const toggleCamera = async () => {
        if (cameraActive) {
            // Arrêter la caméra
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
            setCameraActive(false);
            
            // Arrêter l'analyse automatique
            if (analyzeIntervalRef.current) {
                clearInterval(analyzeIntervalRef.current);
                analyzeIntervalRef.current = null;
            }
        } else {
            try {
                // Démarrer la caméra
                const constraints = {
                    video: {
                        deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setCameraActive(true);
                    
                    // Démarrer l'analyse automatique toutes les 2 secondes
                    analyzeIntervalRef.current = setInterval(() => {
                        captureAndAnalyze();
                    }, 2000);
                }
            } catch (err) {
                setError("Erreur d'accès à la caméra: " + err.message);
            }
        }
    };

    // Changer de caméra
    const handleCameraChange = (e) => {
        const newCameraId = e.target.value;
        setSelectedCamera(newCameraId);
        
        // Si la caméra est déjà active, la redémarrer avec la nouvelle sélection
        if (cameraActive) {
            toggleCamera().then(() => toggleCamera());
        }
    };

    // Capturer une image et l'envoyer pour analyse
    const captureAndAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current || !cameraActive) return;
        
        try {
            setAnalyzing(true);
            
            // Capturer l'image de la vidéo
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convertir l'image en base64
            const imageData = canvas.toDataURL('image/jpeg');
            
            // Envoyer l'image à l'API pour analyse
            const response = await axios.post('http://localhost:5007/analyze', {
                image: imageData
            });
            
            // Mettre à jour les résultats
            setResults(response.data);
            
            // Dessiner les boîtes englobantes et les informations sur le canvas
            drawResultsOnCanvas(response.data);
            
        } catch (err) {
            setError("Erreur d'analyse: " + err.message);
        } finally {
            setAnalyzing(false);
        }
    };

    // Dessiner les résultats sur le canvas
    const drawResultsOnCanvas = (data) => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Effacer le canvas précédent
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Redessiner l'image vidéo
        if (videoRef.current) {
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        }
        
        // Dessiner les boîtes englobantes pour chaque personne
        data.people.forEach(person => {
            const { x, y, width, height } = person.position;
            
            // Couleur en fonction de la posture
            let color;
            switch(person.posture) {
                case 'debout': color = 'rgba(0, 255, 0, 0.5)'; break;
                case 'assis': color = 'rgba(255, 255, 0, 0.5)'; break;
                case 'courbé': color = 'rgba(255, 0, 0, 0.5)'; break;
                default: color = 'rgba(0, 0, 255, 0.5)';
            }
            
            // Dessiner la boîte englobante
            context.strokeStyle = color;
            context.lineWidth = 3;
            context.strokeRect(x, y, width, height);
            
            // Ajouter une étiquette avec la posture
            context.fillStyle = color;
            context.fillRect(x, y - 25, 120, 25);
            context.fillStyle = 'white';
            context.font = '16px Arial';
            context.fillText(`${person.posture} (${Math.round(person.confidence * 100)}%)`, x + 5, y - 5);
        });
    };

    // Nettoyer les ressources lors du démontage du composant
    useEffect(() => {
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            
            if (analyzeIntervalRef.current) {
                clearInterval(analyzeIntervalRef.current);
            }
        };
    }, []);

    return (
        <div className="person-analyzer">
            <h1>Analyse de Posture en Temps Réel</h1>
            
            {error && (
                <div className="error-message">
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Fermer</button>
                </div>
            )}
            
            <div className="camera-controls">
                <select 
                    value={selectedCamera} 
                    onChange={handleCameraChange}
                    disabled={cameraActive}
                >
                    {availableCameras.map(camera => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                            {camera.label || `Caméra ${camera.deviceId.substr(0, 5)}...`}
                        </option>
                    ))}
                </select>
                
                <button 
                    onClick={toggleCamera}
                    className={cameraActive ? "stop-btn" : "start-btn"}
                >
                    {cameraActive ? "Arrêter la Caméra" : "Démarrer la Caméra"}
                </button>
                
                {cameraActive && (
                    <button 
                        onClick={captureAndAnalyze}
                        disabled={analyzing}
                        className="analyze-btn"
                    >
                        {analyzing ? "Analyse en cours..." : "Analyser Maintenant"}
                    </button>
                )}
            </div>
            
            <div className="video-container">
                <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ display: 'none' }}
                    onLoadedMetadata={() => {
                        if (canvasRef.current) {
                            canvasRef.current.width = videoRef.current.videoWidth;
                            canvasRef.current.height = videoRef.current.videoHeight;
                        }
                    }}
                />
                <canvas 
                    ref={canvasRef}
                    className="video-canvas"
                />
            </div>
            
            {results && (
                <div className="results-container">
                    <h2>Résultats de l'Analyse</h2>
                    
                    <div className="summary">
                        <div className="total-count">
                            <h3>Nombre Total de Personnes</h3>
                            <div className="count-value">{results.total_people}</div>
                        </div>
                        
                        <div className="posture-summary">
                            <h3>Résumé des Postures</h3>
                            <div className="posture-grid">
                                {Object.entries(results.posture_summary || {}).map(([posture, count]) => (
                                    <div key={posture} className={`posture-item ${posture}`}>
                                        <div className="posture-label">{posture}</div>
                                        <div className="posture-count">{count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="people-details">
                        <h3>Détails des Personnes Détectées</h3>
                        <div className="people-list">
                            {results.people.map(person => (
                                <div key={person.id} className="person-card">
                                    <h4>Personne #{person.id + 1}</h4>
                                    <p><strong>Posture:</strong> {person.posture}</p>
                                    <p><strong>Confiance:</strong> {Math.round(person.confidence * 100)}%</p>
                                    <p><strong>Position:</strong> x:{person.position.x}, y:{person.position.y}</p>
                                    <p><strong>Dimensions:</strong> {person.position.width}x{person.position.height}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Person;

