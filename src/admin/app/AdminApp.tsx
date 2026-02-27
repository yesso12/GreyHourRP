import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAdmin } from '../auth/RequireAdmin'
import { RequireOwner } from '../auth/RequireOwner'
import { AdminLayout } from './AdminLayout'

import { AdminLogin } from '../pages/Login'
import { AdminDashboard } from '../pages/Dashboard'
import { AdminQuickStart } from '../pages/QuickStart'
import { AdminTransmissions } from '../pages/Transmissions'
import { AdminUpdates } from '../pages/Updates'
import { AdminServerStatus } from '../pages/ServerStatus'
import { AdminStatusHistory } from '../pages/StatusHistory'
import { AdminMods } from '../pages/Mods'
import { AdminShops } from '../pages/Shops'
import { AdminFactions } from '../pages/Factions'
import { AdminDossiers } from '../pages/Dossiers'
import { AdminStoryArcs } from '../pages/StoryArcs'
import { AdminEvents } from '../pages/Events'
import { AdminEconomy } from '../pages/Economy'
import { AdminHelpline } from '../pages/Helpline'
import { AdminDiscordRouting } from '../pages/DiscordRouting'
import { AdminUsers } from '../pages/Users'
import { AdminBackups } from '../pages/Backups'
import { AdminActivity } from '../pages/Activity'
import { AdminDiscord } from '../pages/Discord'
import { AdminDiscordBotCommands } from '../pages/DiscordBotCommands'
import { AdminAutomation } from '../pages/Automation'
import { AdminAudio } from '../pages/Audio'
import { AdminHomeMedia } from '../pages/HomeMedia'
import { AdminGameControl } from '../pages/GameControl'
import { AdminServerControl } from '../pages/ServerControl'
import { AdminLoadouts } from '../pages/Loadouts'
import { AdminItemCodes } from '../pages/ItemCodes'
import { AdminGovernance } from '../pages/Governance'
import { AdminOps } from '../pages/Ops'
import { AdminOpsSimple } from '../pages/OpsSimple'
import { AdminGroupRequests } from '../pages/GroupRequests'

export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminQuickStart />} />
        <Route
          path="advanced-dashboard"
          element={
            <RequireOwner>
              <AdminDashboard />
            </RequireOwner>
          }
        />
        <Route path="transmissions" element={<AdminTransmissions />} />
        <Route path="updates" element={<AdminUpdates />} />
        <Route path="home-media" element={<AdminHomeMedia />} />
        <Route path="server-status" element={<AdminServerStatus />} />
        <Route path="status-history" element={<AdminStatusHistory />} />
        <Route path="mods" element={<AdminMods />} />
        <Route path="shops" element={<AdminShops />} />
        <Route path="factions" element={<AdminFactions />} />
        <Route path="dossiers" element={<AdminDossiers />} />
        <Route path="story-arcs" element={<AdminStoryArcs />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="economy" element={<AdminEconomy />} />
        <Route path="helpline" element={<AdminHelpline />} />
        <Route path="discord-routing" element={<AdminDiscordRouting />} />
        <Route path="group-requests" element={<AdminGroupRequests />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="backups" element={<AdminBackups />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="discord" element={<AdminDiscord />} />
        <Route path="discord-bot-commands" element={<AdminDiscordBotCommands />} />
        <Route path="game-control" element={<AdminGameControl />} />
        <Route path="server-control" element={<AdminServerControl />} />
        <Route path="loadouts" element={<AdminLoadouts />} />
        <Route path="governance" element={<AdminGovernance />} />
        <Route path="item-codes" element={<AdminItemCodes />} />
        <Route path="ops" element={<AdminOpsSimple />} />
        <Route
          path="ops-advanced"
          element={
            <RequireOwner>
              <AdminOps />
            </RequireOwner>
          }
        />
        <Route path="automation" element={<AdminAutomation />} />
        <Route path="audio" element={<AdminAudio />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
