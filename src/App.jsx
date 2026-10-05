import { useEffect } from "react";
import { getState, select, closeProfile, closeTopPage, closeTrends } from "./store.js";
import Header from "./components/Header.jsx";
import TrendsSection from "./components/TrendsSection.jsx";
import Stage from "./components/Stage.jsx";
import CardSlot from "./components/Card.jsx";
import ChartsPage from "./components/ChartsPage.jsx";
import Profile from "./components/Profile.jsx";
import HoverChart from "./components/HoverChart.jsx";
import Tooltip from "./components/Tooltip.jsx";

export default function App() {
  // Escape closes the topmost layer: profile, then charts page, then trends pop-up, then the open card.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const s = getState();
      if (s.profile.open) { closeProfile(); return; }
      if (s.topPage.open) { closeTopPage(); return; }
      if (s.trendsOpen) { closeTrends(); return; }
      if (s.selected >= 0) select(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="wrap">
        <Header />
        <TrendsSection />
        <Stage />
        <CardSlot />
      </div>
      <ChartsPage />
      <Profile />
      <Tooltip />
      <HoverChart />
    </>
  );
}
