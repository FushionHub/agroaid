const admin = require("firebase-admin");
const functions = require("firebase-functions");

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
