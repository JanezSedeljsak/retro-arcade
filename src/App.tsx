import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { GamePage } from "@/pages/Game";

export default function App() {
  return (
    <Layout>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games/:gameId" element={<GamePage />} />
        </Routes>
      </BrowserRouter>
    </Layout>
  );
}
