import { motion } from 'framer-motion'
import { Search, ScanLine, FlaskConical, SlidersHorizontal, Settings } from 'lucide-react'

const TABS = [
  { id: 'screener',  icon: Search,             label: 'Screener'  },
  { id: 'scanner',   icon: ScanLine,           label: 'Scanner'   },
  { id: 'scenario',  icon: FlaskConical,       label: 'Scenario'  },
  { id: 'filters',   icon: SlidersHorizontal,  label: 'Filters'   },
  { id: 'settings',  icon: Settings,           label: 'Settings'  },
]

export function BottomNav({ active, onChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#1e1e3f]"
      style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-center justify-around py-2 pb-safe max-w-lg mx-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-indigo-600/20 border border-indigo-500/30"
                />
              )}
              <div className="relative z-10">
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`} />
              </div>
              <span className={`text-[9px] font-medium relative z-10 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
