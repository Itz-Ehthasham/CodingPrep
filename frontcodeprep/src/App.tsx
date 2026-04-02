import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EditorPage } from './pages/EditorPage'
import { LandingPage } from './pages/LandingPage'
import { PracticePage } from './pages/PracticePage'
import { Signup } from './pages/Signup'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/editor"
        element={
          <Layout>
            <EditorPage />
          </Layout>
        }
      />
      <Route
        path="/practice"
        element={
          <Layout>
            <PracticePage />
          </Layout>
        }
      />
      <Route path="/home" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
