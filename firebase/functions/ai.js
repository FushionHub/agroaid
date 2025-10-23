const admin = require("firebase-admin");
const functions = require("firebase-functions");
const {PredictionServiceClient} = require("@google-cloud/aiplatform").v1;
const {helpers} = require("@google-cloud/aiplatform");
const axios = require("axios");

// Initialize Vertex AI
const clientOptions = {
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
};
const predictionServiceClient = new PredictionServiceClient(clientOptions);

/**
 * Triggered by a file upload to Cloud Storage, this function simulates a pest/disease diagnosis.
 */
exports.diagnosePestOrDisease = functions.storage.object().onFinalize(async (object) => {
  const { bucket, name, contentType } = object;

  // PROTOTYPE IMPLEMENTATION
  // This is a mock function that simulates the behavior of an AI model.
  // It returns a random diagnosis and confidence score.
  // In a future implementation, this function will be replaced with a call to a real
  // TensorFlow Lite model for pest and disease detection.
  const isHealthy = Math.random() > 0.5;
  const diagnosis = {
    fileName: name,
    filePath: `gs://${bucket}/${name}`,
    contentType,
    isHealthy,
    diagnosis: isHealthy ? "Healthy" : "Signs of Leaf Scorch detected",
    confidence: Math.random() * (0.95 - 0.7) + 0.7, // Mock confidence score
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await admin.firestore().collection("diagnoses").add(diagnosis);
    console.log(`Diagnosis for ${name} saved to Firestore.`);
  } catch (error) {
    console.error("Error saving diagnosis to Firestore:", error);
  }

  return null;
});

exports.voiceChatbot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to use the voice chatbot."
    );
  }

  const { text } = data;

  if (!text) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required field: text"
    );
  }

  const prompt = `
    You are AgroAid, an AI assistant for Nigerian farmers.
    A farmer has sent you a voice message. Here is the transcription: "${text}"
    Please provide a helpful and conversational response in a way that is easy to understand for someone with low literacy.
    Keep the response concise and focused on the farmer's query.
  `;

  const endpoint = `projects/${process.env.GCLOUD_PROJECT}/locations/us-central1/publishers/google/models/gemini-1.0-pro-001`;

  const instances = [helpers.toValue({ content: prompt })];
  const parameters = helpers.toValue({
    temperature: 0.3,
    maxOutputTokens: 256,
    topP: 0.95,
    topK: 40,
  });

  const request = {
    endpoint,
    instances,
    parameters,
  };

  try {
    const [response] = await predictionServiceClient.predict(request);
    const prediction = response.predictions[0];
    const responseText = prediction.stringValue;
    return { text: responseText };
  } catch (error) {
    console.error("Error getting chatbot response from Vertex AI:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error getting chatbot response from Vertex AI."
    );
  }
});

exports.getAgroAdvice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to get advice."
    );
  }

  const { prompt } = data;

  if (!prompt) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required field: prompt"
    );
  }

  const endpoint = `projects/${process.env.GCLOUD_PROJECT}/locations/us-central1/publishers/google/models/gemini-1.0-pro-001`;

  const instances = [helpers.toValue({ content: prompt })];
  const parameters = helpers.toValue({
    temperature: 0.2,
    maxOutputTokens: 256,
    topP: 0.95,
    topK: 40,
  });

  const request = {
    endpoint,
    instances,
    parameters,
  };

  try {
    const [response] = await predictionServiceClient.predict(request);
    const prediction = response.predictions[0];
    const text = prediction.stringValue;
    return { text };
  } catch (error) {
    console.error("Error getting advice from Vertex AI:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error getting advice from Vertex AI."
    );
  }
});

exports.getGeoSpecificCropRecommendation = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to get crop recommendations."
      );
    }

    const { lat, lon } = data;

    if (!lat || !lon) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: lat, lon"
      );
    }

    // IMPORTANT: Set the OpenWeatherMap API key in your Firebase project configuration.
    // Run the following command in your terminal:
    // firebase functions:config:set openweathermap.key="YOUR_API_KEY"
    const apiKey = functions.config().openweathermap.key;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
      const weatherResponse = await axios.get(weatherUrl);
      const weatherData = weatherResponse.data;

      const prompt = `
        Given the following weather data for a location in Nigeria, recommend the best crops to plant:
        - Temperature: ${weatherData.main.temp} Kelvin
        - Humidity: ${weatherData.main.humidity}%
        - Weather: ${weatherData.weather[0].description}
        - Wind Speed: ${weatherData.wind.speed} m/s
        Please provide a list of crops suitable for these conditions, along with a brief explanation for each.
      `;

      const endpoint = `projects/${process.env.GCLOUD_PROJECT}/locations/us-central1/publishers/google/models/gemini-1.0-pro-001`;

      const instances = [helpers.toValue({ content: prompt })];
      const parameters = helpers.toValue({
        temperature: 0.2,
        maxOutputTokens: 512,
        topP: 0.95,
        topK: 40,
      });

      const request = {
        endpoint,
        instances,
        parameters,
      };

      const [response] = await predictionServiceClient.predict(request);
      const prediction = response.predictions[0];
      const text = prediction.stringValue;
      return { text };
    } catch (error) {
      console.error("Error getting crop recommendation:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error getting crop recommendation."
      );
    }
  }
);
