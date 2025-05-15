const ROBFLOW_API_URL = "https://detect.roboflow.com";
const ROBFLOW_API_KEY = "hT1WxWPj0meZXBbVbIeN";
const MODEL_ID = "license-plate-recognition-rxg4e/11";

/**
 * Envoie une image à Roboflow et récupère les résultats de détection.
 * @param {string} base64Image - Image encodée en base64.
 * @returns {Promise<Object>} - Résultat de la détection.
 */
export const inferRoboflow = async (base64Image) => {
  try {
    const response = await fetch(`${ROBFLOW_API_URL}/${MODEL_ID}?api_key=${ROBFLOW_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image.split(",")[1] }), // Retire "data:image/jpeg;base64,"
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de l'inférence Roboflow:", error);
    throw error;
  }
};
