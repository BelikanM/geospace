Voici exactement les parties précises à remplacer dans ton script original (Analyse.js) pour intégrer les deux modèles sans altérer ta logique existante :


---

1. Remplace la section du chargement des modèles :

Cherche dans ton fichier original (dans useEffect où tu charges COCO-SSD) :

// Charger modèle COCO-SSD
console.log("Chargement du modèle COCO-SSD...");
const cocoModel = await cocoSsd.load({
  base: detectionMode === "fast" ? "lite_mobilenet_v2" : "mobilenet_v2"
});

Remplace par :

// Charger COCO-SSD
console.log("Chargement du modèle COCO-SSD...");
const cocoModel = await cocoSsd.load({
  base: detectionMode === "fast" ? "lite_mobilenet_v2" : "mobilenet_v2"
});

// Charger modèle YOLO personnalisé
console.log("Chargement du modèle YOLO personnalisé...");
const yoloModel = await tf.loadGraphModel('/models/lifemodo_tfjs/model.json');

// Stocker les modèles
modelRef.current = {
  cocoModel,
  yoloModel,
  customModelLoaded: true,
  createdAt: new Date()
};


---

2. Remplace la section de détection dans la fonction detectFrame :

Cherche cette ligne :

const rawPredictions = await modelRef.current.cocoModel.detect(video, 10);

Remplace toute cette ligne par la logique fusionnée :

// COCO-SSD Predictions
const cocoPredictions = await modelRef.current.cocoModel.detect(video, 10);

// YOLO Predictions
const inputTensor = tf.browser.fromPixels(video)
  .resizeNearestNeighbor([640, 640])
  .expandDims()
  .div(255.0);

const yoloOutput = await modelRef.current.yoloModel.executeAsync(inputTensor);
const yoloData = await yoloOutput[0].array();
const yoloRawPredictions = yoloData[0];

const yoloPredictions = [];

for (let i = 0; i < yoloRawPredictions.length; i++) {
  const [x, y, w, h, score, classId] = yoloRawPredictions[i];
  if (score > 0.5) {
    yoloPredictions.push({
      bbox: [
        (x - w / 2) * 640,
        (y - h / 2) * 640,
        w * 640,
        h * 640
      ],
      class: `custom-${classId}`,
      score,
      icon: '🔧'
    });
  }
}

// Fusion des prédictions COCO-SSD et YOLO
const rawPredictions = [...cocoPredictions, ...yoloPredictions];

> Important : Remarque que je redéfinis la variable rawPredictions afin de préserver ton code existant (qui utilise déjà rawPredictions).




---

3. (Optionnel mais conseillé) :

Si tu souhaites une distinction claire entre les prédictions COCO-SSD et YOLO dans la logique d'enrichissement (enrichPredictions), tu peux modifier la fonction originale comme suit :

Cherche ta fonction :

const enrichPredictions = (predictions) => {

Remplace-la par :

const enrichPredictions = (predictions) => {
  return predictions.map(prediction => ({
    ...prediction,
    icon: prediction.class.includes('custom-') ? '🔧' : '🔍',
    detectedAt: new Date().toISOString(),
    certainty: prediction.score > 0.8 ? "Élevée" : prediction.score > 0.6 ? "Moyenne" : "Faible",
  }));
};


---

✅ Résumé très précis :

Chargement des modèles (useEffect au début).

Détection et fusion (detectFrame dans la boucle principale).

Enrichissement distinctif (enrichPredictions).


Tu peux simplement copier-coller ces trois sections indiquées à leur place précise dans ton fichier Analyse.js original, et tout fonctionnera immédiatement avec les deux modèles associés.


