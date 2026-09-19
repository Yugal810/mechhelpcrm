import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { LeadProvider } from './store/LeadContext.js';
import { ThemeProvider } from './store/ThemeContext.js';
import { AuthProvider, useAuth } from './store/AuthContext.js';

import { Login } from './pages/Login.js';
import { ForgotPassword } from './pages/ForgotPassword.js';
import { UpdatePassword } from './pages/UpdatePassword.js';
import { Dashboard } from './pages/Dashboard.js';
import { DailyQuicks } from './pages/DailyQuicks.js';
import { SujalList } from './pages/SujalList.js';
import { Kanban } from './pages/Kanban.js';
import { AllLeads } from './pages/AllLeads.js';
import { ReminderPage } from './pages/ReminderPage.js';
import { Bookings } from './pages/Bookings.js';
import { BookingCalendar } from './pages/BookingCalendar.js';
import { VipCustomers } from './pages/VipCustomers.js';
import { WhatsappBroadcast } from './pages/WhatsappBroadcast.js';
import { Reports } from './pages/Reports.js';
import { Settings } from './pages/Settings.js';
import { GarageSettlement } from './pages/GarageSettlement.js';
import { HistoryPage } from './pages/History.js';
import { DailyGarageBoard } from './pages/DailyGarageBoard.js';
import { MechHelpService } from './pages/MechHelpService.js';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LeadProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="daily-quicks" element={<DailyQuicks />} />
              <Route path="kanban" element={<Kanban />} />
              <Route path="sujal" element={<SujalList />} />
              <Route path="leads" element={<AllLeads />} />
              <Route path="leads/today" element={<Navigate to="/leads/today/morning" replace />} />
              <Route path="leads/today/morning" element={<ReminderPage slot="morning" />} />
              <Route path="leads/today/evening" element={<ReminderPage slot="evening" />} />
              <Route path="leads/details-shared" element={<ReminderPage slot="details-shared" />} />
              <Route path="leads/quotation-shared" element={<ReminderPage slot="shared-quotation" />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="bookings/calendar" element={<BookingCalendar />} />
              <Route path="vip" element={<VipCustomers />} />
              <Route path="whatsapp" element={<WhatsappBroadcast />} />
              <Route path="mechhelp" element={<MechHelpService />} />
              <Route path="settlements" element={<GarageSettlement />} />
              <Route path="reports" element={<Reports />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="daily-garage-board" element={<DailyGarageBoard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </LeadProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
