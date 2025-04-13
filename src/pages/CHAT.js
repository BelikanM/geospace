import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  FaUser,
  FaSmile,
  FaWalking,
  FaAccessibleIcon,
  FaHandPaper,
  FaTachometerAlt,
  FaSync,
  FaCamera,
  FaCameraRetro,
  FaExclamationTriangle,
  FaArrowRight,
  FaArrowUp,
  FaArrowDown,
  FaArrowLeft,
} from 'react-icons/fa';

const Open = () => {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef();
  const canvasRef = useRef();
  
  // Activer la caméra
  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error("Erreur d'accès à la caméra:", err);
      setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
    }
  };
  
  // Arrêter la caméra
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };
  
  // Capturer l'image
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageDataURL = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageDataURL);
    }
  };
  
  // Analyser l'image capturée
  const analyzeImage = async () => {
    if (!capturedImage) {
      return;
    }
    
    try {
      setAnalyzing(true);
      setError(null);
      
      const response = await fetch('http://localhost:5007/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: capturedImage })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      setAnalysisResults(data);
    } catch (err) {
      console.error("Erreur lors de l'analyse:", err);
      setError(`Erreur lors de l'analyse: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };
  
  // Nettoyer lors de la déconnexion
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);
  
  // Formatage de l'heure pour l'horodatage
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Inconnue";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };
  
  // Obtenir l'icône correspondant à la direction du mouvement
  const getDirectionIcon = (direction) => {
    switch (direction) {
      case 'droite': return <FaArrowRight />;
      case 'gauche': return <FaArrowLeft />;
      case 'haut': return <FaArrowUp />;
      case 'bas': return <FaArrowDown />;
      default: return null;
    }
  };
  
  // Réinitialiser l'analyse
  const resetAnalysis = () => {
    setCapturedImage(null);
    setAnalysisResults(null);
    setError(null);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom component="h1" align="center">
        Analyse d'Image en Temps Réel
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Capture Vidéo
            </Typography>
            
            <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
              {/* Vidéo en direct */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ 
                  width: '100%', 
                  borderRadius: '8px',
                  display: cameraActive ? 'block' : 'none'
                }} 
              />
              
              {/* Afficher l'image capturée si disponible */}
              {capturedImage && (
                <Box 
                  component="img" 
                  src={capturedImage} 
                  sx={{ 
                    width: '100%', 
                    borderRadius: '8px',
                    display: cameraActive ? 'none' : 'block'
                  }} 
                />
              )}
              
              {/* Si l'API a renvoyé une image annotée */}
              {analysisResults?.annotated_image && (
                <Box 
                  component="img" 
                  src={analysisResults.annotated_image} 
                  sx={{ 
                    width: '100%', 
                    borderRadius: '8px',
                    mt: 2
                  }}
                  alt="Image annotée avec détections"
                />
              )}
              
              {/* Canvas caché pour la capture */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              {/* Message d'erreur */}
              {error && (
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'error.light', 
                    color: 'error.contrastText',
                    borderRadius: '8px',
                    mt: 2
                  }}
                >
                  <Typography variant="body2">
                    <FaExclamationTriangle style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {error}
                  </Typography>
                </Box>
              )}
              
              {/* Indicateur de chargement pendant l'analyse */}
              {analyzing && (
                <Box 
                  sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '8px'
                  }}
                >
                  <CircularProgress color="primary" />
                  <Typography variant="body1" color="white" sx={{ ml: 2 }}>
                    Analyse en cours...
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              {!cameraActive ? (
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={startCamera}
                  startIcon={<FaCamera />}
                  fullWidth
                >
                  Démarrer la caméra
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    onClick={stopCamera}
                    fullWidth
                  >
                    Arrêter la caméra
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={captureImage}
                    startIcon={<FaCameraRetro />}
                    fullWidth
                  >
                    Capturer
                  </Button>
                </>
              )}
            </Box>
            
            {capturedImage && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button 
                  variant="contained" 
                  color="success" 
                  onClick={analyzeImage}
                  fullWidth
                  disabled={analyzing}
                >
                  Analyser l'image
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  onClick={resetAnalysis}
                  startIcon={<FaSync />}
                  fullWidth
                >
                  Réinitialiser
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Résultats de l'Analyse
            </Typography>
            
            {analysisResults ? (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" color="primary">
                          <FaUser style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                          Détection
                        </Typography>
                        <Typography variant="h4" align="center">
                          {analysisResults.person_count} {analysisResults.person_count > 1 ? 'personnes' : 'personne'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Visages: {analysisResults.face_detected ? 'Oui' : 'Non'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Mains: {analysisResults.hands_detected ? `Oui (${analysisResults.hand_count || 'N/A'})` : 'Non'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" color="primary">
                          <FaAccessibleIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                          Posture
                        </Typography>
                        {analysisResults.postures && analysisResults.postures.length > 0 ? (
                          <>
                            <Typography variant="h6" align="center">
                              {analysisResults.postures[0].type || "Inconnue"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Confiance: {Math.round((analysisResults.postures[0].confidence || 0) * 100)}%
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body1" align="center">
                            Aucune posture détectée
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  {analysisResults.movement_analysis && Object.keys(analysisResults.movement_analysis).length > 0 && (
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" color="primary">
                            <FaWalking style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            Mouvement
                          </Typography>
                          <Grid container spacing={1} alignItems="center">
                            <Grid item xs={6}>
                              <Typography variant="body1">
                                Direction: {analysisResults.movement_analysis.direction}
                                {getDirectionIcon(analysisResults.movement_analysis.direction)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body1">
                                <FaTachometerAlt style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                                Vitesse: {Math.round(analysisResults.movement_analysis.speed)}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {analysisResults.intention_analysis && analysisResults.intention_analysis.length > 0 && (
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" color="primary">
                            Intention Probable
                          </Typography>
                          <List dense>
                            {analysisResults.intention_analysis.map((intention, idx) => (
                              <ListItem key={idx}>
                                <ListItemIcon>
                                  {idx === 0 ? <FaArrowRight color="primary"/> : <FaArrowRight style={{ color: 'action' }} />}
                                </ListItemIcon>
                                <ListItemText 
                                  primary={`${intention.intention} (${Math.round(intention.probability * 100)}%)`}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {analysisResults.emotions && analysisResults.emotions.length > 0 && (
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" color="primary">
                            <FaSmile style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            Expression
                          </Typography>
                          <Typography variant="body1" align="center">
                            {analysisResults.emotions.join(', ')}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          Horodatage: {formatTimestamp(analysisResults.timestamp)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  Capturez et analysez une image pour voir les résultats ici.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Open;


