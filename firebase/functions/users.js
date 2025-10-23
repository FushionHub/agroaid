const admin = require("firebase-admin");
const functions = require("firebase-functions");

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
