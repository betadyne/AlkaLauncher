import { render } from "solid-js/web";
import App from "./App";
import "./index.css";

// Disable default browser context menu (refresh, save as, print, etc.)
document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

render(() => <App />, document.getElementById("root")!);

