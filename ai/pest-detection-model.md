# AI Model for Pest and Disease Detection

This directory will contain the AI and Machine Learning pipelines for the AgroAid platform.

## Pest/Disease Image Classification Model

The model to be stored here will be a TensorFlow Lite (`.tflite`) model trained to identify common crop diseases and pests from images.

### Pipeline:
1.  **Data Collection:** Images of diseased and healthy crops will be collected and labeled.
2.  **Training:** A convolutional neural network (CNN) will be trained on the collected data using TensorFlow and Keras.
3.  **Conversion:** The trained model will be converted to the TensorFlow Lite format for efficient on-device inference.
4.  **Deployment:** The `.tflite` model will be deployed to the mobile application for real-time, offline diagnosis.
