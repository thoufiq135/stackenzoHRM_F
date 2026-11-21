import { useState } from 'react'
import { BrowserRouter,Routes,Route } from 'react-router-dom'
import './App.css'
import Login from './login'
import Dashboard from './dashboard'
import TaskManagement from './TaskManagement'
import ProjectDetails from './ProjectDetails'
import Projects from './projects'
function App() {
  const [count, setCount] = useState(0)

  return (
  <BrowserRouter>
  <Routes>
    <Route path='/' element={<Login/>}/>
    <Route path='/dashboard' element={<Dashboard/>}/>
    <Route path='/tasks' element={<TaskManagement/>}/>
    <Route path="/projects/:projectId" element={<ProjectDetails/>}/>
    <Route path="/projects" element={<Projects/>}/>

   </Routes>
  </BrowserRouter>
  )
}

export default App
