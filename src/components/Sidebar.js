import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.js';
import logo from '../assets/MechHelp_Logo.png';
import {
  LayoutDashboard,
  Sun,
  Moon,
  Users,
  CalendarDays,
  Calendar,
  Star,
  PhoneCall,
  PhoneForwarded,
  FileText,
  BarChart3,
  CreditCard,
  Wrench,
  History,
  ClipboardList,
  MapPin,
  Menu,
  LogOut,
  Settings
} from 'lucide-react';
import './Sidebar.css';

const navSections = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/daily-quicks', label: 'Daily Quicks', icon: Sun },
    ]
  },
  {
    title: 'Leads & Reminders',
    items: [
      { path: '/leads', label: 'All Leads', icon: Users },
      { path: '/leads/today/morning', label: 'Reminders: Morning', icon: Sun },
      { path: '/leads/today/evening', label: 'Reminders: Evening', icon: Moon },
      { path: '/leads/details-shared', label: 'Detail Shared Reminders', icon: PhoneForwarded },
      { path: '/leads/quotation-shared', label: 'Quotation Reminder', icon: FileText },
      { path: '/sujal', label: 'Pending Call List', icon: PhoneCall },
    ]
  },
  {
    title: 'Bookings & Customers',
    items: [
      { path: '/bookings', label: 'Bookings', icon: CalendarDays },
      { path: '/bookings/calendar', label: 'Booking Calendar', icon: Calendar },
      { path: '/vip', label: 'VIP Customers', icon: Star },
      { path: '/daily-garage-board', label: 'Daily Garage Board', icon: ClipboardList },
    ]
  },
  {
    title: 'Services & Tools',
    items: [
      { path: '/mechhelp', label: 'MechHelp Finder', icon: MapPin },
    ]
  },
  {
    title: 'Finance & Analytics',
    items: [
      { path: '/settlements', label: 'Garage Settlement', icon: CreditCard },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
      { path: '/history', label: 'History', icon: History },
    ]
  }
];

export const Sidebar = ({ isCollapsed, onToggleCollapse }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Failed to log out', err);
    }
  };

  return (
    <aside className={`sidebar surface-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
        {!isCollapsed && (
          <img 
            src={logo} 
            alt="MechHelp Logo" 
            style={{ height: '48px', objectFit: 'contain' }} 
          />
        )}
        <button
          type="button"
          className="sidebar-hamburger-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <Menu size={18} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {navSections.map((section, idx) => (
          <div key={section.title || idx} className="nav-section">
            {section.title && !isCollapsed && (
              <div className="nav-section-title">{section.title}</div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || item.path === '/leads' || item.path === '/bookings'}
                className={({ isActive }) =>
                  `nav-item${isActive ? ' active' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <div className="nav-icon">
                  <item.icon size={18} strokeWidth={1.8} />
                </div>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="nav-section" style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={isCollapsed ? "Settings" : undefined}
            style={{ marginBottom: '8px' }}
          >
            <div className="nav-icon">
              <Settings size={18} strokeWidth={1.8} />
            </div>
            {!isCollapsed && <span className="nav-label">Settings</span>}
          </NavLink>

          <button 
            onClick={handleLogout}
            className="nav-item"
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#ef4444' }}
            title={isCollapsed ? "Log Out" : undefined}
          >
            <div className="nav-icon">
              <LogOut size={18} strokeWidth={1.8} />
            </div>
            {!isCollapsed && <span className="nav-label">Log Out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
};
