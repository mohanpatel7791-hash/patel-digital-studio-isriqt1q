
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
      navigator.serviceWorker.register(
  import.meta.env.BASE_URL + "sw.js"
)
            .then(() => console.log("PWA Service Worker Registered"))
                  .catch((error) => console.log("PWA Error:", error));
                    });
                    }

                    ReactDOM.createRoot(document.getElementById("root")).render(
                      <React.StrictMode>
                            <App />
                                    </React.StrictMode>
                                            );
