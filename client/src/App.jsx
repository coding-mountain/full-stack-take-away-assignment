import { useEffect } from "react";

import "./App.css";
import SeismicDashboard from "./screens/SeismicDashboard";

function App() {
  useEffect(() => {
    const data = async () => {
      await fetch("http://localhost:9797/api").then((data) => data.json());
    };
    data();
  }, []);

  return (
    <div>
      <SeismicDashboard />
    </div>
  );
}

export default App;
