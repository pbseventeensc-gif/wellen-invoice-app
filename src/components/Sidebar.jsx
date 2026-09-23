import IconRail from './sidebar/IconRail';
import WhiteSubpanel from './sidebar/WhiteSubpanel';

export default function Sidebar() {
  return (
    <div className="flex h-screen sticky top-0 shrink-0">
      <IconRail />
      <WhiteSubpanel />
    </div>
  );
}