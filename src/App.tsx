import Header from './components/Header'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/about'

function Placeholder({ name }: { name: string }) {
  return (
    <main className="page placeholder-page">
      <h1>{name}</h1>
      <p>This page will be built later.</p>
    </main>
  )
}

function App() {
  return (
    <div className='app'>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/templates" element={<Placeholder name="Templates" />} />
        <Route path="/blog" element={<Placeholder name="Blog" />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Placeholder name="Login" />} />
        <Route path="/signup" element={<Placeholder name="Sign Up" />} />
        <Route path="/support" element={<Placeholder name="Support" />} />
      </Routes>
    </div>

  )
}

export default App
