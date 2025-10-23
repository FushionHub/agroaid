const admin = require("firebase-admin");

admin.initializeApp();

const users = require("./users");
const marketplace = require("./marketplace");
const ai = require("./ai");

exports.onUserCreate = users.onUserCreate;
exports.createUserAccount = users.createUserAccount;
exports.getUserProfile = users.getUserProfile;
exports.updateUserProfile = users.updateUserProfile;

exports.createProduct = marketplace.createProduct;
exports.getProduct = marketplace.getProduct;
exports.updateProduct = marketplace.updateProduct;
exports.deleteProduct = marketplace.deleteProduct;

exports.diagnosePestOrDisease = ai.diagnosePestOrDisease;
exports.voiceChatbot = ai.voiceChatbot;
exports.getAgroAdvice = ai.getAgroAdvice;
exports.getGeoSpecificCropRecommendation = ai.getGeoSpecificCropRecommendation;
