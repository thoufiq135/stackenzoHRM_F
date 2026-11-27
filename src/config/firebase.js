import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDcTZe26pL2ko4ifL8yGA3Kxn3PiAXudgs",
  authDomain: "chattingtest-227f6.firebaseapp.com",
  databaseURL: "https://chattingtest-227f6-default-rtdb.firebaseio.com",
  projectId: "chattingtest-227f6",
  storageBucket: "chattingtest-227f6.firebasestorage.app",
  messagingSenderId: "547982053560",
  appId: "1:547982053560:web:52f36edd914617719ca44d"
};

if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId
) {
    throw new Error("Firebase frontend configuration is incomplete");
}

if (firebaseConfig.projectId !== "chattingtest-227f6") {
    throw new Error(
        `Wrong Firebase project: ${firebaseConfig.projectId}`
    );
}

const firebaseApp =
    getApps().find(app => app.name === "chatFirebase") ||
    initializeApp(firebaseConfig, "chatFirebase");

export const chatAuth = getAuth(firebaseApp);
export const chatDatabase = getDatabase(firebaseApp);

export default firebaseApp;
// const firebaseConfig = {
//   apiKey: "AIzaSyDcTZe26pL2ko4ifL8yGA3Kxn3PiAXudgs",
//   authDomain: "chattingtest-227f6.firebaseapp.com",
//   databaseURL: "https://chattingtest-227f6-default-rtdb.firebaseio.com",
//   projectId: "chattingtest-227f6",
//   storageBucket: "chattingtest-227f6.firebasestorage.app",
//   messagingSenderId: "547982053560",
//   appId: "1:547982053560:web:52f36edd914617719ca44d"
// };