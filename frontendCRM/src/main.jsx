import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AuthContext } from "./context/AuthContext";

function Root() {
    const [userInfo, setUserInfo] = React.useState(null);
    return (
        <React.StrictMode>
            <AuthContext.Provider value={{ userInfo, setUserInfo }}>
                <App />
            </AuthContext.Provider>
        </React.StrictMode>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
