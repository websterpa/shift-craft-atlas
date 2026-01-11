# Shift Craft Atlas

**Master Your Shift Scheduling** 🗓️

A simple, intuitive web application for managing employee shifts and schedules. Perfect for small teams, restaurants, retail stores, or any business that needs to organize work schedules.

## Features

- 👥 **Employee Management**: Add and manage your team members with roles
- ➕ **Shift Creation**: Schedule shifts with date, time, and role assignments
- 📅 **Schedule View**: View all shifts in an organized, easy-to-read format
- 🔍 **Date Filtering**: Filter shifts by specific dates
- 💾 **Local Storage**: All data is saved automatically in your browser
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices

## Getting Started

### Quick Start (No Installation Required)

Simply open `index.html` in your web browser to start using the application. No server or installation needed!

### Running with a Local Server

If you prefer to run with a local development server:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:8080`

## How to Use

### 1. Add Employees

1. In the **Employees** section, enter the employee name
2. Enter their role (e.g., Manager, Server, Cook, Cashier)
3. Click **Add Employee**

### 2. Create Shifts

1. In the **Create Shift** section, select an employee from the dropdown
2. Choose the shift date
3. Set the start and end times
4. Optionally, specify a role for this particular shift
5. Click **Create Shift**

### 3. View Schedule

- All shifts are displayed in the **Schedule** section
- Shifts are sorted by date and time
- Each shift shows:
  - Employee name
  - Date and time
  - Duration
  - Role

### 4. Filter Shifts

- Use the date filter to view shifts for a specific day
- Click **Show All** to remove the filter

### 5. Manage Data

- **Delete Employees**: Click the delete button next to an employee (removes all their shifts)
- **Delete Shifts**: Click the delete button next to a shift
- All changes are saved automatically

## Technology Stack

- **HTML5**: Structure
- **CSS3**: Styling with modern gradients and animations
- **JavaScript**: Application logic
- **LocalStorage API**: Data persistence

## Browser Support

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Data Persistence

All data is stored in your browser's LocalStorage. This means:
- ✅ Data persists between sessions
- ✅ No server or database required
- ⚠️ Data is specific to your browser
- ⚠️ Clearing browser data will remove your shifts and employees

## License

MIT License - Feel free to use and modify for your needs!
