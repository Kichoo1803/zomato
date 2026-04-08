import { Outlet } from "react-router-dom";
import { Footer } from "@/components/navigation/footer";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { Navbar } from "@/components/navigation/navbar";

export const RootLayout = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="min-h-[calc(100vh-80px)]">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};
