import { Routes, Route, Outlet, Link, useNavigate, NavLink } from 'react-router-dom';
import React from 'react';
import { useAuth } from './contexts/AuthContext'; // Import useAuth
import { useTheme } from './contexts/ThemeContext'; // Import useTheme
import { DarkModeToggle } from './components/DarkModeToggle'; // Import DarkModeToggle
import AdminRouteGuard from './components/AdminRouteGuard'; // Import AdminRouteGuard

// Import komponen halaman sebenar
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ContactPage from './pages/ContactPage';
import AutoresponderPage from './pages/AIChatbotPage';
import MembershipPage from './pages/MembershipPage';
import AccountPage from './pages/AccountPage';
import MediaStoragePage from './pages/MediaStoragePage';
import UserListPage from './pages/admin/UserListPage'; // Import halaman admin
import ScanDevicePage from './pages/ScanDevicePage'; // <-- Tambah import untuk ScanDevicePage
// Import halaman baru untuk Campaign
import CampaignListPage from './pages/CampaignListPage'; // <-- BARU
import AddCampaignPage from './pages/AddCampaignPage'; // <-- BARU
// Import halaman Settings
import SettingsPage from './pages/SettingsPage'; // <-- BARU

// Import Icons
import {
  LayoutDashboard, // Dashboard
  MessageSquare, // Chat
  Users, // Contacts (Upload Contacts)
  Send, // Bulk Sender
  Bot, // AI Chatbot (asalnya Autoresponder)
  QrCode, // Scan Device (BARU)
  ScanLine, // Alternatif Scan Device
  ImageIcon, // Media Storage (untuk dropdown)
  UserCog, // Account (untuk dropdown)
  BadgeInfo, // Membership (alternative)
  Settings, // Settings (jika perlu)
  LogOut, // Logout
  Bell, // Notifications
  Mail, // Mail (contoh)
  ChevronDown, // Dropdown arrow
  Menu, // Icon untuk menu mobile
  ShieldCheck // Ikon untuk Admin
} from 'lucide-react';

// Import komponen shadcn/ui
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// Import Sheet untuk menu mobile (jika perlu)
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

