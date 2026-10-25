import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './store/AuthContext';
import { LeadProvider } from './store/LeadContext';
import { ThemeProvider } from './store/ThemeContext';

import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { DailyQuicks } from './pages/DailyQuicks';
import { SujalList } from './pages/SujalList';
import { Kanban } from './pages/Kanban';
import { AllLeads } from './pages/AllLeads';
import { ReminderPage } from './pages/ReminderPage';
import { Bookings } from './pages/Bookings';
import { BookingCalendar } from './pages/BookingCalendar';
import { VipCustomers } from './pages/VipCustomers';
import { WhatsappBroadcast } from './pages/WhatsappBroadcast';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { GarageSettlement } from './pages/GarageSettlement';
import { HistoryPage } from './pages/History';
import { DailyGarageBoard } from './pages/DailyGarageBoard';
import { VehicleSpecs } from './pages/VehicleSpecs';
import { FeedbackPage } from './pages/FeedbackPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/*"
              element={
                <LeadProvider>
                  <Routes>
                    <Route path="/" element={<Layout />}>
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
                      <Route path="settlements" element={<GarageSettlement />} />
                      <Route path="reports" element={<Reports />} />
                      <Route path="history" element={<HistoryPage />} />
                      <Route path="feedback" element={<FeedbackPage />} />
                      <Route path="daily-garage-board" element={<DailyGarageBoard />} />
                      <Route path="vehicle-specs" element={<VehicleSpecs />} />
                      <Route path="settings" element={<Settings />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </LeadProvider>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
