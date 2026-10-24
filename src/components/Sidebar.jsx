'use client';

import { useState } from 'react';
import IconRail from './sidebar/IconRail';
import WhiteSubpanel from './sidebar/WhiteSubpanel';

export default function Sidebar() {
  const [isSubpanelOpen, setIsSubpanelOpen] = useState(true);

  const toggleSubpanel = () => {
    setIsSubpanelOpen((open) => !open);
  };

  return (
    <div className="sticky top-0 flex h-screen shrink-0">
      <IconRail isSubpanelOpen={isSubpanelOpen} onToggleSubpanel={toggleSubpanel} />
      <div
        aria-hidden={!isSubpanelOpen}
        inert={!isSubpanelOpen}
        className={`h-full overflow-hidden transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isSubpanelOpen ? 'w-56 translate-x-0 opacity-100' : 'w-0 -translate-x-3 opacity-0'
        }`}
      >
        <WhiteSubpanel />
      </div>
    </div>
  );
}