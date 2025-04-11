// src/pages/Upload.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [mediaList, setMediaList] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('media', file);

    try {
      await axios.post('http://localhost:4000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      fetchMedia();
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const fetchMedia = async () => {
    try {
      const response = await axios.get('http://localhost:4000/media');
      setMediaList(response.data);
    } catch (error) {
      console.error('Error fetching media:', error);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  return (
    <div>
      <h1>Téléversement de médias</h1>
      <form onSubmit={handleUpload}>
        <input type="file" onChange={handleFileChange} />
        <button type="submit">Téléverser</button>
      </form>
      <h2>Liste des médias</h2>
      <ul>
        {mediaList.map(media => (
          <li key={media.id}>
            <a href={`/${media.path}`} target="_blank" rel="noopener noreferrer">{media.path}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Upload;

