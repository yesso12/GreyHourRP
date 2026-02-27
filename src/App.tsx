import { Suspense, lazy, type ComponentType } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { SiteShell } from './components/SiteShell'
import { useLocation } from 'react-router-dom'
import { useSiteFlags } from './hooks/useSiteFlags'
import { logTelemetry } from './observability'
const CHUNK_RELOAD_ATTEMPT_KEY = 'ghrp:chunk-reload-attempted'

const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)
}

const withChunkAutoRecovery = async <T extends { default: ComponentType<any> },>(
  loader: () => Promise<T>
): Promise<T> => {
  try {
    const loaded = await loader()
    const hadRetryMarker = sessionStorage.getItem(CHUNK_RELOAD_ATTEMPT_KEY) === '1'
    if (hadRetryMarker) {
      logTelemetry({
        level: 'info',
        event: 'app.chunk-reload.recovered',
        message: 'Recovered from stale chunk after automatic page reload.'
      })
    }
    sessionStorage.removeItem(CHUNK_RELOAD_ATTEMPT_KEY)
    return loaded
  } catch (error) {
    if (isChunkLoadError(error)) {
      const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_ATTEMPT_KEY) === '1'
      if (!alreadyRetried) {
        logTelemetry({
          level: 'warn',
          event: 'app.chunk-reload.triggered',
          message: error instanceof Error ? error.message : String(error ?? 'Chunk load failure')
        })
        sessionStorage.setItem(CHUNK_RELOAD_ATTEMPT_KEY, '1')
        window.location.reload()
        return new Promise<T>(() => {})
      }
      logTelemetry({
        level: 'error',
        event: 'app.chunk-reload.failed-after-retry',
        message: error instanceof Error ? error.message : String(error ?? 'Chunk load failure')
      })
    }
    throw error
  }
}

const lazyRecoverable = <T extends { default: ComponentType<any> },>(loader: () => Promise<T>) =>
  lazy(() => withChunkAutoRecovery(loader))

const Home = lazyRecoverable(() => import('./pages/Home').then(m => ({ default: m.Home })))
const Mods = lazyRecoverable(() => import('./pages/Mods').then(m => ({ default: m.Mods })))
const Updates = lazyRecoverable(() => import('./pages/Updates').then(m => ({ default: m.Updates })))
const Dossiers = lazyRecoverable(() => import('./pages/Dossiers').then(m => ({ default: m.Dossiers })))
const StoryArcs = lazyRecoverable(() => import('./pages/StoryArcs').then(m => ({ default: m.StoryArcs })))
const Events = lazyRecoverable(() => import('./pages/Events').then(m => ({ default: m.Events })))
const Economy = lazyRecoverable(() => import('./pages/Economy').then(m => ({ default: m.Economy })))
const Rules = lazyRecoverable(() => import('./pages/Rules').then(m => ({ default: m.Rules })))
const Status = lazyRecoverable(() => import('./pages/Status').then(m => ({ default: m.Status })))
const About = lazyRecoverable(() => import('./pages/About').then(m => ({ default: m.About })))
const Directory = lazyRecoverable(() => import('./pages/Directory').then(m => ({ default: m.Directory })))
const Factions = lazyRecoverable(() => import('./pages/Factions').then(m => ({ default: m.Factions })))
const Levels = lazyRecoverable(() => import('./pages/Levels').then(m => ({ default: m.Levels })))
const HowToJoin = lazyRecoverable(() => import('./pages/HowToJoin').then(m => ({ default: m.HowToJoin })))
const Discord = lazyRecoverable(() => import('./pages/Discord').then(m => ({ default: m.Discord })))
const Staff = lazyRecoverable(() => import('./pages/Staff').then(m => ({ default: m.Staff })))
const Transmissions = lazyRecoverable(() => import('./pages/Transmissions').then(m => ({ default: m.Transmissions })))
const AdminAccess = lazyRecoverable(() => import('./pages/AdminAccess').then(m => ({ default: m.AdminAccess })))
const AdminApp = lazyRecoverable(() => import('./admin/app/AdminApp').then(m => ({ default: m.AdminApp })))
const AdminAuthProvider = lazyRecoverable(() =>
  import('./admin/auth/AdminAuthContext').then(m => ({ default: m.AdminAuthProvider }))
)

function PublicRoutes() {
  const location = useLocation()
  const flags = useSiteFlags()
  return (
    <SiteShell siteFlags={flags}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Suspense fallback={<div className="container" style={{ padding: '28px 20px' }}>Loading…</div>}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/mods" element={flags.showMods === false ? <Home /> : <Mods />} />
              <Route path="/updates" element={flags.showUpdates === false ? <Home /> : <Updates />} />
              <Route path="/dossiers" element={flags.showDossiers === true ? <Dossiers /> : <Home />} />
              <Route path="/arcs" element={<StoryArcs />} />
              <Route path="/events" element={flags.showEvents === false ? <Home /> : <Events />} />
              <Route path="/economy" element={flags.showEconomy === true ? <Economy /> : <Home />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/status" element={<Status />} />
              <Route path="/about" element={<About />} />
              <Route path="/directory" element={flags.showDirectory === false ? <Home /> : <Directory />} />
              <Route path="/factions" element={flags.showFactions === false ? <Home /> : <Factions />} />
              <Route path="/levels" element={flags.showLevels === false ? <Home /> : <Levels />} />
              <Route path="/how-to-join" element={flags.showHowToJoin === false ? <Home /> : <HowToJoin />} />
              <Route path="/discord" element={flags.showDiscordPage === false ? <Home /> : <Discord />} />
              <Route path="/staff" element={flags.showStaff === false ? <Home /> : <Staff />} />
              <Route path="/transmissions" element={flags.showTransmissions === false ? <Home /> : <Transmissions />} />
              <Route path="/admin-access" element={<AdminAccess />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </SiteShell>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="container" style={{ padding: '28px 20px' }}>Loading admin…</div>}>
              <AdminAuthProvider>
                <AdminApp />
              </AdminAuthProvider>
            </Suspense>
          }
        />
        <Route path="/*" element={<PublicRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}
