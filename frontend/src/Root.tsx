import { useEffect, useState } from "react";
import App from "./App";
import LandingPage from "./landing/LandingPage";

// Minimal hash routing: "#/app" opens the debugger, anything else shows the landing page.
const APP_HASH = "#/app";

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function Root() {
  const hash = useHash();
  return hash === APP_HASH ? <App /> : <LandingPage appHref={APP_HASH} />;
}