// Komponen Header (Kini menjadi Navbar Utama)
const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Pindahkan menuItems ke sini
  // Susunan Navbar Baru: Dashboard, Scan Device, Upload Contacts, AI Chatbot, Chat, Bulk Sender
  const menuItems = [
    { to: "/", icon: LayoutDashboard, title: "Dashboard" },
    { to: "/scan-device", icon: QrCode, title: "Scan Device" },
    { to: "/contacts", icon: Users, title: "Upload Contacts" },
    { to: "/ai-chatbot", icon: Bot, title: "AI Chatbot" },
  ];

  // Tambah pautan admin jika role === 'admin'
  // Pautan admin tidak dinyatakan dalam perubahan, jadi kita kekalkan buat masa ini
  const adminMenuItems = user?.role === 'admin' ? [
     { to: "/admin/users", icon: ShieldCheck, title: "Admin Users" }
  ] : [];

  const allMenuItems = [...menuItems, ...adminMenuItems]; // Gabungkan menu

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    // Header kini fixed top, left 0, right 0
    <header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-6 bg-[#484ffc] border-b border-border z-10">
      <div className="flex items-center space-x-4">
        {/* Logo */} 
        <Link to="/" className="flex items-center space-x-2 text-white font-semibold">
          <img src="/logo.png" alt="Logo" className="h-8" />
          {/* <span className="hidden sm:inline">AI Chatbot</span> */}
        </Link>

        {/* Navigasi Utama - Tersembunyi pada mobile, tunjuk pada skrin besar */} 
        <nav className="hidden md:flex items-center space-x-1">
          {allMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${ 
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/80 hover:bg-white/20 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4 mr-2" /> 
              {item.title}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Toggle Dark Mode */} 
        <DarkModeToggle />
        
        {/* Dropdown Pengguna */} 
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2 pl-2 pr-3 py-1 h-auto rounded-full">
                 <Avatar className="h-6 w-6">
                     {/* <AvatarImage src={user.avatarUrl || undefined} /> // Jika ada URL avatar */}
                    <AvatarFallback className="text-xs">
                        {user.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
                    </AvatarFallback>
                 </Avatar>
                 <span className="text-sm font-medium hidden sm:inline">{user.name || 'Pengguna'}</span>
                 <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                 <p className="text-sm font-medium leading-none">{user.name || 'Akaun Saya'}</p>
                 <p className="text-xs leading-none text-muted-foreground mt-1">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account"><UserCog className="mr-2 h-4 w-4" /> Account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                 <Link to="/media-storage"> <ImageIcon className="mr-2 h-4 w-4" /> Media Storage</Link>
              </DropdownMenuItem>
              {/* <DropdownMenuItem asChild>
                 <Link to="/settings"> <Settings className="mr-2 h-4 w-4" /> Settings</Link>
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />
              {/* Pautan Admin (jika user admin) */} 
              {user.role === 'admin' && (
                  <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                          <Link to="/admin/users"><ShieldCheck className="mr-2 h-4 w-4" /> Membership Management</Link>
                      </DropdownMenuItem>
                  </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700 focus:bg-red-100/50 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" /> Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Menu Mobile - Guna Sheet */} 
        <div className="md:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-4">
                    {/* Logo dalam Sheet */}
                     <Link to="/" className="flex items-center space-x-2 text-primary font-semibold mb-6">
                       <img src="/logo.png" alt="Logo" className="h-8" />
                       <span>AI Chatbot</span>
                     </Link>
                     {/* Navigasi dalam Sheet */} 
                    <nav className="flex flex-col space-y-2">
                       {allMenuItems.map((item) => (
                         <NavLink
                           key={item.to}
                           to={item.to}
                           className={({ isActive }) =>
                             `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${ 
                               isActive 
                                 ? 'bg-accent text-accent-foreground' 
                                 : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                             }`
                           }
                         >
                           <item.icon className="h-4 w-4 mr-2" /> 
                           {item.title}
                         </NavLink>
                       ))}
                    </nav>
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
};

// Layout Utama (tanpa Sidebar)
const MainLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
     return <div className="flex items-center justify-center h-screen">Memuatkan...</div>; 
  }
  
  return (
    // Buang flex h-screen dari sini
    <div className="min-h-screen flex flex-col bg-background">
      {/* <Sidebar /> Buang Sidebar */}
      <Header /> {/* Header kini navbar utama */}
      {/* Buang ml-16, adjust padding atas (pt-16) untuk compensate header fixed */} 
      <main className="flex-1 overflow-y-auto p-6 pt-20 bg-muted/40">
        <Outlet />
      </main>
    </div>
  );
};

// Layout Asas untuk Autentikasi (tiada sidebar/header)
const AuthLayout = () => {
   const { user, loading } = useAuth();
   const navigate = useNavigate();

    // Panggil useEffect tanpa syarat
    React.useEffect(() => {
      // Letak syarat di dalam useEffect
      console.log("AuthLayout Effect: loading=", loading, "user object:", user);
      if (!loading && user) {
         console.log("AuthLayout: Redirecting to /");
         navigate('/', { replace: true });
      }
    }, [loading, user, navigate]); // Tambah dependencies

   // Jika masih loading atau sudah ada user (sebelum redirect berlaku)
   if (loading || user) {
     return <div className="flex items-center justify-center h-screen">Memuatkan...</div>; 
   }

   // Jika tidak loading dan tiada user, tunjukkan halaman login/register
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Outlet />
    </div>
  );
};

function App() {
  return (
    <Routes>
      {/* Laluan untuk Autentikasi (dilindungi oleh AuthLayout) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Laluan untuk Aplikasi Utama (dilindungi oleh MainLayout) */}
      <Route element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/scan-device" element={<ScanDevicePage />} />
        <Route path="/contacts" element={<ContactPage />} />
        <Route path="/ai-chatbot" element={<AutoresponderPage />} />
        <Route path="/ai-chatbot/:numberId/campaigns" element={<CampaignListPage />} />
        <Route path="/ai-chatbot/:numberId/campaigns/create" element={<AddCampaignPage />} />
        <Route path="/add-campaign" element={<AddCampaignPage />} />
        <Route path="/media-storage" element={<MediaStoragePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/campaigns" element={<CampaignListPage />} />
        <Route path="/dashboard/add-campaign/:deviceId?/:campaignId?" element={<AddCampaignPage />} />

        {/* Laluan Admin (dilindungi) */}
        <Route element={<AdminRouteGuard />}> { /* Bungkus laluan admin */}
            <Route path="/admin/users" element={<UserListPage />} />
            {/* Tambah laluan admin lain di sini */}
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
