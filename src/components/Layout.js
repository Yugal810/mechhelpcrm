import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { StickyHeader } from './StickyHeader.js';

export const Layout = () => {
  const location = useLocation();
  const isMechHelpPage = location.pathname.startsWith('/mechhelp');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMechHelpPage);

  useEffect(() => {
    if (isMechHelpPage) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  return (
    <div className={`app-container ${isMechHelpPage ? 'mechhelp-fullpage' : ''}`}>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      <div className="main-content">
        {!isMechHelpPage && <StickyHeader />}
        <div className={`page-container ${isMechHelpPage ? 'is-fullpage' : ''}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
