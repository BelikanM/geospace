const express = require('express');
const mysql = require('mysql');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

// Configuration MySQL
const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'belikan',
  password: 'Dieu19961991??!',
  database: 'MSDOS'
});

// Connexion à la base de données
db.connect((err) => {
  if (err) throw err;
  console.log('Connecté à la base de données MySQL');
});

// Configuration Express
const app = express();
app.use(cors());
app.use(express.json());

// Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Répertoire de destination
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Endpoint pour téléverser un média
app.post('/upload', upload.single('media'), (req, res) => {
  const mediaPath = req.file.path;
  const sql = 'INSERT INTO media (path) VALUES (?)';
  
  db.query(sql, [mediaPath], (err, result) => {
    if (err) throw err;
    res.send({ message: 'Fichier téléversé avec succès', id: result.insertId });
  });
});

// Endpoint pour récupérer les médias
app.get('/media', (req, res) => {
  const sql = 'SELECT * FROM media';
  
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.send(results);
  });
});

// Lancement du serveur
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});

