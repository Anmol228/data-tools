import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { loadLiveMarket } from "./lib/live.js";

createRoot(document.getElementById("root")).render(<App />);
loadLiveMarket();   // built-in numbers show at once; the latest ones replace them when they arrive
