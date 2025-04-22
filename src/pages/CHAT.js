// Audio.js - React Component for Audio Analysis

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button, Card, Container, Row, Col, Spinner, Alert, Form } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Audio.css';

// Fix for Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const Audio = () => {
  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userPosition, setUserPosition] = useState(null);
  const [soundResult, setSoundResult] = useState(null);
  const [modelType, setModelType] = useState('transformers'); // 'transformers' or 'traditional'
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Get user's geolocation on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Unable to get your location. Please enable location services.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start recording audio
  const startRecording = async () => {
    try {
      // Reset states
      setError('');
      setAudioBlob(null);
      setAudioURL('');
      setSoundResult(null);
      audioChunksRef.current = [];
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setAudioURL(URL.createObjectURL(audioBlob));
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Set up timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Format recording time (seconds to MM:SS)
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Analyze recorded audio
  const analyzeAudio = async () => {
    if (!audioBlob) {
      setError('Please record audio first.');
      return;
    }

    if (!userPosition) {
      setError('Location services are required. Please enable them and refresh the page.');
      return;
    }

    setIsLoading(true);
    setError('');

    // Create form data to send to backend
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('user_position', JSON.stringify(userPosition));

    try {
      // Choose API endpoint based on selected model type
      const endpoint = modelType === 'transformers' 
        ? 'http://0.0.0.0:5400/api/analyze_with_transformers'
        : 'http://0.0.0.0:5400/api/analyze_audio';
      
      const response = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.status === 'success' && response.data.result) {
        setSoundResult(response.data.result);
      } else {
        setError('Analysis failed. Please try again.');
      }
    } catch (err) {
      console.error('Error analyzing audio:', err);
      setError(`Analysis error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="audio-container mt-4">
      <h2 className="text-center mb-4">Audio Analysis with Transformers</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="mb-4">
        <Card.Body>
          <Card.Title>Record Audio</Card.Title>
          
          <Form.Group className="mb-3">
            <Form.Label>Analysis Model</Form.Label>
            <Form.Select 
              value={modelType} 
              onChange={(e) => setModelType(e.target.value)}
              disabled={isRecording || isLoading}
            >
              <option value="transformers">Transformers (Wav2Vec + AST)</option>
              <option value="traditional">Traditional ML</option>
            </Form.Select>
          </Form.Group>
          
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Button 
              variant={isRecording ? "danger" : "primary"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
            
            {isRecording && (
              <div className="recording-indicator">
                <span className="recording-dot"></span>
                Recording... {formatTime(recordingTime)}
              </div>
            )}
          </div>
          
          {audioURL && (
            <div className="audio-player mb-3">
              <audio src={audioURL} controls className="w-100" />
            </div>
          )}
          
          <Button 
            variant="success" 
            onClick={analyzeAudio} 
            disabled={!audioBlob || isLoading || isRecording}
            className="w-100"
          >
            {isLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Analyzing...
              </>
            ) : "Analyze Audio"}
          </Button>
        </Card.Body>
      </Card>
      
      {soundResult && (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title>Analysis Results</Card.Title>
            <Row>
              <Col md={6}>
                <h5>Sound Classification</h5>
                <p><strong>Type:</strong> {soundResult.predicted_class}</p>
                <p><strong>Confidence:</strong> {(soundResult.confidence * 100).toFixed(2)}%</p>
                <p><strong>Model Used:</strong> {soundResult.model}</p>
                
                {soundResult.direction !== undefined && (
                  <>
                    <h5 className="mt-3">Location Estimation</h5>
                    <p><strong>Direction:</strong> {soundResult.direction}°</p>
                    <p><strong>Distance:</strong> ~{soundResult.distance.toFixed(1)} meters</p>
                  </>
                )}
              </Col>
              
              <Col md={6}>
                {userPosition && soundResult.estimated_location && (
                  <div className="map-container">
                    <MapContainer 
                      center={[userPosition.latitude, userPosition.longitude]} 
                      zoom={15} 
                      style={{ height: '300px', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      
                      {/* User position marker */}
                      <Marker position={[userPosition.latitude, userPosition.longitude]}>
                        <Popup>Your location</Popup>
                      </Marker>
                      
                      {/* Sound source marker */}
                      <Marker 
                        position={[
                          soundResult.estimated_location.latitude, 
                          soundResult.estimated_location.longitude
                        ]}
                        icon={new L.Icon({
                          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                          iconSize: [25, 41],
                          iconAnchor: [12, 41],
                          popupAnchor: [1, -34],
                          shadowSize: [41, 41]
                        })}
                      >
                        <Popup>
                          Estimated sound source: {soundResult.predicted_class}<br/>
                          Confidence: {(soundResult.confidence * 100).toFixed(2)}%
                        </Popup>
                      </Marker>
                      
                      {/* Uncertainty circle */}
                      <Circle 
                        center={[
                          soundResult.estimated_location.latitude, 
                          soundResult.estimated_location.longitude
                        ]}
                        radius={soundResult.distance * (1 - soundResult.confidence)}
                        pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
                      />
                    </MapContainer>
                  </div>
                )}
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default Audio;

