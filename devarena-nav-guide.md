# DevArena Nav Bar Guide

This guide explains how to build the DevArena-style navigation bar in React and how to structure your project files.

## 1. Folder Structure

Use this structure inside `src/`:

```
src/
├── components/
│   └── Header.tsx
├── pages/
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── About.tsx
│   ├── Blog.tsx
│   ├── Features.tsx
│   ├── Templates.tsx
│   └── Support.tsx
├── hooks/
│   └── useClock.ts
├── App.tsx
├── main.tsx
├── index.css
└── App.css
```

### Why this structure?

- `components/` holds reusable UI pieces like the header.
- `pages/` holds the individual screens/routes for your app.
- `hooks/` holds shared logic such as a live clock.
- `App.tsx` wires everything together and defines routes.
- `index.css` holds global styles, including nav styling.

## 2. What the Navbar Includes

The DevArena nav bar has:

- A logo on the left that navigates to Home
- A row of nav buttons for main pages
- Auth buttons on the right (`Log In`, `Sign Up`)
- Glassy background and hover animation effects
- The active page highlighted

## 3. Install React Router

If you have not already done this, run:

```bash
npm install react-router-dom
```

React Router allows the nav buttons to switch between pages without refreshing.

## 4. Header Component

Create `src/components/Header.tsx` with this code:

```tsx
import { useNavigate, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/features' },
  { label: 'Templates', path: '/templates' },
  { label: 'Blog', path: '/blog' },
  { label: 'About', path: '/about' },
  { label: 'Support', path: '/support' },
];

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header>
      <span className="logo" onClick={() => navigate('/')}>DevArena</span>

      <nav>
        {navLinks.map((link) => (
          <button
            key={link.path}
            className={location.pathname === link.path ? 'active-nav' : ''}
            onClick={() => navigate(link.path)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <div className="auth-buttons">
        <button className="btn" onClick={() => navigate('/login')}>Log In</button>
        <button className="btn primary" onClick={() => navigate('/signup')}>Sign Up</button>
      </div>
    </header>
  );
}

export default Header;
```

### Explanation

- `useNavigate` changes the route when a button is clicked.
- `useLocation` reads the current URL so the button for the active page can be styled differently.
- `navLinks.map(...)` creates each button from a list, making it easy to add or remove pages.

## 5. Styles for the Header

Add these styles to `src/index.css`:

```css
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 30px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 16px;
  z-index: 100;
  margin: 16px;
}

.logo {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.3px;
  cursor: pointer;
}

nav {
  display: flex;
  gap: 4px;
}

nav button {
  border: none;
  background: transparent;
  padding: 8px 16px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: all 0.2s;
}

nav button:hover {
  background: rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

nav button.active-nav {
  background: rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.auth-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 10px 18px;
  border-radius: 12px;
  border: 0.5px solid #aaa;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.btn:active {
  background: #bde0fe;
  transform: scale(0.97);
}

.btn.primary {
  background: #111;
  color: #fff;
  border: none;
}

.btn.primary:hover {
  background: #333;
}
```

## 6. App Routing Setup

In `src/App.tsx`, import the header and set up routes:

```tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Add more routes here */}
      </Routes>
    </Router>
  );
}

export default App;
```

## 7. Basic Home Page

Create `src/pages/Home.tsx`:

```tsx
function Home() {
  return (
    <div>
      <h1>Welcome to DevArena</h1>
      <p>This is the home page.</p>
    </div>
  );
}

export default Home;
```

## 8. How to Test It

1. Run `npm run dev`
2. Open the browser at `http://localhost:5173`
3. Click the nav buttons
4. Confirm the active page button is highlighted

## 9. Notes

- Every time you add a new page, add it to `src/pages/` and add a route in `App.tsx`.
- Use `navLinks` in `Header.tsx` to keep nav items consistent and easy to update.
- The `backdrop-filter` and semi-transparent background are what give the nav the same glassy effect as your HTML example.
