import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { StickyHeader } from './StickyHeader';

export const Layout: React.FC = () => {
  const location = useLocation();
  const isVehicleSpecs = location.pathname === '/vehicle-specs';
  const isFeedback = location.pathname === '/feedback';
  const isCalendar = location.pathname.startsWith('/bookings/calendar');
  const isSettings = location.pathname === '/settings';

  return (
    <div className={`app-container ${isFeedback ? 'feedback-active-route' : ''}`}>
      <Sidebar />
      <div className="main-content">
        {!isVehicleSpecs && <StickyHeader />}
        <div className={`page-container ${isVehicleSpecs ? 'vehicle-specs-page-container' : ''} ${isFeedback ? 'feedback-page-container' : ''} ${isCalendar ? 'calendar-page-container' : ''} ${isSettings ? 'settings-page-container' : ''}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
