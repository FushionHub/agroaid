# AgroAid

AgroAid is a cloud-powered AI agricultural platform designed to empower smallholder farmers in Nigeria.

## Project Structure

-   `/ai`: Contains AI and Machine Learning pipelines.
-   `/firebase`: Contains the Firebase project configuration, Cloud Functions, and Firestore rules.
-   `/webapp`: Contains the Next.js web application for the admin dashboard and marketplace.
-   `/mobile`: (Placeholder) Will contain the mobile application.

## Setup Instructions

### Firebase Backend

1.  **Install Dependencies:**
    ```bash
    cd firebase/functions
    npm install
    ```
2.  **Configure Environment Variables:**
    Set the following environment variables for the Cloud Functions. See the [Firebase documentation](https://firebase.google.com/docs/functions/config-env) for instructions on how to set these.
    -   `openweathermap.key`: Your OpenWeatherMap API key.
    -   `paystack.secret_key`: Your Paystack secret key.

### Web Application

1.  **Install Dependencies:**
    ```bash
    cd webapp
    npm install
    ```
2.  **Configure Environment Variables:**
    Create a `.env.local` file in the `webapp` directory and add the following environment variables. You can get these values from your Firebase project settings.
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
    ```
3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
