import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { GamePage } from "@/pages/Game";

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games/:gameId" element={<GamePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
