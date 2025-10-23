const admin = require("firebase-admin");
const functions = require("firebase-functions");
const {PredictionServiceClient} = require("@google-cloud/aiplatform").v1;
const {helpers} = require("@google-cloud/aiplatform");
const axios = require("axios");

admin.initializeApp();

// Initialize Vertex AI
const clientOptions = {
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
};
const predictionServiceClient = new PredictionServiceClient(clientOptions);

// User Management Functions

/**
 * Handles new user creation by creating a corresponding user profile in Firestore.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;
  const userRef = admin.firestore().collection("users").doc(uid);

  const userProfile = {
    email,
    displayName,
    photoURL,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    roles: ["farmer"], // Default role
  };

  await userRef.set(userProfile);
  console.log(`User profile created for UID: ${uid}`);
  return null;
});

/**
 * Creates a new user account with a specified role.
 */
exports.createUserAccount = functions.https.onCall(async (data, context) => {
  const { email, password, displayName, role } = data;

  // Ensure the user is authenticated, if necessary (e.g., only admins can create users)
  // For now, we'll allow anyone to create an account.

  if (!email || !password || !displayName || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: email, password, displayName, role"
    );
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    const userRef = admin.firestore().collection("users").doc(userRecord.uid);
    const userProfile = {
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      roles: [role],
    };

    await userRef.set(userProfile);

    return { uid: userRecord.uid, message: "User created successfully" };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new functions.https.HttpsError("internal", "Error creating user");
  }
});

/**
 * Gets a user's profile from Firestore.
 */
exports.getUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to view your profile."
    );
  }

  const uid = context.auth.uid;

  try {
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }
    return userDoc.data();
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error getting user profile."
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

/**
 * Updates a user's profile in Firestore.
 */
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to update your profile."
    );
  }

  const uid = context.auth.uid;
  const { displayName, photoURL } = data;
  const userRef = admin.firestore().collection("users").doc(uid);

  const updatedProfile = {
    displayName,
    photoURL,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await userRef.update(updatedProfile);
    return { message: "Profile updated successfully." };
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error updating user profile."
    );
  }
});

// Marketplace Functions

/**
 * Creates a new product in the marketplace.
 */
exports.createProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to create a product."
    );
  }

  const { name, description, price, imageUrl } = data;
  const uid = context.auth.uid;

  if (!name || !description || !price) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: name, description, price"
    );
  }

  const product = {
    name,
    description,
    price,
    imageUrl,
    sellerId: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const productRef = await admin
      .firestore()
      .collection("products")
      .add(product);
    return { id: productRef.id, message: "Product created successfully." };
  } catch (error) {
    console.error("Error creating product:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error creating product."
    );
  }
});

/**
 * Gets a product from the marketplace.
 */
exports.getProduct = functions.https.onCall(async (data, context) => {
  const { productId } = data;

  if (!productId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required field: productId"
    );
  }

  try {
    const productDoc = await admin
      .firestore()
      .collection("products")
      .doc(productId)
      .get();
    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found.");
    }
    return productDoc.data();
  } catch (error) {
    console.error("Error getting product:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error getting product."
    );
  }
});

/**
 * Updates a product in the marketplace.
 */
exports.updateProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to update a product."
    );
  }

  const { productId, name, description, price, imageUrl } = data;
  const uid = context.auth.uid;

  if (!productId || !name || !description || !price) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: productId, name, description, price"
    );
  }

  const productRef = admin.firestore().collection("products").doc(productId);

  try {
    const productDoc = await productRef.get();
    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found.");
    }

    if (productDoc.data().sellerId !== uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission to update this product."
      );
    }

    const updatedProduct = {
      name,
      description,
      price,
      imageUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await productRef.update(updatedProduct);
    return { message: "Product updated successfully." };
  } catch (error) {
    console.error("Error updating product:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error updating product."
    );
  }
});

/**
 * Deletes a product from the marketplace.
 */
exports.deleteProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to delete a product."
    );
  }

  const { productId } = data;
  const uid = context.auth.uid;

  if (!productId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required field: productId"
    );
  }

  const productRef = admin.firestore().collection("products").doc(productId);

  try {
    const productDoc = await productRef.get();
    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found.");
    }

    if (productDoc.data().sellerId !== uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission to delete this product."
      );
    }

    await productRef.delete();
    return { message: "Product deleted successfully." };
  } catch (error) {
    console.error("Error deleting product:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error deleting product."
    );
  }
});

// AI Advisory Functions

/**
 * Triggered by a file upload to Cloud Storage, this function simulates a pest/disease diagnosis.
 */
exports.diagnosePestOrDisease = functions.storage.object().onFinalize(async (object) => {
  const { bucket, name, contentType } = object;

  // For this prototype, we'll use mock logic.
  // In a real implementation, this is where you would call the TensorFlow Lite model.
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
